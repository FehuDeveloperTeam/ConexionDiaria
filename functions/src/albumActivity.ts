// Reacciones y comentarios del álbum — Sprint 9.27.
//
// Dos trabajos que el cliente no puede hacer:
//
// 1. Los contadores. El grid del álbum necesita saber si una foto tiene
//    comentarios SIN leer la subcolección de cada una — con 150 fotos serían
//    150 consultas cada vez que se abre la pantalla. La respuesta es un
//    contador en el propio documento de la foto, que el grid ya carga. Pero
//    si lo escribiera el cliente, sería un número que cualquiera puede
//    inventar: la regla de Firestore mantiene 'photos' sin 'update' para todo
//    cliente y lo escribe esta función con Admin SDK, igual que 'usedStorage'.
//
// 2. El aviso. Que la otra persona comente una foto es justamente lo que hace
//    volver al álbum, y para eso el aviso tiene que llegar aunque la app esté
//    cerrada.

import { onDocumentCreated, onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getPushTargetIfAllowed, partnerUidFromRelationshipId, sendExpoPush } from './pushNotifications';

const photoRef = (relationshipId: string, photoId: string) =>
  getFirestore().doc(`relationships/${relationshipId}/photos/${photoId}`);

// El contador se ajusta con FieldValue.increment y no leyendo-y-escribiendo:
// dos comentarios simultáneos leerían el mismo valor y uno de los dos se
// perdería.
const bumpCounter = async (
  relationshipId: string,
  photoId: string,
  field: 'commentCount' | 'reactionCount',
  delta: number
): Promise<void> => {
  try {
    await photoRef(relationshipId, photoId).update({ [field]: FieldValue.increment(delta) });
  } catch (error) {
    // La foto puede haberse borrado entremedio (al borrarla se van también
    // sus comentarios). No es un error que valga la pena reintentar.
    logger.warn(`No se pudo ajustar ${field} de la foto ${photoId}`, error);
  }
};

export const onPhotoCommentCreated = onDocumentCreated(
  'relationships/{relationshipId}/photos/{photoId}/comments/{commentId}',
  async (event) => {
    const comment = event.data?.data();
    if (!comment) return;

    const { relationshipId, photoId } = event.params;
    await bumpCounter(relationshipId, photoId, 'commentCount', 1);

    const authorUid = comment.authorId as string | undefined;
    if (!authorUid) return;

    const partnerUid = partnerUidFromRelationshipId(relationshipId, authorUid);
    if (!partnerUid) return;

    // Se avisa siempre, incluso cuando alguien comenta su propia foto: para
    // la otra persona ese comentario es igual de nuevo.
    const token = await getPushTargetIfAllowed(partnerUid, 'albumActivity');
    if (!token) return;

    const text = typeof comment.text === 'string' ? comment.text : '';
    await sendExpoPush({
      to: token,
      title: `${comment.authorName || 'Tu pareja'} comentó una foto`,
      body: text.length > 90 ? `${text.slice(0, 90)}…` : text,
      data: { type: 'album_comment', relationshipId, photoId },
    });
  }
);

export const onPhotoCommentDeleted = onDocumentDeleted(
  'relationships/{relationshipId}/photos/{photoId}/comments/{commentId}',
  async (event) => {
    const { relationshipId, photoId } = event.params;
    await bumpCounter(relationshipId, photoId, 'commentCount', -1);
  }
);

export const onPhotoReactionCreated = onDocumentCreated(
  'relationships/{relationshipId}/photos/{photoId}/reactions/{userId}',
  async (event) => {
    const reaction = event.data?.data();
    const { relationshipId, photoId, userId } = event.params;
    await bumpCounter(relationshipId, photoId, 'reactionCount', 1);

    const partnerUid = partnerUidFromRelationshipId(relationshipId, userId);
    if (!partnerUid) return;

    const token = await getPushTargetIfAllowed(partnerUid, 'albumActivity');
    if (!token) return;

    await sendExpoPush({
      to: token,
      title: 'Le gustó una foto',
      body: `${reaction?.emoji || '❤️'} Tu pareja reaccionó a una foto del álbum`,
      data: { type: 'album_reaction', relationshipId, photoId },
    });
  }
);

export const onPhotoReactionDeleted = onDocumentDeleted(
  'relationships/{relationshipId}/photos/{photoId}/reactions/{userId}',
  async (event) => {
    const { relationshipId, photoId } = event.params;
    await bumpCounter(relationshipId, photoId, 'reactionCount', -1);
  }
);
