// Recordatorio de un evento, del lado de la app — Sprint 10.3c.
//
// Lógica pura: qué campos se escriben en el evento según lo que se eligió, y
// cuándo el aviso tiene que volver a quedar pendiente. Lo manda el servidor
// (functions/src/reminders.ts) y las reglas validan lo que se escribe
// (firestore.rules, eventos), así que las tres partes tienen que coincidir.
//
// OJO: la lista de anticipaciones vive también en
// functions/src/reminderLogic.ts y en firestore.rules. Si cambia, cambia en
// los tres. Se duplica a propósito: functions es un proyecto con su propio
// build y no puede importar de acá.

export type NotifyTarget = 'me' | 'partner' | 'both';

export const REMINDER_LEADS = [0, 15, 60, 1440, 10080] as const;

export const LEAD_LABELS: Record<number, string> = {
    0: 'A la hora',
    15: '15 min antes',
    60: '1 hora antes',
    1440: '1 día antes',
    10080: '1 semana antes',
};

// La que viene marcada al activar el aviso. Una hora da tiempo de moverse sin
// que el aviso quede tan lejos que se olvide.
export const DEFAULT_LEAD = 60;

export interface ReminderChoice {
    notify: NotifyTarget | null;
    lead: number;
}

export const remindAtFor = (eventDate: Date, lead: number): Date =>
    new Date(eventDate.getTime() - lead * 60000);

// Una anticipación que ya pasó no se ofrece: para un evento de mañana, "1
// semana antes" fue hace seis días, y el servidor lo descartaría sin avisar.
export const isLeadAvailable = (eventDate: Date, lead: number, now: Date): boolean =>
    remindAtFor(eventDate, lead).getTime() > now.getTime();

// Lo que el evento ya tenía guardado, para decidir si el aviso se rearma.
export interface StoredReminder {
    notify?: NotifyTarget | null;
    reminderLeadMinutes?: number | null;
    remindAt?: Date | null;
    reminderStatus?: string | null;
}

export interface ReminderFields {
    notify: NotifyTarget | null;
    reminderLeadMinutes: number | null;
    remindAt: Date | null;
    reminderStatus: string | null;
}

// Qué escribir en el evento. El aviso vuelve a quedar pendiente solo si
// cambió algo que lo afecta —a quién, cuándo o la hora del evento—. Editar
// solo el título conserva el estado: si ya se envió, no se vuelve a mandar.
// Las reglas exigen lo mismo, así que un error acá no pasaría el guardado.
export const reminderFields = (
    choice: ReminderChoice,
    eventDate: Date,
    previous?: StoredReminder | null
): ReminderFields => {
    if (!choice.notify) {
        return { notify: null, reminderLeadMinutes: null, remindAt: null, reminderStatus: null };
    }

    const remindAt = remindAtFor(eventDate, choice.lead);
    const unchanged =
        !!previous?.reminderStatus &&
        previous.notify === choice.notify &&
        previous.reminderLeadMinutes === choice.lead &&
        previous.remindAt?.getTime() === remindAt.getTime();

    return {
        notify: choice.notify,
        reminderLeadMinutes: choice.lead,
        remindAt,
        reminderStatus: unchanged ? previous!.reminderStatus! : 'pending',
    };
};

// Lo que se muestra seleccionado al abrir un evento para editarlo. Los
// eventos de antes de 10.3 solo tenían 'reminder: true', que era una
// notificación en el teléfono del autor a la hora exacta: el equivalente es
// "a mí, a la hora". Al guardarlo, pasa al sistema nuevo.
export const choiceFromEvent = (event: {
    notify?: NotifyTarget | null;
    reminderLeadMinutes?: number | null;
    reminder?: boolean;
}): ReminderChoice => {
    if (event.notify) {
        return { notify: event.notify, lead: event.reminderLeadMinutes ?? DEFAULT_LEAD };
    }
    if (event.reminder) return { notify: 'me', lead: 0 };
    return { notify: null, lead: DEFAULT_LEAD };
};

export const notifyLabel = (notify: NotifyTarget, partnerName: string): string => {
    const name = partnerName.trim() || 'tu pareja';
    if (notify === 'me') return 'A mí';
    if (notify === 'partner') return `A ${name}`;
    return 'A los dos';
};

// Resumen para el detalle del evento: "Avisa a los dos · 1 hora antes". Se
// escribe desde quien lo lee: si Alice lo creó "para mí", Bob debe leer que
// le avisa a Alice, no "a mí".
export const describeReminder = (
    notify: NotifyTarget,
    lead: number,
    viewerIsAuthor: boolean,
    authorName: string,
    partnerName: string
): string => {
    let who: string;
    if (notify === 'both') who = 'a los dos';
    else if (viewerIsAuthor) who = notify === 'me' ? 'a ti' : `a ${partnerName.trim() || 'tu pareja'}`;
    else who = notify === 'me' ? `a ${authorName.trim() || 'tu pareja'}` : 'a ti';

    const when = (LEAD_LABELS[lead] ?? '').toLowerCase();
    return `Avisa ${who} · ${when}`;
};
