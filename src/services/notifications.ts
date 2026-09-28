// Notificaciones del lado de la app: permiso y registro del token de push
// (Sprint 5.2), y la cancelación de los recordatorios locales que quedaron
// de antes del Sprint 10.3.
//
// Los recordatorios de eventos ya NO se programan en el teléfono. Hasta el
// 10.3 eran una notificación local en el aparato del autor: sonaba solo ahí,
// la pareja nunca se enteraba, y si se editaba el evento desde otro teléfono
// el aviso viejo no se podía cancelar. Ahora los manda el servidor
// (functions/src/reminders.ts) a quien corresponda. Lo único que queda de
// aquello es cancelEventReminder(), para los eventos antiguos que todavía
// tienen una notificación local programada en este teléfono.
//
// Todo el push —mensajes, "te extraño", álbum, recordatorios, cumpleaños y
// aniversario— lo envían Cloud Functions. Este archivo solo registra el
// token de Expo Push del dispositivo; sin token, al usuario no le llega nada.
//
// registerPushToken() requiere que el proyecto tenga un ID de EAS
// configurado (correr 'eas init' una vez, gratis, no depende de Play
// Console ni App Store) — sin eso, expo-notifications no puede pedir un
// token remoto y la función se limita a no hacer nada.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';
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
 * Cancela una notificación local programada antes del Sprint 10.3. Solo
 * funciona en el teléfono que la programó: desde otro, el id no existe y no
 * hace nada. No hace nada tampoco si no hay id.
 */
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
 * guarda en users/{uid}/private/push para que la Cloud Function pueda
 * avisarle a la pareja. Sin permiso concedido, o sin un projectId de EAS
 * configurado (app.json -> extra.eas.projectId, vía 'eas init'), no hace
 * nada — no rompe la app, solo deja el push remoto sin activar.
 *
 * F-06: el token vive en una subcolección privada, no en el perfil — ni
 * siquiera la pareja puede leerla (ver firestore.rules). Antes vivía en
 * users/{uid}.expoPushToken, legible por la pareja, y la API de push de
 * Expo acepta cualquier token válido sin autenticación: quien lo tuviera
 * podía mandar notificaciones que parecían de la app.
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
        await setDoc(doc(db, 'users', uid, 'private', 'push'), { expoPushToken: token }, { merge: true });
    } catch (error) {
        console.error('Error registrando el token de push:', error);
    }
};
