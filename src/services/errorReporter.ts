// Reporte de errores — Sprint 11.1.
//
// El problema que resuelve: había 101 llamadas a console.error en la app y
// ninguna llegaba a ninguna parte. Un error en el teléfono de otra persona
// era invisible; uno se enteraba solo si esa persona escribía, y la mayoría
// no escribe: desinstala.
//
// El destino es intercambiable a propósito. Hoy es una Cloud Function que
// deja el error en Cloud Logging (cero dependencias nuevas, funciona igual en
// web y en móvil). Cambiar a Sentry o Crashlytics más adelante es reemplazar
// el cuerpo de 'send()' de este archivo y nada más: el resto de la app solo
// conoce captureError().
//
// Tres reglas que hacen que esto no pueda empeorar nada:
//   1. Nunca lanza. Un reporte de errores que rompe la app es peor que no
//      tener ninguno.
//   2. Se calla lo repetido. Un error dentro de un render se dispara en bucle
//      y sin esto llenaría Cloud Logging en segundos.
//   3. Tiene tope por sesión. Ni el peor bucle puede generar una factura.
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getFunctions, httpsCallable } from 'firebase/functions';

export interface ErrorContext {
    // Dónde ocurrió: 'render', 'unhandled', 'promise', o el nombre de la
    // operación ('subirFoto', 'comprarPremium'…). Es lo que después se filtra
    // en Cloud Logging, así que conviene que sea corto y estable.
    origin?: string;
    fatal?: boolean;
    // Datos planos que ayuden a reproducirlo. NUNCA contenido de la pareja:
    // esto sale del dispositivo y queda en los registros del proyecto.
    context?: Record<string, string | number | boolean>;
}

const MAX_PER_SESSION = 20;
const DEDUPE_MS = 60_000;

let sent = 0;
const lastSeen = new Map<string, number>();

const appVersion = Constants.expoConfig?.version ?? 'desconocida';

const send = async (payload: Record<string, unknown>): Promise<void> => {
    const callable = httpsCallable(getFunctions(), 'reportClientError');
    await callable(payload);
};

export const captureError = (error: unknown, options: ErrorContext = {}): void => {
    try {
        const message = error instanceof Error
            ? error.message
            : typeof error === 'string' ? error : JSON.stringify(error)?.slice(0, 500);
        if (!message) return;

        const origin = options.origin ?? 'desconocido';
        const key = `${origin}|${message}`;
        const now = Date.now();

        const previous = lastSeen.get(key);
        if (previous && now - previous < DEDUPE_MS) return;
        lastSeen.set(key, now);

        if (sent >= MAX_PER_SESSION) return;
        sent++;

        // En desarrollo no se manda nada: el error ya se ve en la consola y
        // ensuciar los registros de producción con pruebas locales hace que
        // dejen de servir.
        if (__DEV__) {
            console.error(`[${origin}]`, error);
            return;
        }

        void send({
            message,
            stack: error instanceof Error ? error.stack : undefined,
            origin,
            fatal: options.fatal === true,
            platform: `${Platform.OS} ${Platform.Version ?? ''}`.trim(),
            appVersion,
            context: options.context,
        }).catch(() => {
            // Si el reporte no sale, no hay nada más que hacer: insistir
            // podría ser justamente lo que está fallando.
        });
    } catch {
        // Ídem. Este módulo no puede ser la causa de un problema.
    }
};

// Engancha los errores que nadie atrapó. Es lo que de verdad cambia la
// visibilidad: los try/catch existentes cubren lo previsto, y esto cubre lo
// que no.
export const initErrorReporting = (): void => {
    try {
        if (Platform.OS === 'web') {
            const w = globalThis as unknown as {
                addEventListener?: (t: string, h: (e: any) => void) => void;
            };
            w.addEventListener?.('error', (event: any) => {
                captureError(event?.error ?? event?.message, { origin: 'unhandled', fatal: true });
            });
            w.addEventListener?.('unhandledrejection', (event: any) => {
                captureError(event?.reason, { origin: 'promise' });
            });
            return;
        }

        // En nativo el equivalente es el manejador global de React Native. Se
        // conserva el que ya estuviera puesto y se llama después, para no
        // quitarle a la plataforma su propia pantalla de error.
        const errorUtils = (globalThis as unknown as {
            ErrorUtils?: {
                getGlobalHandler: () => (e: unknown, fatal?: boolean) => void;
                setGlobalHandler: (h: (e: unknown, fatal?: boolean) => void) => void;
            };
        }).ErrorUtils;

        if (!errorUtils) return;
        const previous = errorUtils.getGlobalHandler();
        errorUtils.setGlobalHandler((error: unknown, fatal?: boolean) => {
            captureError(error, { origin: 'unhandled', fatal: fatal === true });
            previous?.(error, fatal);
        });
    } catch {
        // Ídem.
    }
};
