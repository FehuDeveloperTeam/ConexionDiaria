// Recordatorios de eventos desde el servidor — Sprint 10.3b.
//
// Antes el recordatorio era una notificación LOCAL que programaba el teléfono
// del autor: sonaba solo en ese aparato, la pareja nunca se enteraba, y si se
// editaba el evento desde otro dispositivo el aviso viejo no se podía
// cancelar. Ahora el evento guarda a quién avisar y con cuánta anticipación,
// y esta función lo manda a quien corresponda.
//
// Cómo funciona: cada minuto busca los eventos con reminderStatus 'pending'
// cuya hora de aviso (remindAt) ya llegó. El cliente escribe remindAt y las
// reglas comprueban que sea exactamente la hora del evento menos la
// anticipación elegida (firestore.rules, "validEventReminder"), así que acá
// se puede confiar en el valor.
//
// Por qué un barrido cada minuto y no una tarea programada por evento (Cloud
// Tasks): con tareas, editar o borrar un evento obliga a encontrar y cancelar
// la tarea vieja, que es justo el problema que tenían las notificaciones
// locales. Con el barrido, editar el evento corrige el aviso solo. El costo
// es un minuto de precisión, y cabe holgado en el nivel gratuito.
//
// Qué hacer con cada recordatorio lo decide decideReminder()
// (reminderLogic.ts), que tiene sus propias pruebas. Esto solo lee, marca y
// manda.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp, DocumentReference } from 'firebase-admin/firestore';
import { decideReminder, whenText, ReminderDecision } from './reminderLogic';
import { getPushTargetIfAllowed, partnerUidFromRelationshipId, sendExpoPush } from './pushNotifications';

// Tope por pasada. Con más pendientes que esto, la pasada siguiente —un minuto
// después— sigue donde quedó: van ordenados por hora de aviso.
const BATCH_SIZE = 200;

type ReminderStatus = 'sent' | 'expired' | 'skipped';

const statusFor = (decision: ReminderDecision): ReminderStatus =>
  decision.action === 'send' ? 'sent' : decision.action === 'expire' ? 'expired' : 'skipped';

interface Claimed {
  decision: ReminderDecision;
  title: string;
  eventDate: Date;
  relationshipId: string;
}

// Decide y marca el recordatorio en una transacción, ANTES de mandar nada. Si
// dos pasadas se cruzaran, la segunda lo encuentra ya marcado y no hace nada:
// preferimos que un aviso se pierda por una caída a que llegue dos veces.
const claimReminder = async (ref: DocumentReference, now: Date): Promise<Claimed | null> => {
  const db = getFirestore();
  const relationshipId = ref.parent.parent?.id;
  if (!relationshipId) return null;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const event = snap.data();
    if (!event || event.reminderStatus !== 'pending') return null;

    const remindAt = (event.remindAt as Timestamp | undefined)?.toDate();
    const eventDate = (event.dateTime as Timestamp | undefined)?.toDate();
    const authorUid = event.authorId as string | undefined;
    if (!remindAt || !eventDate || !authorUid) {
      tx.update(ref, { reminderStatus: 'skipped', reminderProcessedAt: Timestamp.fromDate(now) });
      return null;
    }

    const relationshipPartnerUid = partnerUidFromRelationshipId(relationshipId, authorUid);
    const [authorSnap, partnerSnap] = await Promise.all([
      tx.get(db.collection('users').doc(authorUid)),
      relationshipPartnerUid
        ? tx.get(db.collection('users').doc(relationshipPartnerUid))
        : Promise.resolve(null),
    ]);

    const decision = decideReminder({
      notify: event.notify,
      authorUid,
      relationshipPartnerUid,
      authorCurrentPartnerId: authorSnap.data()?.partnerId,
      authorPlan: authorSnap.data()?.plan,
      partnerPlan: partnerSnap?.data()?.plan,
      remindAt,
      now,
    });

    tx.update(ref, {
      reminderStatus: statusFor(decision),
      reminderProcessedAt: Timestamp.fromDate(now),
    });

    return { decision, title: String(event.title ?? 'Evento'), eventDate, relationshipId };
  });
};

const deliver = async (ref: DocumentReference, claimed: Claimed, now: Date): Promise<void> => {
  if (claimed.decision.action !== 'send') return;

  const body = whenText(claimed.eventDate, now);
  await Promise.all(claimed.decision.recipients.map(async (uid) => {
    // Cada quien puede apagar los recordatorios en Ajustes, incluso los que
    // su pareja creó para ella.
    const token = await getPushTargetIfAllowed(uid, 'eventReminders');
    if (!token) return;
    await sendExpoPush({
      to: token,
      title: `🔔 ${claimed.title}`,
      body,
      data: { type: 'event_reminder', relationshipId: claimed.relationshipId, eventId: ref.id },
    });
  }));
};

export const sendDueReminders = onSchedule(
  { schedule: 'every 1 minutes', maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const now = new Date();

    // Necesita el índice compuesto de grupo de colección sobre
    // (reminderStatus, remindAt) — ver firestore.indexes.json.
    const due = await db.collectionGroup('events')
      .where('reminderStatus', '==', 'pending')
      .where('remindAt', '<=', Timestamp.fromDate(now))
      .orderBy('remindAt')
      .limit(BATCH_SIZE)
      .get();

    if (due.empty) return;

    let sent = 0;
    for (const docSnap of due.docs) {
      try {
        const claimed = await claimReminder(docSnap.ref, now);
        if (!claimed) continue;
        await deliver(docSnap.ref, claimed, now);
        if (claimed.decision.action === 'send') sent++;
      } catch (error) {
        // Un evento roto no puede frenar los demás.
        logger.error('Error procesando un recordatorio', { path: docSnap.ref.path, error });
      }
    }

    logger.info('Recordatorios procesados', { pendientes: due.size, enviados: sent });
  }
);
