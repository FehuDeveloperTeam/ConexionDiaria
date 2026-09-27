// Lógica pura de los avisos — Sprint 10.3a.
//
// Sin Firebase ni nada del entorno: decide QUIÉN recibe un aviso, CUÁNDO toca
// y QUÉ dice, y nada más. Las funciones que leen la base y mandan el push
// (reminders.ts y dateAlerts.ts) solo le preguntan a este módulo. Así lo que
// de verdad puede salir mal —un cumpleaños que avisa el día equivocado, un
// recordatorio que le llega a quien no lo pidió— queda cubierto por
// tests/reminderLogic.test.mjs sin levantar emuladores.
//
// Todo se calcula en hora de Chile y NUNCA con la zona del proceso: Cloud
// Functions corre en UTC, y una fecha guardada como "medianoche del 5 de
// marzo en Chile" es, en UTC, las 03:00 o las 04:00 del 5 de marzo. Leerla con
// getDate() en el servidor funciona por casualidad; con getUTCDate() de una
// fecha que alguien guardó de noche, falla. Por eso las pruebas corren con
// TZ=UTC: es el entorno real.

export const TZ = 'America/Santiago';

// --- Recordatorios de eventos ---

// A quién avisa un evento. Lo elige quien lo crea.
export type NotifyTarget = 'me' | 'partner' | 'both';
export const NOTIFY_TARGETS: readonly NotifyTarget[] = ['me', 'partner', 'both'];

export const isNotifyTarget = (value: unknown): value is NotifyTarget =>
    typeof value === 'string' && (NOTIFY_TARGETS as readonly string[]).includes(value);

// Con cuánta anticipación, en minutos: a la hora, 15 minutos, 1 hora, 1 día
// o 1 semana antes. Son opciones fijas y no un número libre porque el
// servidor tiene que poder confiar en el valor sin validar rangos raros, y
// porque "37 minutos antes" no es algo que nadie necesite.
//
// OJO: la misma lista vive en el cliente (src/config/reminders.ts) y en
// firestore.rules. Si cambia, cambia en los tres.
export const REMINDER_LEADS: readonly number[] = [0, 15, 60, 1440, 10080];

export const isReminderLead = (value: unknown): value is number =>
    typeof value === 'number' && REMINDER_LEADS.includes(value);

// Destinatarios de un recordatorio. Sin pareja (se desvincularon después de
// crear el evento), lo que era "para ella" no tiene a quién llegar; lo que
// era "para mí" sí.
export const recipientsFor = (
    notify: NotifyTarget,
    authorUid: string,
    partnerUid: string | null
): string[] => {
    const recipients: string[] = [];
    if (notify === 'me' || notify === 'both') recipients.push(authorUid);
    if ((notify === 'partner' || notify === 'both') && partnerUid && partnerUid !== authorUid) {
        recipients.push(partnerUid);
    }
    return recipients;
};

export const remindAtFor = (eventDate: Date, leadMinutes: number): Date =>
    new Date(eventDate.getTime() - leadMinutes * 60000);

// Cuánto después de su hora todavía vale la pena mandar un recordatorio. Si la
// función estuvo caída una hora, avisar "tu evento empieza ahora" cuando ya
// terminó es peor que no avisar. Lo que pasa este margen se descarta.
export const REMINDER_GRACE_MS = 30 * 60000;

export const isReminderStale = (remindAt: Date, now: Date): boolean =>
    now.getTime() - remindAt.getTime() > REMINDER_GRACE_MS;

// --- Fechas de calendario en hora de Chile ---

// Un día de calendario, sin hora ni zona. Toda la aritmética de días se hace
// sobre esto y no sobre instantes: el día del cambio de hora dura 23 o 25
// horas, y sumar 86.400.000 ms cae en el día equivocado.
export interface CalendarDay { year: number; month: number; day: number }

export const calendarDayInTz = (instant: Date): CalendarDay => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
    return { year: get('year'), month: get('month'), day: get('day') };
};

// Suma días a una fecha de calendario. Date.UTC solo se usa como calculadora
// de calendario —en UTC no hay cambios de hora—, nunca como instante.
export const addDays = (from: CalendarDay, days: number): CalendarDay => {
    const d = new Date(Date.UTC(from.year, from.month - 1, from.day + days));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};

const isLeapYear = (year: number): boolean =>
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// Si una fecha que se repite cada año (cumpleaños, aniversario) cae en ese
// día. El 29 de febrero se celebra el 28 los años no bisiestos: correrlo al 1
// de marzo lo cambiaría de mes, y saltárselo dejaría a alguien sin aviso tres
// años de cada cuatro.
export const annualDateFallsOn = (source: CalendarDay, target: CalendarDay): boolean => {
    if (source.month === 2 && source.day === 29 && !isLeapYear(target.year)) {
        return target.month === 2 && target.day === 28;
    }
    return source.month === target.month && source.day === target.day;
};

// --- Cumpleaños y aniversario ---

// Con cuántos días de anticipación avisa cada plan. Free recibe el aviso del
// mismo día; los de 14 y 7 días antes —los que dan tiempo de preparar algo—
// son Premium. El plan es de la PAREJA: basta con que uno de los dos pague.
export const DATE_ALERT_DAYS_PREMIUM: readonly number[] = [14, 7, 0];
export const DATE_ALERT_DAYS_FREE: readonly number[] = [0];

export const isCouplePremium = (planA: unknown, planB: unknown): boolean =>
    planA === 'premium' || planB === 'premium';

// Cuántos días faltan si hoy corresponde avisar de esa fecha, o null si hoy no
// toca. Mira solo los días de aviso del plan: con free, 7 días antes da null.
export const dueDateAlertDays = (
    source: CalendarDay,
    today: CalendarDay,
    premium: boolean
): number | null => {
    const offsets = premium ? DATE_ALERT_DAYS_PREMIUM : DATE_ALERT_DAYS_FREE;
    for (const offset of offsets) {
        if (annualDateFallsOn(source, addDays(today, offset))) return offset;
    }
    return null;
};

// Años que se cumplen en la fecha que se está anunciando (hoy + días que
// faltan). Cero o menos significa que la relación empieza ese día o después:
// no hay nada que celebrar todavía.
export const anniversaryYearsAt = (
    start: CalendarDay,
    today: CalendarDay,
    daysLeft: number
): number => addDays(today, daysLeft).year - start.year;

const inDays = (daysLeft: number): string =>
    daysLeft === 7 ? 'En una semana' : daysLeft === 14 ? 'En dos semanas' : `En ${daysLeft} días`;

export interface PushText { title: string; body: string }

// El aviso de cumpleaños solo le llega a la pareja: a quien cumple años no hay
// que recordarle su propio cumpleaños.
export const birthdayText = (partnerName: string, daysLeft: number): PushText => {
    const name = partnerName.trim() || 'tu pareja';
    if (daysLeft === 0) {
        return { title: `🎂 Hoy es el cumpleaños de ${name}`, body: 'Sé la primera persona en saludar.' };
    }
    return {
        title: `🎁 ${inDays(daysLeft)} es el cumpleaños de ${name}`,
        body: 'Mira en Conexión Diaria qué le gustaría recibir.',
    };
};

export const anniversaryText = (years: number, daysLeft: number): PushText => {
    const cuantos = `${years} ${years === 1 ? 'año' : 'años'}`;
    if (daysLeft === 0) {
        return { title: `💞 Hoy cumplen ${cuantos} juntos`, body: 'Feliz aniversario.' };
    }
    return {
        title: `💞 ${inDays(daysLeft)} cumplen ${cuantos} juntos`,
        body: 'Todavía hay tiempo de preparar algo.',
    };
};

// --- Texto del recordatorio de un evento ---

// 'h23' y no 'hour12: false': con este último, algunos motores escriben la
// medianoche como "24:00".
const timeInTz = (instant: Date): string =>
    new Intl.DateTimeFormat('es-CL', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .format(instant);

const sameDay = (a: CalendarDay, b: CalendarDay): boolean =>
    a.year === b.year && a.month === b.month && a.day === b.day;

// Cuándo es el evento, dicho desde el momento en que llega el aviso. Se
// calcula con lo que falta DE VERDAD y no con la anticipación elegida: si el
// aviso sale unos minutos tarde, o se editó la hora del evento, el texto
// sigue diciendo la verdad.
export const whenText = (eventDate: Date, now: Date): string => {
    const minutes = Math.round((eventDate.getTime() - now.getTime()) / 60000);
    if (minutes <= 1) return 'Empieza ahora';
    if (minutes < 60) return `Empieza en ${minutes} minutos`;

    const eventDay = calendarDayInTz(eventDate);
    const today = calendarDayInTz(now);
    const hora = timeInTz(eventDate);
    if (sameDay(eventDay, today)) return `Hoy a las ${hora}`;
    if (sameDay(eventDay, addDays(today, 1))) return `Mañana a las ${hora}`;

    const fecha = new Intl.DateTimeFormat('es-CL', {
        timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long',
    }).format(eventDate);
    return `El ${fecha} a las ${hora}`;
};
