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

initializeApp();
const db = getFirestore();

// Push remoto a la pareja (Sprint 5.2) — ver functions/src/pushNotifications.ts.
export { onNewChatMessage, onNewMissYouPing } from './pushNotifications';

const REVENUECAT_WEBHOOK_SECRET = defineSecret('REVENUECAT_WEBHOOK_SECRET');

// Debe coincidir con el identificador de Entitlement en el dashboard de
// RevenueCat y con app/(tabs)/config.tsx.
const PREMIUM_ENTITLEMENT_ID = 'premium_entitlement';

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

export const revenuecatWebhook = onRequest(
  { secrets: [REVENUECAT_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const authHeader = req.get('Authorization');
    if (!authHeader || authHeader !== REVENUECAT_WEBHOOK_SECRET.value()) {
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
      const alreadyPremium = userSnap.data()?.plan === 'premium';
      await userRef.update({
        plan: 'premium',
        // No pisar 'premiumSince' si ya era premium (renovación, cambio de
        // producto, etc.): es la fecha desde la que ESTA cuenta paga, no la
        // del último evento.
        ...(alreadyPremium ? {} : { premiumSince: FieldValue.serverTimestamp() }),
      });
      logger.info(`revenuecatWebhook: ${uid} -> premium (${event.type})`);
    } else if (REVOKING_EVENTS.has(event.type)) {
      await userRef.update({ plan: 'free', premiumSince: null });
      logger.info(`revenuecatWebhook: ${uid} -> free (${event.type})`);
    } else {
      logger.info(`revenuecatWebhook: evento ${event.type} recibido, sin acción`, { uid });
    }

    res.status(200).send('OK');
  }
);
