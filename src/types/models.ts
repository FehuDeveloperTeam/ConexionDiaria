// Modelo de datos de Firestore — colecciones 'users' y 'relationships'.
// Definido en la sesión 1.1 del plan de refactor. La capa de servicios
// (sesión 1.2) es quien empieza a usar estos tipos en las lecturas/escrituras;
// esta sesión solo fija la forma de los datos.

import { Timestamp } from 'firebase/firestore';

export type Gender = 'female' | 'male' | 'other';

export type Plan = 'free' | 'premium';

export interface Mood {
  emoji: string;
  name: string;
  status: string;
}

// Documento en users/{uid}
export interface UserDoc {
  email: string;
  displayName: string;
  createdAt: Timestamp;
  photoURL?: string;

  partnerId: string | null;
  relationshipStartDate: Timestamp | null;

  // Sprint 9.11 — obligatoria al crear la cuenta, antes de emparejarse. La
  // necesitan el aviso de regalo de cumpleaños y su ventana de descuento, y
  // de paso habilita el saludo del día. Las cuentas anteriores a esta sesión
  // la traen nula hasta que la completen desde Ajustes.
  birthDate: Timestamp | null;

  // Código corto para emparejar sin necesitar leer el perfil ajeno
  // (el UID ya no se usa como código — ver Sprint 2).
  invitationCode: string;

  // Opcional: sin declarar por el usuario, o declarado y luego omitido.
  // Si falta en cualquiera de los dos miembros de la relación, la herencia
  // de tema (Sprint 2) se resuelve por antigüedad como pagador.
  gender: Gender | null;

  currentMood: Mood;
  isOnline: boolean;
  lastSeen: Timestamp;

  // Sprint 9.24 — MIS tallas, declaradas por mí para que mi pareja no tenga
  // que adivinarlas. Viven en el perfil, no en la subcolección privada, justo
  // porque la gracia es que ella las lea (la regla de 'users' ya le deja leer
  // mi perfil). Lo que YO anoto de ELLA es otra cosa y vive en
  // users/{uid}/private/partnerProfile, donde nadie más entra.
  // Las claves son las de src/config/measurements.ts.
  measurements?: Record<string, string>;

  // Sprint 10.2 — cuándo se terminó (o se saltó) la bienvenida. Mientras
  // falte, la app lleva a /welcome al entrar con pareja ya conectada.
  // Saltarla también la marca: si no, reaparecería en cada arranque, que es
  // la forma más rápida de que alguien deje de leerla.
  onboardedAt?: Timestamp | null;

  // Hasta cuándo no volver a ofrecer el asistente de tallas en Inicio
  // ('YYYY-MM-DD'). Se guarda en el perfil y no en el dispositivo para que
  // posponerlo en el teléfono también lo posponga en el computador.
  measurementsSnoozedUntil?: string | null;

  // De solo lectura para el cliente desde el Sprint 3 — los escribe
  // exclusivamente la Cloud Function que valida el webhook de RevenueCat
  // (functions/src/revenuecatWebhook.ts), nunca el cliente.
  //
  // Viven en el USUARIO, no en la relación: una suscripción le pertenece a
  // la cuenta que paga, no a la pareja en la que esté en ese momento — si
  // el que paga se desvincula, se lleva su plan consigo. El plan "de la
  // pareja" (Sprint 3.3) se deriva en el cliente como el OR de ambos
  // miembros, no se guarda por separado.
  plan: Plan;
  premiumSince: Timestamp | null;

  // Sprint 9.17 — número de fundador (1 a 500), si esta cuenta alcanzó cupo
  // al pagar por primera vez. Lo reparte el webhook en una transacción y no
  // se devuelve al darse de baja: la cohorte fundadora no se recicla.
  // Ausente en quien no alcanzó cupo o nunca pagó.
  founderNumber?: number;

  // Push remoto (Sprint 5.2): token de Expo Push de este dispositivo, y
  // preferencia de qué avisos quiere recibir. Ambos opcionales — sin
  // permiso concedido, o antes de tener un proyecto EAS configurado, no
  // hay token; sin preferencia guardada, el default es recibir todo (ver
  // functions/src/index.ts).
  expoPushToken?: string | null;
  notificationPrefs?: {
    newMessages?: boolean;
    missYou?: boolean;
    // Sprint 9.27: reacciones y comentarios en las fotos del álbum.
    albumActivity?: boolean;
  };
}

export interface RelationshipSettings {
  backgroundColor?: string;
  fontFamily?: string;
  fontColor?: string;
  borderColor?: string;
  borderStyle?: string;
}

// Documento en relationships/{relationshipId}
// El ID sigue siendo '{uid1}_{uid2}' (ordenados), pero las reglas y queries
// ya no deberían depender de parsear el ID — usar 'members' en su lugar.
export interface RelationshipDoc {
  members: [string, string];

  // No hay 'payerId'/'premiumSince' acá — viven en UserDoc (ver por qué
  // ahí). Quién paga y desde cuándo se deriva mirando 'plan' y
  // 'premiumSince' de los dos miembros, no se duplica en la relación.

  settings?: RelationshipSettings;

  missYouCounters?: Record<string, number>;
  lastResetDate?: string; // 'YYYY-MM-DD'

  usedStorage?: number; // bytes
}
