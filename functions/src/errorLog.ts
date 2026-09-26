// Recepción de errores del cliente — Sprint 11.1.
//
// Antes de esto había 101 llamadas a console.error repartidas por la app, y
// ninguna llegaba a ninguna parte: la consola de un teléfono ajeno no la lee
// nadie. Si la app se caía en producción, uno se enteraba solo si la persona
// escribía — y la mayoría no escribe, desinstala.
//
// Esto deja los errores en Cloud Logging, donde sí se pueden buscar, filtrar
// y alertar desde la consola de Firebase, sin agregar ninguna dependencia al
// cliente. Deliberadamente NO es un reemplazo de Sentry o Crashlytics: no
// agrupa, no desminifica pilas de llamadas y no manda alertas por sí solo. Es
// la capa mínima que convierte "no sé qué pasa" en "puedo mirar qué pasó", y
// está detrás de un módulo del cliente con destino intercambiable
// (src/services/errorReporter.ts), así que cambiar a Sentry más adelante es
// reemplazar una pieza, no reescribir la app.

import { onCall } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

// Topes de tamaño. Sin ellos, un error con un objeto gigante adentro se
// convierte en una factura de Cloud Logging.
const MAX_MESSAGE = 500;
const MAX_STACK = 4000;
const MAX_CONTEXT_KEYS = 12;
const MAX_CONTEXT_VALUE = 200;

interface ClientErrorPayload {
  message?: unknown;
  stack?: unknown;
  // Dónde ocurrió: 'render', 'unhandled', 'promise', o el nombre de la
  // operación que falló ('subirFoto', 'guardarTallas'…).
  origin?: unknown;
  fatal?: unknown;
  platform?: unknown;
  appVersion?: unknown;
  context?: unknown;
}

const clip = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  return value.length > max ? `${value.slice(0, max)}…[recortado]` : value;
};

// Solo claves y valores planos, recortados. El contexto lo arma el cliente y
// podría traer cualquier cosa, incluidos datos personales por descuido: acá
// se aplana a texto corto y se descarta todo lo que no sea primitivo.
const sanitizeContext = (raw: unknown): Record<string, string> => {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_CONTEXT_KEYS) break;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') continue;
    out[key.slice(0, 40)] = String(value).slice(0, MAX_CONTEXT_VALUE);
  }
  return out;
};

export const reportClientError = onCall<ClientErrorPayload>(
  // Sin requerir sesión a propósito: los errores que más importan son los que
  // ocurren ANTES de entrar —la pantalla de registro, el login—, y exigir
  // autenticación los dejaría justamente fuera. El riesgo es que alguien
  // llame esto en masa; los topes de arriba acotan el costo de cada llamada,
  // y a US$0,40 por millón de invocaciones el peor caso realista son unos
  // pocos dólares. Si algún día molesta, la puerta correcta es App Check, no
  // pedir sesión.
  { maxInstances: 3 },
  async (request) => {
    const message = clip(request.data?.message, MAX_MESSAGE);
    if (!message) return { received: false };

    logger.error('client_error', {
      message,
      stack: clip(request.data?.stack, MAX_STACK),
      origin: clip(request.data?.origin, 60) ?? 'desconocido',
      fatal: request.data?.fatal === true,
      platform: clip(request.data?.platform, 30),
      appVersion: clip(request.data?.appVersion, 30),
      uid: request.auth?.uid ?? null,
      context: sanitizeContext(request.data?.context),
    });

    return { received: true };
  }
);
