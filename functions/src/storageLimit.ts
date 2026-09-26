// Tope de almacenamiento de la pareja, escrito por el servidor — Sprint 11.3.
//
// El tope del plan gratuito (100 MB) se validaba SOLO en el cliente, en
// checkStorage(). Las reglas de Storage limitaban 50 MB por archivo pero
// nunca miraban el total, así que el límite era una sugerencia: cualquiera con
// el build web y la consola del navegador abierta subía lo que quisiera. Y el
// almacenamiento es a la vez el principal costo variable del proyecto y uno de
// los dos diferenciadores del plan pago.
//
// Para que la regla de Storage pueda decidir necesita el número a mano, en el
// documento de la relación. Lo pone esta función:
//
//   relationships/{id}.storageLimit  <- bytes permitidos para esta pareja
//
// El plan es de la PERSONA, no de la pareja ("uno paga, ambos disfrutan"), así
// que el tope de la relación es el del miembro más generoso: basta que uno sea
// premium. Por eso se recalcula leyendo a los dos, no solo a quien cambió.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { getFirestore } from 'firebase-admin/firestore';
import { limitForPlans } from './storageQuota';

export { FREE_STORAGE_BYTES, PREMIUM_STORAGE_BYTES } from './storageQuota';

export const relationshipIdFor = (a: string, b: string): string =>
  [a, b].sort().join('_');

// Recalcula y guarda el tope de la pareja de este usuario.
const syncStorageLimit = async (uid: string): Promise<void> => {
  const db = getFirestore();

  const userSnap = await db.collection('users').doc(uid).get();
  const partnerId = userSnap.data()?.partnerId as string | undefined;
  if (!partnerId) return; // sin pareja no hay relación que actualizar

  const partnerSnap = await db.collection('users').doc(partnerId).get();

  const storageLimit = limitForPlans(userSnap.data()?.plan, partnerSnap.data()?.plan);

  const ref = db.collection('relationships').doc(relationshipIdFor(uid, partnerId));
  try {
    // merge, y no update: la relación puede no existir todavía si la pareja
    // acaba de emparejarse y aún no ha escrito nada compartido. Sin esto, el
    // tope llegaría después que la primera subida.
    await ref.set({ storageLimit }, { merge: true });
  } catch (error) {
    logger.error(`No se pudo escribir storageLimit de ${ref.id}`, error);
  }
};

// Se dispara con cualquier escritura al perfil, pero solo hace trabajo si
// cambió algo que mueva el tope. El perfil se escribe seguido (presencia,
// ánimo), así que sin este filtro serían dos lecturas y una escritura cada
// cuatro minutos por usuario activo, para nada.
export const onPlanOrPartnerChanged = onDocumentWritten('users/{uid}', async (event) => {
  const antes = event.data?.before.data();
  const despues = event.data?.after.data();
  if (!despues) return;

  const cambioPlan = antes?.plan !== despues.plan;
  const cambioPareja = antes?.partnerId !== despues.partnerId;
  if (!cambioPlan && !cambioPareja) return;

  await syncStorageLimit(event.params.uid);

  // Al desconectarse hay que arreglar también la relación que se acaba de
  // deshacer: la que queda con el tope de cuando eran dos.
  if (cambioPareja && antes?.partnerId) {
    await syncStorageLimit(antes.partnerId as string);
  }
});
