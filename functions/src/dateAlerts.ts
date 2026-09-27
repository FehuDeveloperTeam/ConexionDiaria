// Avisos de cumpleaños y aniversario — Sprint 10.3d.
//
// Todos los días a las 09:00 de Chile revisa a quién le toca aviso y lo
// manda. Qué avisos salen lo decide planDateAlerts() (reminderLogic.ts), que
// tiene sus pruebas; esto solo lee, se asegura de no correr dos veces el
// mismo día y envía.
//
// Lo acordado con el usuario:
//   - el mismo día, para todos;
//   - 7 y 14 días antes, solo Premium (basta con que uno de los dos pague);
//   - el cumpleaños solo le llega a la pareja; el aniversario, a los dos;
//   - cada quien los apaga en Ajustes ('partnerBirthday' y 'anniversary').
//
// Lee a todos los usuarios con pareja una vez al día. A este volumen son
// centavos al mes; si algún día pasa de decenas de miles, conviene guardar
// el "mes-día" de cada fecha y consultar solo los que tocan.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { planDateAlerts, DateAlertUser, TZ } from './reminderLogic';
import { getPushTargetIfAllowed, sendExpoPush } from './pushNotifications';

const RUNS_COLLECTION = 'dateAlertRuns';

const toDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : null;

const todayKey = (now: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(now);

export const sendDateAlerts = onSchedule(
  { schedule: '0 9 * * *', timeZone: TZ, maxInstances: 1 },
  async () => {
    const db = getFirestore();
    const now = new Date();
    const key = todayKey(now);

    // Una sola vez por día. create() falla si el documento ya existe, así
    // que si la función se ejecutara dos veces —un reintento, un disparo
    // manual—, la segunda se detiene acá en vez de repetir los avisos.
    try {
      await db.collection(RUNS_COLLECTION).doc(key).create({ startedAt: Timestamp.fromDate(now) });
    } catch {
      logger.info('Los avisos de fecha de hoy ya se mandaron', { key });
      return;
    }

    const snap = await db.collection('users')
      .where('partnerId', '!=', null)
      .select('partnerId', 'displayName', 'plan', 'birthDate', 'relationshipStartDate')
      .get();

    const users: DateAlertUser[] = snap.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        partnerId: typeof data.partnerId === 'string' ? data.partnerId : null,
        displayName: typeof data.displayName === 'string' ? data.displayName : '',
        plan: data.plan,
        birthDate: toDate(data.birthDate),
        relationshipStartDate: toDate(data.relationshipStartDate),
      };
    });

    const alerts = planDateAlerts(users, now);

    let sent = 0;
    for (const alert of alerts) {
      try {
        const token = await getPushTargetIfAllowed(alert.to, alert.pref);
        if (!token) continue;
        await sendExpoPush({
          to: token,
          title: alert.text.title,
          body: alert.text.body,
          data: { type: alert.kind === 'birthday' ? 'birthday_alert' : 'anniversary_alert', daysLeft: alert.daysLeft },
        });
        sent++;
      } catch (error) {
        // Un aviso que falla no puede frenar los demás.
        logger.error('Error mandando un aviso de fecha', { to: alert.to, kind: alert.kind, error });
      }
    }

    await db.collection(RUNS_COLLECTION).doc(key).update({
      finishedAt: Timestamp.now(), usuarios: users.length, planificados: alerts.length, enviados: sent,
    });
    logger.info('Avisos de fecha', { key, usuarios: users.length, planificados: alerts.length, enviados: sent });
  }
);
