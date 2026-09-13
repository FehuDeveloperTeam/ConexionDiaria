// Emparejamiento con código verificado en el servidor — hallazgo F-02 de la
// auditoría de seguridad.
//
// Por qué existe: antes, el cliente resolvía el código de invitación
// directamente contra Firestore y después escribía 'partnerId' en el
// documento del otro usuario con un writeBatch. Las reglas solo comprobaban
// que esa persona no tuviera pareja todavía (ver isClaimingAsPartner(), ya
// eliminada de firestore.rules) — el código en sí nunca se validaba contra
// nada. Cualquiera autenticado podía escribir el uid de un desconocido sin
// pareja como su propio partnerId y quedar emparejado con él sin su
// consentimiento, ganando acceso a su perfil y a todo lo que comparta
// después.
//
// Esta función hace lo que las reglas de Firestore no pueden: resolver el
// código, comprobar que apunte a alguien real que no sea uno mismo y que
// ninguno de los dos tenga pareja ya, y recién ahí escribir 'partnerId' en
// AMBOS documentos. Todo dentro de una única transacción, para que dos
// intentos simultáneos con el mismo código no puedan pisarse.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';

interface PairWithCodeData {
  code?: unknown;
}

export const pairWithCode = onCall<PairWithCodeData>(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Necesitas iniciar sesión para emparejarte.');
  }

  const rawCode = request.data?.code;
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    throw new HttpsError('invalid-argument', 'Falta el código de invitación.');
  }
  const code = rawCode.trim().toUpperCase();
  const myUid = auth.uid;

  const db = getFirestore();
  const codeRef = db.collection('invitationCodes').doc(code);

  return db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists) {
      throw new HttpsError('not-found', 'Ese código de invitación no existe.');
    }

    const partnerUid = codeSnap.data()?.uid as string | undefined;
    if (!partnerUid) {
      throw new HttpsError('internal', 'El código de invitación está mal formado.');
    }
    if (partnerUid === myUid) {
      throw new HttpsError('invalid-argument', 'No puedes emparejarte contigo mismo.');
    }

    const myRef = db.collection('users').doc(myUid);
    const partnerRef = db.collection('users').doc(partnerUid);
    const [mySnap, partnerSnap] = await tx.getAll(myRef, partnerRef);

    if (!mySnap.exists || !partnerSnap.exists) {
      throw new HttpsError('not-found', 'No se encontró alguno de los dos perfiles.');
    }
    if (mySnap.data()?.partnerId) {
      throw new HttpsError('failed-precondition', 'Ya tienes una pareja conectada.');
    }
    if (partnerSnap.data()?.partnerId) {
      throw new HttpsError('failed-precondition', 'Esa persona ya tiene una pareja conectada.');
    }

    tx.update(myRef, { partnerId: partnerUid });
    tx.update(partnerRef, { partnerId: myUid });

    logger.info(`pairWithCode: ${myUid} <-> ${partnerUid}`);
    return { partnerUid };
  });
});
