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

  // Push remoto (Sprint 5.2): token de Expo Push de este dispositivo, y
  // preferencia de qué avisos quiere recibir. Ambos opcionales — sin
  // permiso concedido, o antes de tener un proyecto EAS configurado, no
  // hay token; sin preferencia guardada, el default es recibir todo (ver
  // functions/src/index.ts).
  expoPushToken?: string | null;
  notificationPrefs?: {
    newMessages?: boolean;
    missYou?: boolean;
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
