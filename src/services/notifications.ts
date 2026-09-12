// Recordatorios locales de eventos del calendario (Sprint 5, sesión 5.1).
//
// No hay backend involucrado: es una notificación programada en el propio
// dispositivo del autor del evento, vía expo-notifications. Por eso no
// depende de que Blaze o las Cloud Functions estén listas.
//
// Límite conocido y aceptado: si el autor edita o borra el evento desde un
// dispositivo distinto al que programó la notificación, ese otro
// dispositivo no puede cancelarla (las notificaciones locales no se
// sincronizan entre teléfonos). Avisar también a la pareja, o resolver esto
// con push remoto, es la sesión 5.2.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Pide permiso de notificaciones si todavía no se concedió, y en Android
 * asegura el canal 'default'. Devuelve false si el usuario lo negó.
 */
export const ensureNotificationPermissions = async (): Promise<boolean> => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') return false;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return true;
};

/**
 * Programa una notificación local para la fecha exacta del evento. Devuelve
 * el id de la notificación programada (para poder cancelarla después), o
 * null si no se programó nada — sin permiso, o porque la fecha ya pasó.
 */
export const scheduleEventReminder = async (
    title: string,
    body: string,
    date: Date
): Promise<string | null> => {
    if (date.getTime() <= Date.now()) return null;

    const granted = await ensureNotificationPermissions();
    if (!granted) return null;

    return Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date,
        },
    });
};

/** Cancela una notificación ya programada. No hace nada si no hay id. */
export const cancelEventReminder = async (notificationId?: string | null): Promise<void> => {
    if (!notificationId) return;
    try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
        console.error('Error cancelando recordatorio:', error);
    }
};
