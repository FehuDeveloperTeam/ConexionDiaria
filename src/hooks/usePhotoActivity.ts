// Reacciones y comentarios de UNA foto — Sprint 9.27.
//
// Se suscribe solo a la foto que está abierta en el visor, no a las 150 del
// álbum: con un listener por foto, abrir la pantalla costaría 300 listeners
// para mirar nueve miniaturas. Lo que el grid necesita saber —si una foto
// tiene algo— sale de los contadores que la Cloud Function deja en el propio
// documento de la foto (ver functions/src/albumActivity.ts).
import { useCallback, useEffect, useState } from 'react';
import {
    addDoc, collection, deleteDoc, doc, DocumentData, onSnapshot,
    orderBy, query, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { captureError } from '../services/errorReporter';

export interface PhotoComment {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    createdAt?: DocumentData;
}

export const DEFAULT_REACTION = '❤️';

export const usePhotoActivity = (
    relationshipId: string | null,
    photoId: string | null,
    myUid: string | null
) => {
    const [reactions, setReactions] = useState<Record<string, string>>({});
    const [comments, setComments] = useState<PhotoComment[]>([]);

    useEffect(() => {
        if (!relationshipId || !photoId) {
            setReactions({});
            setComments([]);
            return;
        }

        const photoPath = ['relationships', relationshipId, 'photos', photoId] as const;

        const unsubReactions = onSnapshot(
            collection(db, ...photoPath, 'reactions'),
            snapshot => {
                const next: Record<string, string> = {};
                snapshot.docs.forEach(d => { next[d.id] = (d.data().emoji as string) || DEFAULT_REACTION; });
                setReactions(next);
            },
            error => console.error('Error cargando reacciones:', error)
        );

        const unsubComments = onSnapshot(
            query(collection(db, ...photoPath, 'comments'), orderBy('createdAt', 'asc')),
            snapshot => setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PhotoComment))),
            error => console.error('Error cargando comentarios:', error)
        );

        return () => { unsubReactions(); unsubComments(); };
    }, [relationshipId, photoId]);

    // El id del documento es el uid de quien reacciona, así que reaccionar dos
    // veces reemplaza en vez de acumular, y la regla de Firestore puede
    // exigir que nadie escriba en el nombre de otro.
    const toggleReaction = useCallback(async (emoji: string = DEFAULT_REACTION) => {
        if (!relationshipId || !photoId || !myUid) return;
        const ref = doc(db, 'relationships', relationshipId, 'photos', photoId, 'reactions', myUid);
        try {
            if (reactions[myUid]) await deleteDoc(ref);
            else await setDoc(ref, { emoji, createdAt: serverTimestamp() });
        } catch (error) {
            console.error('Error guardando la reacción:', error);
            captureError(error, { origin: 'reaccionarFoto' });
        }
    }, [relationshipId, photoId, myUid, reactions]);

    const addComment = useCallback(async (text: string, authorName: string) => {
        if (!relationshipId || !photoId || !myUid) return;
        const trimmed = text.trim();
        if (!trimmed) return;

        await addDoc(collection(db, 'relationships', relationshipId, 'photos', photoId, 'comments'), {
            text: trimmed.slice(0, 500),
            authorId: myUid,
            authorName,
            createdAt: serverTimestamp(),
        });
    }, [relationshipId, photoId, myUid]);

    const deleteComment = useCallback(async (commentId: string) => {
        if (!relationshipId || !photoId) return;
        try {
            await deleteDoc(doc(db, 'relationships', relationshipId, 'photos', photoId, 'comments', commentId));
        } catch (error) {
            console.error('Error borrando el comentario:', error);
        }
    }, [relationshipId, photoId]);

    return {
        reactions,
        comments,
        myReaction: myUid ? reactions[myUid] ?? null : null,
        toggleReaction,
        addComment,
        deleteComment,
    };
};
