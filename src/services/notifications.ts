// Notificaciones: recordatorios locales de eventos (Sprint 5, sesión 5.1)
// y registro del token para push remoto (sesión 5.2).
//
// Los recordatorios de evento no necesitan backend: son una notificación
// programada en el propio dispositivo del autor, vía expo-notifications.
//
// Límite conocido y aceptado: si el autor edita o borra el evento desde un
// dispositivo distinto al que programó la notificación, ese otro
// dispositivo no puede cancelarla (las notificaciones locales no se
// sincronizan entre teléfonos).
//
// El push remoto (avisar a LA PAREJA de un mensaje nuevo o un "te extraño")
// sí necesita backend: este archivo solo registra el token de Expo Push en
// el perfil del usuario; quien lo envía es la Cloud Function en
// functions/src/index.ts, disparada al crearse el mensaje o el "ping".
//
// registerPushToken() requiere que el proyecto tenga un ID de EAS
// configurado (correr 'eas init' una vez, gratis, no depende de Play
// Console ni App Store) — sin eso, expo-notifications no puede pedir un
// token remoto y la función se limita a no hacer nada.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

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

/**
 * Pide permiso, obtiene el token de Expo Push de este dispositivo y lo
 * guarda en users/{uid}.expoPushToken para que la Cloud Function pueda
 * avisarle a la pareja. Sin permiso concedido, o sin un projectId de EAS
 * configurado (app.json -> extra.eas.projectId, vía 'eas init'), no hace
 * nada — no rompe la app, solo deja el push remoto sin activar.
 */
export const registerPushToken = async (uid: string): Promise<void> => {
    const granted = await ensureNotificationPermissions();
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        console.log('Push remoto: falta el projectId de EAS (correr "eas init"). Se omite el registro de token.');
        return;
    }

    try {
        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        await updateDoc(doc(db, 'users', uid), { expoPushToken: token });
    } catch (error) {
        console.error('Error registrando el token de push:', error);
    }
};
