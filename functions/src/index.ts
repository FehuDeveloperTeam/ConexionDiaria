// Webhook de RevenueCat — Sprint 3, sesión 3.2.
//
// Por qué existe: antes, el teléfono escribía 'plan: premium' en su propio
// documento justo después de una compra en RevenueCat. Como las reglas de
// Firestore le permiten a cada usuario editar su propio perfil, cualquiera
// podía llamar a esa misma escritura sin haber pagado nunca. Firestore no
// puede validar "¿de verdad pagaste?" — solo RevenueCat lo sabe.
//
// Esta función es la única que puede escribir 'plan' y 'premiumSince' en
// users/{uid}: usa el Admin SDK, que no pasa por las reglas de seguridad
// (ver firestore.rules, función touchesLockedFields()). RevenueCat le avisa
// a esta URL cada vez que alguien compra, renueva, cambia de producto o se
// le vence la suscripción.
//
// Configuración pendiente (no se puede hacer desde este entorno):
// 1. Desplegar: firebase deploy --only functions (requiere el proyecto en
//    plan Blaze, ya activado en el Sprint 0).
// 2. Guardar el secreto compartido:
//    firebase functions:secrets:set REVENUECAT_WEBHOOK_SECRET
//    (pide un valor — inventa uno largo y random, ej. con `openssl rand -hex 32`)
// 3. En el dashboard de RevenueCat: Project Settings → Integrations →
//    Webhooks → pegar la URL que imprime el deploy, y en
//    "Authorization header value" pegar el MISMO secreto del paso 2.
// 4. Confirmar que el Entitlement se llame exactamente 'premium_entitlement'
//    en RevenueCat (o cambiar la constante PREMIUM_ENTITLEMENT_ID de abajo
//    para que coincida con el que ya se usa en app/(tabs)/config.tsx).

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { timingSafeEqual } from 'crypto';
import { recordPremiumGranted, recordPremiumRevoked } from './adminMetrics';

initializeApp();
const db = getFirestore();

// Push remoto a la pareja (Sprint 5.2) — ver functions/src/pushNotifications.ts.
export { onNewChatMessage, onNewMissYouPing } from './pushNotifications';

// Emparejamiento con código verificado en el servidor (F-02) — ver
// functions/src/pairing.ts.
export { pairWithCode } from './pairing';

// Recepción de errores del cliente (Sprint 11.1) — ver functions/src/errorLog.ts.
export { reportClientError } from './errorLog';

// Panel administrativo (Sprint 10.1) — métricas agregadas y ficha de soporte.
export {
  onUserProfileCreated, aggregateDailyMetrics, adminLookupUser,
} from './adminMetrics';

// Reacciones y comentarios del álbum (Sprint 9.27) — contadores y avisos.
export {
  onPhotoCommentCreated, onPhotoCommentDeleted,
  onPhotoReactionCreated, onPhotoReactionDeleted,
} from './albumActivity';

// Contabilidad de almacenamiento del plan gratuito (F-04, F-05) — ver
// functions/src/storageAccounting.ts.
export { onStorageObjectFinalized, onStorageObjectDeleted } from './storageAccounting';

const REVENUECAT_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

// Debe coincidir con el identificador de Entitlement en el dashboard de
// RevenueCat y con app/(tabs)/config.tsx.
const PREMIUM_ENTITLEMENT_ID = 'premium_entitlement';

// --- Contador de fundadores (Sprint 9.17) ---
//
// Los primeros 500 en pagar se llevan el precio de fundador para siempre. El
// cupo se reparte ACÁ y en ninguna otra parte: en el cliente, el contador
// sería una variable que cualquiera puede dejar en 499 para siempre.
//
// Vive en appConfig/founders, que el cliente puede leer (para mostrar
// "quedan 340 cupos") pero no escribir: la regla de Firestore le prohíbe
// cualquier escritura, y esta función usa el Admin SDK, que no pasa por las
// reglas.
const FOUNDERS_DOC = 'appConfig/founders';
const DEFAULT_FOUNDER_LIMIT = 500;

// Entrega el premium y, si corresponde, un número de fundador. Todo en una
// transacción: sin ella, dos compras simultáneas en el cupo 500 leerían el
// mismo contador y se irían las dos con el mismo número.
//
// El número se otorga UNA vez por cuenta. Quien ya lo tiene y vuelve a
// suscribirse no consume otro cupo, y quien se da de baja no lo devuelve: el
// cupo se gastó cuando pagó, y la cohorte fundadora no se recicla.
async function grantPremium(uid: string): Promise<{ founderNumber: number | null; wasNew: boolean }> {
  const userRef = db.collection('users').doc(uid);
  const foundersRef = db.doc(FOUNDERS_DOC);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { founderNumber: null, wasNew: false };

    const userData = userSnap.data() ?? {};
    const alreadyPremium = userData.plan === 'premium';
    const existingFounderNumber: number | null = userData.founderNumber ?? null;

    const foundersSnap = await tx.get(foundersRef);
    const foundersData = foundersSnap.data() ?? {};
    const claimed: number = foundersData.claimed ?? 0;
    // El tope es un dato, no una constante compilada: si algún día se decide
    // abrir 100 cupos más, se cambia el documento y no hay que desplegar.
    const limit: number = foundersData.limit ?? DEFAULT_FOUNDER_LIMIT;

    let founderNumber = existingFounderNumber;
    if (founderNumber === null && claimed < limit) {
      founderNumber = claimed + 1;
      tx.set(
        foundersRef,
        { claimed: founderNumber, limit, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    tx.update(userRef, {
      plan: 'premium',
      // No pisar 'premiumSince' si ya era premium (renovación, cambio de
      // producto, etc.): es la fecha desde la que ESTA cuenta paga, no la
      // del último evento.
      ...(alreadyPremium ? {} : { premiumSince: FieldValue.serverTimestamp() }),
      ...(founderNumber !== existingFounderNumber ? { founderNumber } : {}),
    });

    return { founderNumber, wasNew: !alreadyPremium };
  });
}

// Eventos que otorgan el entitlement premium.
const GRANTING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'TRANSFER',
]);

// Eventos que lo revocan. OJO: 'CANCELLATION' y 'BILLING_ISSUE' NO están
// acá a propósito — cancelar no corta el acceso de inmediato (sigue activo
// hasta el fin del período ya pagado), y un problema de cobro tiene un
// período de gracia. RevenueCat manda 'EXPIRATION' cuando de verdad se
// acaba el acceso, en ambos casos.
const REVOKING_EVENTS = new Set(['EXPIRATION']);

interface RevenueCatEvent {
  type: string;
  app_user_id: string;
  entitlement_ids?: string[];
}

// F-07: comparar el header contra el secreto con '!==' corta en el primer
// byte distinto, lo que en teoría filtra información por tiempo de
// respuesta. timingSafeEqual() compara siempre el mismo número de bytes —
// pero exige que ambos buffers midan lo mismo, así que ese chequeo va
// primero (con longitudes distintas, timingSafeEqual lanza en vez de
// devolver false).
function isAuthorizedWebhookRequest(receivedHeader: string | undefined, expectedSecret: string): boolean {
  if (!receivedHeader) return false;

  const received = Buffer.from(receivedHeader);
  const expected = Buffer.from(expectedSecret);
  if (received.length !== expected.length) return false;

  return timingSafeEqual(received, expected);
}

export const revenuecatWebhook = onRequest(
  { secrets: [REVENUECAT_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    if (!isAuthorizedWebhookRequest(req.get('Authorization'), REVENUECAT_WEBHOOK_SECRET.value())) {
      logger.warn('revenuecatWebhook: Authorization ausente o inválido');
      res.status(401).send('Unauthorized');
      return;
    }

    const event = req.body?.event as RevenueCatEvent | undefined;
    if (!event || typeof event.app_user_id !== 'string' || typeof event.type !== 'string') {
      logger.error('revenuecatWebhook: payload con forma inesperada', { body: req.body });
      res.status(400).send('Bad Request');
      return;
    }

    const uid = event.app_user_id;
    const entitlementIds = event.entitlement_ids ?? [];

    if (!entitlementIds.includes(PREMIUM_ENTITLEMENT_ID)) {
      logger.info(`revenuecatWebhook: evento ${event.type} no toca ${PREMIUM_ENTITLEMENT_ID}, se ignora`, { uid });
      res.status(200).send('Ignored: unrelated entitlement');
      return;
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      // Puede pasar con eventos de prueba desde el dashboard de RevenueCat
      // usando un app_user_id que no existe en nuestra base. No es un error
      // de la función, así que se responde 200 para que RevenueCat no reintente.
      logger.warn(`revenuecatWebhook: no existe users/${uid}`, { eventType: event.type });
      res.status(200).send('Ignored: unknown user');
      return;
    }

    if (GRANTING_EVENTS.has(event.type)) {
      const { founderNumber, wasNew } = await grantPremium(uid);
      // Solo se cuenta el alta. Una renovación mensual no es un suscriptor
      // nuevo, y contarla inflaría el número cada mes.
      if (wasNew) await recordPremiumGranted();
      logger.info(
        `revenuecatWebhook: ${uid} -> premium (${event.type})`,
        founderNumber !== null ? { founderNumber } : { founder: false }
      );
    } else if (REVOKING_EVENTS.has(event.type)) {
      const wasPremium = userSnap.data()?.plan === 'premium';
      await userRef.update({ plan: 'free', premiumSince: null });
      if (wasPremium) await recordPremiumRevoked();
      logger.info(`revenuecatWebhook: ${uid} -> free (${event.type})`);
    } else {
      logger.info(`revenuecatWebhook: evento ${event.type} recibido, sin acción`, { uid });
    }

    res.status(200).send('OK');
  }
);
