// Embudo de conversión por cohorte — Sprint 11.4.
//
// El panel medía actividad (mensajes, fotos, activos) pero no conversión, que
// es lo único que dice si el negocio funciona. Los 500 cupos de fundador son un
// activo de una sola vez: gastarlos sin saber qué porcentaje de las cuentas
// llega a emparejarse y cuántas de esas pagan es el único error del plan que
// no se puede deshacer.
//
// LO QUE ESTE EMBUDO NO PUEDE MEDIR: las descargas. Ese dato vive en App Store
// Connect y en Play Console, no en Firestore, y no hay forma honesta de
// inferirlo desde acá. El embudo empieza donde empiezan nuestros datos —la
// cuenta creada— y el panel lo dice explícitamente en vez de dejar creer que
// está completo.
//
//   cuentas creadas -> emparejadas -> premium
//
// Cohorte = mes de registro. Es la unidad correcta: preguntar "qué porcentaje
// de los usuarios paga" mezcla a quien se registró ayer con quien lleva un año,
// y da un número que siempre parece malo cuando la app crece.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { dateKeyInTz, startOfDayInTz } from './adminMetrics';

const COHORTS_COLLECTION = 'adminCohorts';

// Solo se recalculan las cohortes que todavía pueden cambiar. Una de hace dos
// años ya no se mueve, y recalcular todas cada día costaría más lecturas cada
// día que pasa.
const MESES_A_RECALCULAR = 6;

// Primer día del mes al que pertenece esa fecha, en hora chilena.
const inicioDeMes = (dateKey: string): Date => {
    const [year, month] = dateKey.split('-').map(Number);
    return startOfDayInTz(`${year}-${String(month).padStart(2, '0')}-01`);
};

const mesAnterior = (dateKey: string): string => {
    const [year, month] = dateKey.split('-').map(Number);
    return month === 1
        ? `${year - 1}-12`
        : `${year}-${String(month - 1).padStart(2, '0')}`;
};

const mediana = (valores: number[]): number | null => {
    if (valores.length === 0) return null;
    const orden = [...valores].sort((a, b) => a - b);
    const medio = Math.floor(orden.length / 2);
    return orden.length % 2 === 1
        ? orden[medio]
        : Math.round((orden[medio - 1] + orden[medio]) / 2);
};

const DIA_MS = 86_400_000;

// Calcula y guarda una cohorte. Se leen los documentos completos en vez de usar
// count(): a este volumen son centavos, y permite medir además CUÁNTO tardan en
// emparejarse, que es lo que dice si el problema está en el producto o en el
// tráfico.
const calcularCohorte = async (mesKey: string): Promise<void> => {
    const db = getFirestore();
    const desde = inicioDeMes(`${mesKey}-01`);
    const [year, month] = mesKey.split('-').map(Number);
    const hasta = month === 12
        ? inicioDeMes(`${year + 1}-01-01`)
        : inicioDeMes(`${year}-${String(month + 1).padStart(2, '0')}-01`);

    const snapshot = await db
        .collection('users')
        .where('createdAt', '>=', Timestamp.fromDate(desde))
        .where('createdAt', '<', Timestamp.fromDate(hasta))
        .get();

    let paired = 0;
    let premium = 0;
    let withBirthDate = 0;
    let onboarded = 0;
    const diasHastaEmparejar: number[] = [];

    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.partnerId) paired++;
        if (data.plan === 'premium') premium++;
        if (data.birthDate) withBirthDate++;
        if (data.onboardedAt) onboarded++;

        // Cuánto tardó en emparejarse. 'onboardedAt' es la marca más cercana
        // que tenemos al momento del emparejamiento: la bienvenida se muestra
        // justo ahí. No es exacto —se puede saltar y verse después— pero es la
        // única señal temporal disponible sin agregar un campo nuevo.
        const creado = (data.createdAt as Timestamp | undefined)?.toMillis();
        const emparejado = (data.onboardedAt as Timestamp | undefined)?.toMillis();
        if (creado && emparejado && emparejado >= creado) {
            diasHastaEmparejar.push(Math.round((emparejado - creado) / DIA_MS));
        }
    });

    await db.collection(COHORTS_COLLECTION).doc(mesKey).set(
        {
            month: mesKey,
            signups: snapshot.size,
            paired,
            premium,
            withBirthDate,
            onboarded,
            medianDaysToPair: mediana(diasHastaEmparejar),
            computedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
};

export const aggregateCohorts = onSchedule(
    // Una hora después del resumen diario, para no pelear por las mismas
    // lecturas ni confundir los registros si algo falla.
    { schedule: '30 1 * * *', timeZone: 'America/Santiago' },
    async () => {
        let mesKey = dateKeyInTz(new Date()).slice(0, 7);

        for (let i = 0; i < MESES_A_RECALCULAR; i++) {
            try {
                await calcularCohorte(mesKey);
            } catch (error) {
                // Que falle una cohorte no puede dejar sin calcular las otras:
                // la del mes en curso es la que más importa.
                logger.error(`No se pudo calcular la cohorte ${mesKey}`, error);
            }
            mesKey = mesAnterior(mesKey);
        }

        logger.info(`Cohortes recalculadas: ${MESES_A_RECALCULAR} meses`);
    }
);
