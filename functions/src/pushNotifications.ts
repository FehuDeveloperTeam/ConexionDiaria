// Push remoto a la pareja — Sprint 5, sesión 5.2 (primera mitad: mensajes
// nuevos y "te extraño"; el recordatorio compartido de un evento queda para
// una sesión aparte, porque necesita dispararse a una hora futura en vez de
// al crearse un documento, y eso pide un poller programado, no un trigger).
//
// Cómo funciona: el teléfono de cada usuario guarda su token de Expo Push en
// users/{uid}.expoPushToken (ver src/services/notifications.ts en el
// cliente). Estas funciones escuchan la creación de un mensaje de chat o de
// un "ping" de "te extraño", buscan el token de LA OTRA persona de la
// relación, y le mandan un push a la API de Expo — sin pasar por FCM/APNs
// directamente, Expo se encarga de eso.
//
// Nada de esto dispara nada si el destinatario no tiene token guardado
// (nunca abrió la app en un build con notificaciones, no dio permiso, o el
// proyecto todavía no tiene un projectId de EAS) — la función simplemente
// no hace nada, no falla.

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const sendExpoPush = async (message: ExpoPushMessage): Promise<void> => {
  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(message),
    });
    const result = await response.json() as { data?: { status?: string; message?: string } };
    if (result?.data?.status === 'error') {
      logger.warn('Push de Expo rechazado', result.data);
    }
  } catch (error) {
    logger.error('Error enviando push a Expo', error);
  }
};

// El id de la relación es 'uid1_uid2' (ordenados) — la pareja del autor es
// el otro de los dos.
const partnerUidFromRelationshipId = (relationshipId: string, authorUid: string): string | null => {
  const [a, b] = relationshipId.split('_');
  if (a === authorUid) return b ?? null;
  if (b === authorUid) return a ?? null;
  return null;
};

/**
 * Busca el token de push de un usuario, respetando su preferencia para
 * este tipo de aviso (default: recibirlo, si nunca la configuró).
 */
const getPushTargetIfAllowed = async (
  uid: string,
  prefKey: 'newMessages' | 'missYou'
): Promise<string | null> => {
  const snap = await getFirestore().collection('users').doc(uid).get();
  const data = snap.data();
  const token = data?.expoPushToken as string | undefined;
  if (!token) return null;

  const allowed = data?.notificationPrefs?.[prefKey] !== false;
  if (!allowed) return null;

  return token;
};

export const onNewChatMessage = onDocumentCreated(
  'relationships/{relationshipId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const authorUid = message.user?._id as string | undefined;
    if (!authorUid) return;

    const relationshipId = event.params.relationshipId;
    const partnerUid = partnerUidFromRelationshipId(relationshipId, authorUid);
    if (!partnerUid) return;

    const token = await getPushTargetIfAllowed(partnerUid, 'newMessages');
    if (!token) return;

    let body = 'Nuevo mensaje';
    if (message.text) body = message.text;
    else if (message.image) body = '📷 Foto';
    else if (message.audio) body = '🎤 Nota de voz';
    else if (message.file) body = `📎 ${message.fileName || 'Archivo'}`;

    await sendExpoPush({
      to: token,
      title: message.user?.name || 'Tu pareja',
      body,
      data: { type: 'chat_message', relationshipId },
    });
  }
);

export const onNewMissYouPing = onDocumentCreated(
  'relationships/{relationshipId}/missYouPings/{pingId}',
  async (event) => {
    const ping = event.data?.data();
    if (!ping) return;

    const fromUid = ping.from as string | undefined;
    if (!fromUid) return;

    const relationshipId = event.params.relationshipId;
    const partnerUid = partnerUidFromRelationshipId(relationshipId, fromUid);
    if (!partnerUid) return;

    const token = await getPushTargetIfAllowed(partnerUid, 'missYou');
    if (!token) return;

    await sendExpoPush({
      to: token,
      title: '💗 Te extrañan',
      body: 'Tu pareja te mandó un "te extraño"',
      data: { type: 'miss_you', relationshipId },
    });
  }
);
