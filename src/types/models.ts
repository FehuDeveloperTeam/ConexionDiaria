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

  // De solo lectura para el cliente a partir del Sprint 3 — la escritura
  // real la hace la Cloud Function que valida el webhook de RevenueCat.
  plan: Plan;
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

  // Quién de los dos paga la suscripción compartida. null si la relación
  // está en plan free.
  payerId: string | null;
  // Fecha desde la que 'payerId' es premium — desempate por antigüedad
  // cuando la herencia de tema no se resuelve por género (Sprint 2).
  premiumSince: Timestamp | null;

  settings?: RelationshipSettings;

  missYouCounters?: Record<string, number>;
  lastResetDate?: string; // 'YYYY-MM-DD'

  usedStorage?: number; // bytes
}
