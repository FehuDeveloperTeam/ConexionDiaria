// Contabilidad de almacenamiento del plan gratuito — hallazgos F-04 y F-05
// de la auditoría de seguridad.
//
// Por qué existe: antes, 'usedStorage' lo escribía el propio cliente con un
// increment() justo después de cada subida (ver useChatUploads.ts). Como las
// reglas de Firestore le permitían escribir cualquier campo de su propio
// documento de relación, un usuario free podía poner 'usedStorage' en 0 y
// seguir subiendo — el muro de pago del Sprint 3 era decorativo (F-04). Y
// las fotos del álbum nunca se contaban, aunque son el contenido más pesado
// de la app (F-05).
//
// La solución: contar desde los propios eventos de Storage, que el cliente
// no puede simular ni evitar. Cada objeto que se sube o se borra bajo
// 'relationships/{rid}/...' o 'albums/{rid}/...' ajusta 'usedStorage' del
// documento de esa relación con un increment() atómico vía Admin SDK (que no
// pasa por las reglas — ver firestore.rules). 'avatars/{uid}/...' no cuenta:
// es del usuario, no de la pareja.

import { onObjectFinalized, onObjectDeleted } from 'firebase-functions/v2/storage';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { exceedsQuota, limitFromRelationship, relationshipIdFromPath } from './storageQuota';

// Sprint 11.3: además de contar, se hace cumplir el tope.
//
// El intento original fue validarlo en storage.rules leyendo el documento de
// la relación con firestore.get(). Las reglas entre servicios existen, pero no
// funcionan en el emulador —firestore.exists() devuelve false aunque el
// documento esté ahí— así que no había forma de probar esa regla antes de
// desplegarla, y sus dos modos de falla eran inaceptables: dejar pasar
// significa no aplicar el cupo nunca y que nadie se entere, y rechazar
// significa que si las reglas entre servicios fallaran en producción, nadie
// puede subir nada.
//
// Acá el control es verificable y no puede fallar en silencio: si el archivo
// pasa el cupo, se borra y queda registrado. Cuesta una subida de ancho de
// banda desperdiciada —acotada por el tope por archivo de storage.rules— a
// cambio de un límite que de verdad existe.
//
// Devuelve el total después del ajuste y el tope vigente, para que quien llama
// pueda decidir.
const adjustUsedStorage = async (
  path: string | undefined,
  rawSize: string | number | undefined,
  sign: 1 | -1
): Promise<{ used: number; limit: number } | null> => {
  const relationshipId = relationshipIdFromPath(path);
  if (!relationshipId) return null;

  // Los tipos de firebase-functions declaran 'size' como number, pero el
  // payload real que manda Eventarc (documentado por Google Cloud Storage)
  // lo entrega como string, porque un tamaño en bytes puede superar el
  // rango seguro de un number de JS. Number() convierte cualquiera de los
  // dos casos correctamente.
  const size = Number(rawSize ?? 0);
  if (!Number.isFinite(size) || size <= 0) return null;

  const ref = getFirestore().collection('relationships').doc(relationshipId);

  // En una transacción, para que el total con el que se decide sea el mismo
  // que quedó escrito: dos subidas simultáneas leyendo por separado podrían
  // dejar pasar las dos.
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const previo = (snap.data()?.usedStorage as number) ?? 0;
    const limit = limitFromRelationship(snap.data());
    const used = Math.max(0, previo + sign * size);

    // set + merge en vez de update: no depende de que el documento de la
    // relación ya exista (por ejemplo, en la primera subida antes de
    // cualquier "te extraño").
    tx.set(ref, { usedStorage: used }, { merge: true });
    return { used, limit };
  });
};

// Borra el objeto que se pasó del cupo. El borrado dispara
// onStorageObjectDeleted, que descuenta el tamaño, así que 'usedStorage' se
// corrige solo y no hay que tocarlo acá.
const deleteOverQuota = async (bucket: string, path: string, relationshipId: string): Promise<void> => {
  await getStorage().bucket(bucket).file(path).delete();
  await getFirestore().collection('relationships').doc(relationshipId).set(
    {
      // Queda contado para soporte: si alguien reclama que "se le borró una
      // foto", esto dice por qué.
      overQuotaUploads: FieldValue.increment(1),
      lastOverQuotaAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

export const onStorageObjectFinalized = onObjectFinalized(async (event) => {
  try {
    const resultado = await adjustUsedStorage(event.data.name, event.data.size, 1);
    if (!resultado) return;

    if (exceedsQuota(resultado.used, resultado.limit)) {
      const relationshipId = relationshipIdFromPath(event.data.name);
      if (!relationshipId) return;

      logger.warn('Subida por sobre el cupo: se borra', {
        path: event.data.name,
        used: resultado.used,
        limit: resultado.limit,
        relationshipId,
      });
      await deleteOverQuota(event.data.bucket, event.data.name, relationshipId);
    }
  } catch (error) {
    logger.error('onStorageObjectFinalized: no se pudo sumar usedStorage', {
      path: event.data.name,
      error,
    });
  }
});

export const onStorageObjectDeleted = onObjectDeleted(async (event) => {
  try {
    await adjustUsedStorage(event.data.name, event.data.size, -1);
  } catch (error) {
    logger.error('onStorageObjectDeleted: no se pudo restar usedStorage', {
      path: event.data.name,
      error,
    });
  }
});
