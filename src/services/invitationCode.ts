// Código de invitación para emparejar pareja.
//
// Antes, el "código" era directamente el UID del usuario (ver git history de
// home.tsx). Eso obligaba a leer el perfil privado del desconocido ANTES de
// estar emparejado con él, algo que las reglas de Firestore no pueden
// permitir sin exponer todos los perfiles a cualquier usuario autenticado —
// de ahí el punto muerto que bloqueaba el emparejamiento (ver Sprint 2 en la
// hoja de ruta).
//
// La solución: un código corto vive en su propia colección de solo-mapeo,
// 'invitationCodes/{code}' -> { uid }. Resolver un código a un UID no
// requiere leer nada del perfil del dueño, así que puede ser legible por
// cualquier usuario autenticado sin filtrar datos personales.
//
// Esta sesión deja lista la generación y resolución del código. El chequeo
// de "esa persona ya tiene pareja" y la escritura recíproca de 'partnerId'
// siguen pendientes de la sesión 2.2, que reescribe las reglas de 'users'
// para permitirlo.

import { doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

const CODE_LENGTH = 6;
// Sin caracteres confundibles entre sí: 0/O, 1/I/L.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface InvitationCodeDoc {
    uid: string;
    createdAt: Timestamp;
}

export const generateInvitationCode = (): string => {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
};

/**
 * Genera un código de invitación que, al momento de la comprobación, no
 * está en uso. No lo reserva — quien llama debe escribir
 * 'invitationCodes/{code}' junto con la creación del usuario, idealmente en
 * el mismo batch, para que ambas escrituras sean atómicas.
 *
 * Nota: existe una ventana breve entre esta comprobación y esa escritura
 * donde, en teoría, dos registros simultáneos podrían competir por el mismo
 * código. Con un alfabeto de 32 caracteres y 6 posiciones (~10^9
 * combinaciones) y el volumen de registros esperado, el riesgo es
 * despreciable por ahora; si esto pasa a producción con volumen real,
 * conviene resolverlo con una transacción de Firestore.
 */
export const generateUniqueInvitationCode = async (): Promise<string> => {
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const code = generateInvitationCode();
        const codeSnap = await getDoc(doc(db, 'invitationCodes', code));
        if (!codeSnap.exists()) {
            return code;
        }
    }
    throw new Error('No se pudo generar un código de invitación único. Intenta de nuevo.');
};

/** Documento a escribir en 'invitationCodes/{code}' junto con el perfil del usuario. */
export const buildInvitationCodeDoc = (uid: string) => ({
    uid,
    createdAt: serverTimestamp(),
});

/**
 * Resuelve un código de invitación al UID de su dueño, sin leer el perfil
 * privado de esa persona. Devuelve null si el código no existe.
 */
export const resolveInvitationCode = async (rawCode: string): Promise<string | null> => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return null;

    const codeSnap = await getDoc(doc(db, 'invitationCodes', code));
    if (!codeSnap.exists()) return null;

    return (codeSnap.data() as InvitationCodeDoc).uid;
};
