// Métricas para el panel administrativo — Sprint 10.1.
//
// La app está construida para que nadie de afuera pueda leer nada de una
// pareja: las reglas de Firestore no le dan acceso ni siquiera a la otra
// persona en varios casos. Un panel que leyera esos datos tiraría abajo esa
// promesa, así que acá NO se lee contenido de nadie. Lo que existe son dos
// cosas:
//
//   adminMetrics/summary   totales acumulados (cuentas, parejas, premium)
//   adminDaily/{YYYY-MM-DD} una foto por día (activos, mensajes, fotos…)
//
// Los dos los escribe exclusivamente el servidor con Admin SDK, y las reglas
// los dejan LEER solo a quien tenga el permiso de administrador y escribir a
// nadie.
//
// Cómo se cuenta, y por qué de dos maneras distintas:
//
// - Lo raro (una cuenta nueva, un emparejamiento, un upgrade) se incrementa
//   en el momento: son pocos eventos y hacerlo así da el número al instante.
// - Lo masivo (mensajes, fotos, respuestas) se cuenta una vez al día con
//   agregaciones count(). Incrementar un contador en cada mensaje costaría
//   una escritura extra por mensaje y, peor, chocaría con el tope de
//   Firestore de una escritura por segundo sobre el mismo documento: con
//   volumen real el contador se pelearía consigo mismo.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

const SUMMARY_DOC = 'adminMetrics/summary';
const DAILY_COLLECTION = 'adminDaily';

// Todo el panel piensa en días chilenos, no en días UTC: si no, "los mensajes
// de ayer" incluirían las primeras horas de hoy.
const TZ = 'America/Santiago';

export const dateKeyInTz = (date: Date): string =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);

// Minutos de desfase de la zona en un instante dado (negativo al oeste de
// Greenwich). Se calcula comparando cómo se lee el mismo instante en las dos
// zonas, que es la forma de obtenerlo sin una librería de husos.
const tzOffsetMinutes = (at: Date): number => {
    const asUtc = new Date(at.toLocaleString('en-US', { timeZone: 'UTC' }));
    const asLocal = new Date(at.toLocaleString('en-US', { timeZone: TZ }));
    return (asLocal.getTime() - asUtc.getTime()) / 60000;
};

// Medianoche chilena de esa fecha, expresada como instante real.
//
// El desfase se toma al mediodía y no a medianoche a propósito: Chile cambia
// la hora justo a medianoche, así que ese es el único momento ambiguo del
// día. El mediodía nunca lo es.
export const startOfDayInTz = (dateKey: string): Date => {
    const noon = new Date(`${dateKey}T12:00:00Z`);
    return new Date(Date.parse(`${dateKey}T00:00:00Z`) - tzOffsetMinutes(noon) * 60000);
};

// --- Incrementos en el momento, para los eventos raros ---

const bumpSummary = async (fields: Record<string, number>): Promise<void> => {
    const db = getFirestore();
    const payload: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const [key, delta] of Object.entries(fields)) payload[key] = FieldValue.increment(delta);

    try {
        await db.doc(SUMMARY_DOC).set(payload, { merge: true });
    } catch (error) {
        // Una métrica que falla no puede tumbar la operación que la produjo:
        // nadie debería quedarse sin emparejar porque un contador no se pudo
        // escribir.
        logger.warn('No se pudo actualizar adminMetrics/summary', error);
    }
};

const bumpToday = async (fields: Record<string, number>): Promise<void> => {
    const db = getFirestore();
    const key = dateKeyInTz(new Date());
    const payload: Record<string, unknown> = { date: key };
    for (const [field, delta] of Object.entries(fields)) payload[field] = FieldValue.increment(delta);

    try {
        await db.collection(DAILY_COLLECTION).doc(key).set(payload, { merge: true });
    } catch (error) {
        logger.warn(`No se pudo actualizar ${DAILY_COLLECTION}/${key}`, error);
    }
};

// Una cuenta nueva. Se cuelga de la creación del perfil y no de la de Auth
// porque es el perfil el que hace utilizable la cuenta.
export const onUserProfileCreated = onDocumentCreated('users/{uid}', async () => {
    await bumpSummary({ totalUsers: 1 });
});

// Las llaman pairing.ts y el webhook de RevenueCat. Son eventos que ocurren
// dentro de una transacción ajena, así que se registran después de que esa
// transacción ya se confirmó: si el emparejamiento falla, no queda contado.
export const recordPairing = async (): Promise<void> => {
    await Promise.all([bumpSummary({ totalCouples: 1 }), bumpToday({ newCouples: 1 })]);
};

export const recordPremiumGranted = async (): Promise<void> => {
    await Promise.all([bumpSummary({ premiumUsers: 1 }), bumpToday({ newPremium: 1 })]);
};

export const recordPremiumRevoked = async (): Promise<void> => {
    await bumpSummary({ premiumUsers: -1 });
};

// --- Foto diaria, para lo masivo ---

const countInRange = async (
    kind: 'collectionGroup' | 'collection',
    name: string,
    field: string,
    start: Date,
    end: Date
): Promise<number> => {
    const db = getFirestore();
    const base = kind === 'collectionGroup' ? db.collectionGroup(name) : db.collection(name);
    try {
        const snapshot = await base
            .where(field, '>=', Timestamp.fromDate(start))
            .where(field, '<', Timestamp.fromDate(end))
            .count()
            .get();
        return snapshot.data().count;
    } catch (error) {
        // Falta el índice de grupo de colección, casi siempre. Se devuelve -1
        // y no 0 para que el panel pueda distinguir "no se pudo contar" de
        // "no hubo ninguno" — mostrar cero cuando en realidad no se sabe es
        // la peor de las dos mentiras.
        logger.error(`No se pudo contar ${name}.${field}`, error);
        return -1;
    }
};

// Corre pasada la medianoche chilena y resume el día que acaba de terminar.
export const aggregateDailyMetrics = onSchedule(
    { schedule: '30 0 * * *', timeZone: TZ },
    async () => {
        const db = getFirestore();

        const now = new Date();
        const todayKey = dateKeyInTz(now);
        const start = startOfDayInTz(todayKey);
        // El día anterior: se retrocede 12 horas desde la medianoche de hoy,
        // que cae con holgura dentro de ayer aunque haya cambio de hora.
        const yesterdayKey = dateKeyInTz(new Date(start.getTime() - 12 * 3600 * 1000));
        const yesterdayStart = startOfDayInTz(yesterdayKey);

        const [messages, photos, answers, newUsers, activeUsers] = await Promise.all([
            countInRange('collectionGroup', 'messages', 'createdAt', yesterdayStart, start),
            countInRange('collectionGroup', 'photos', 'createdAt', yesterdayStart, start),
            countInRange('collectionGroup', 'dailyQuestions', 'updatedAt', yesterdayStart, start),
            countInRange('collection', 'users', 'createdAt', yesterdayStart, start),
            countInRange('collection', 'users', 'lastSeen', yesterdayStart, start),
        ]);

        await db.collection(DAILY_COLLECTION).doc(yesterdayKey).set(
            {
                date: yesterdayKey,
                messages, photos, answers, newUsers, activeUsers,
                computedAt: FieldValue.serverTimestamp(),
            },
            // merge, porque 'newCouples' y 'newPremium' ya los escribió el
            // incremento en vivo durante ese día y no hay que pisarlos.
            { merge: true }
        );

        logger.info(`Métricas de ${yesterdayKey}: ${messages} mensajes, ${activeUsers} activos`);
    }
);

// --- Ficha de cuenta, para soporte ---

// Devuelve cinco campos y ni uno más.
//
// Es una función y no un permiso de lectura sobre 'users' a propósito. Con la
// regla abierta, quien tenga el panel podría leer el perfil entero y de ahí
// llegar a las subcolecciones; acá la privacidad no depende de que el panel
// "no pida" el contenido, sino de que no pueda pedirlo. Y cada consulta queda
// registrada en los logs, que es lo que uno quiere de un acceso de soporte.
export const adminLookupUser = onCall<{ email?: unknown }>(async (request) => {
    if (request.auth?.token.admin !== true) {
        throw new HttpsError('permission-denied', 'Necesitas permisos de administrador.');
    }

    const email = typeof request.data?.email === 'string' ? request.data.email.trim().toLowerCase() : '';
    if (!email) {
        throw new HttpsError('invalid-argument', 'Falta el correo a buscar.');
    }

    const db = getFirestore();
    const matches = await db.collection('users').where('email', '==', email).limit(1).get();
    if (matches.empty) {
        throw new HttpsError('not-found', 'No hay ninguna cuenta con ese correo.');
    }

    const snapshot = matches.docs[0];
    const data = snapshot.data();
    logger.info(`adminLookupUser: ${request.auth?.uid} consultó ${email}`);

    let usedStorage: number | null = null;
    if (data.partnerId) {
        const relationshipId = [snapshot.id, data.partnerId].sort().join('_');
        const relationship = await db.collection('relationships').doc(relationshipId).get();
        usedStorage = (relationship.data()?.usedStorage as number) ?? 0;
    }

    return {
        uid: snapshot.id,
        plan: data.plan ?? 'free',
        createdAt: (data.createdAt as Timestamp | undefined)?.toDate().toISOString() ?? null,
        isPaired: !!data.partnerId,
        founderNumber: data.founderNumber ?? null,
        usedStorage,
    };
});
