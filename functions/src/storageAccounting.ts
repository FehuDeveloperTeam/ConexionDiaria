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

// Extrae el id de relación de una ruta de Storage, solo si corresponde a
// contenido compartido. Cualquier otra ruta (avatars/, o algo que no
// matchee ninguna regla) no cuenta para el tope del plan gratuito.
const relationshipIdFromPath = (path: string | undefined): string | null => {
  if (!path) return null;
  const match = path.match(/^(?:relationships|albums)\/([^/]+)\//);
  return match ? match[1] : null;
};

const adjustUsedStorage = async (
  path: string | undefined,
  rawSize: string | number | undefined,
  sign: 1 | -1
): Promise<void> => {
  const relationshipId = relationshipIdFromPath(path);
  if (!relationshipId) return;

  // Los tipos de firebase-functions declaran 'size' como number, pero el
  // payload real que manda Eventarc (documentado por Google Cloud Storage)
  // lo entrega como string, porque un tamaño en bytes puede superar el
  // rango seguro de un number de JS. Number() convierte cualquiera de los
  // dos casos correctamente.
  const size = Number(rawSize ?? 0);
  if (!Number.isFinite(size) || size <= 0) return;

  await getFirestore()
    .collection('relationships')
    .doc(relationshipId)
    // set + merge en vez de update: no depende de que el documento de la
    // relación ya exista (por ejemplo, en la primera subida antes de
    // cualquier "te extraño").
    .set({ usedStorage: FieldValue.increment(sign * size) }, { merge: true });
};

export const onStorageObjectFinalized = onObjectFinalized(async (event) => {
  try {
    await adjustUsedStorage(event.data.name, event.data.size, 1);
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
