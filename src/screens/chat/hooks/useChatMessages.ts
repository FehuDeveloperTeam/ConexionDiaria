import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc,
    updateDoc, Timestamp, limit, getDocs, startAfter, writeBatch,
    QueryDocumentSnapshot, DocumentData
} from 'firebase/firestore';
import { IMessage } from 'react-native-gifted-chat';
import Toast from 'react-native-toast-message';
import { auth, db } from '../../../config/firebaseConfig';
import { ExtendedMessage } from '../types';

// Tamaño de página para el chat: la ventana "en vivo" (onSnapshot) carga las
// últimas MESSAGES_PAGE_SIZE, y "cargar mensajes anteriores" trae de a
// MESSAGES_PAGE_SIZE más con una lectura puntual (getDocs), no en tiempo real.
const MESSAGES_PAGE_SIZE = 40;

// Sprint 9.10 — cuántos días de conversación ve el plan free hacia atrás.
// El tope va SOLO en el historial: enviar mensajes nunca se limita, porque
// es el hábito diario que sostiene la app. Hasta ahora el paywall prometía
// "historial completo del chat" sin que existiera ninguna diferencia real
// entre los planes; esto la hace cierta.
const FREE_HISTORY_DAYS = 90;

// Recorta una página de mensajes al tope del plan free. Devuelve los que se
// pueden mostrar y si quedó conversación más vieja detrás del tope — eso
// último es lo que distingue "no hay más" de "hay más, pero es de pago".
const applyHistoryLimit = (
    docs: QueryDocumentSnapshot<DocumentData>[],
    isFree: boolean
): { docs: QueryDocumentSnapshot<DocumentData>[]; limitReached: boolean } => {
    if (!isFree) return { docs, limitReached: false };

    const cutoff = Date.now() - FREE_HISTORY_DAYS * 24 * 60 * 60 * 1000;
    const visible = docs.filter(d => {
        const createdAt = d.data().createdAt?.toDate?.();
        // Un mensaje recién enviado todavía no tiene la marca del servidor;
        // es de ahora mismo, así que cuenta como dentro del tope.
        return !createdAt || createdAt.getTime() >= cutoff;
    });

    return { docs: visible, limitReached: visible.length < docs.length };
};

// Convierte un documento de Firestore de la subcolección 'messages' al
// formato que usa GiftedChat. Se usa tanto en el listener en vivo como en
// 'cargar mensajes anteriores', para no duplicar el mapeo.
const mapMessageDoc = (doc: QueryDocumentSnapshot<DocumentData>): ExtendedMessage => {
    const data = doc.data();
    return {
        _id: doc.id,
        text: data.text || '',
        createdAt: data.createdAt?.toDate() || new Date(),
        user: {
            _id: data.user._id,
            name: data.user.name,
        },
        image: data.image,
        video: data.video,
        audio: data.audio,
        audioDuration: data.audioDuration,
        file: data.file,
        fileName: data.fileName,
        fileSize: data.fileSize,
        delivered: data.delivered ?? false,
        read: data.read ?? false,
        audioPlayed: data.audioPlayed ?? false,
        deleted: data.deleted ?? false,
        sentAt: data.sentAt?.toDate(),
    };
};

// Autenticación, carga de mensajes (en vivo + paginación) y envío de texto.
export function useChatMessages(
    userData: DocumentData | null,
    resetInput: () => void,
    plan: 'free' | 'premium' = 'free'
) {
    const isFree = plan === 'free';

    // Ref para no atar la identidad de onSend a la de resetInput: el
    // llamador la pasa como una lambda nueva en cada render.
    const resetInputRef = useRef(resetInput);
    resetInputRef.current = resetInput;

    // 'messages' se arma a partir de dos piezas: la ventana en vivo (los
    // últimos MESSAGES_PAGE_SIZE, vía onSnapshot) y las páginas anteriores
    // ya cargadas con "cargar mensajes anteriores" (estáticas, vía getDocs).
    const [liveMessages, setLiveMessages] = useState<ExtendedMessage[]>([]);
    const [earlierMessages, setEarlierMessages] = useState<ExtendedMessage[]>([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    // Hay conversación más vieja, pero el plan free no la alcanza.
    const [historyLimitReached, setHistoryLimitReached] = useState(false);
    const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
    const oldestMessageDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const messages = useMemo(
        () => [...liveMessages, ...earlierMessages],
        [liveMessages, earlierMessages]
    );
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);

    // Autenticación y carga de mensajes
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(!user);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser || !userData?.partnerId) {
            setLiveMessages([]);
            setEarlierMessages([]);
            setHasMoreMessages(false);
            oldestMessageDocRef.current = null;
            setLoading(false);
            return;
        }

        // Nueva conversación (cambió el usuario o la pareja): descartar
        // cualquier página "anterior" que se hubiera cargado para la charla previa.
        setEarlierMessages([]);
        setHasMoreMessages(false);
        setHistoryLimitReached(false);
        oldestMessageDocRef.current = null;

        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
        const messagesRef = collection(db, 'relationships', relationshipId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PAGE_SIZE));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const { docs: visibleDocs, limitReached } = applyHistoryLimit(snapshot.docs, isFree);
            const loadedMessages: ExtendedMessage[] = visibleDocs.map(mapMessageDoc);

            setLiveMessages(loadedMessages);
            setLoading(false);
            if (limitReached) setHistoryLimitReached(true);

            // El cursor de paginación se fija con la primera carga de esta
            // ventana en vivo. Los siguientes disparos del listener (por un
            // 'delivered'/'read' que cambia, por ejemplo) no deben moverlo —
            // eso rompería 'cargar mensajes anteriores' a mitad de sesión.
            //
            // El cursor apunta al último mensaje VISIBLE, no al último traído:
            // si arrancara después de uno recortado por el tope, la siguiente
            // página se saltaría mensajes que el usuario nunca vio.
            if (oldestMessageDocRef.current === null) {
                oldestMessageDocRef.current = visibleDocs[visibleDocs.length - 1] ?? null;
                setHasMoreMessages(!limitReached && snapshot.docs.length === MESSAGES_PAGE_SIZE);
            }

            // Marcar como entregados y leídos los mensajes de la pareja que
            // aún no lo estén, en un solo lote (antes eran N escrituras
            // sueltas, una por await, y hasta dos por mensaje si aplicaban
            // ambos campos por separado).
            const appActive = AppState.currentState === 'active';
            const batch = writeBatch(db);
            let hasWrites = false;

            for (const messageDoc of snapshot.docs) {
                const data = messageDoc.data();
                if (data.user._id === currentUser.uid) continue;

                const update: { delivered?: true; read?: true } = {};
                if (!data.delivered) update.delivered = true;
                if (appActive && !data.read) update.read = true;

                if (Object.keys(update).length > 0) {
                    const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageDoc.id);
                    batch.update(messageRef, update);
                    hasWrites = true;
                }
            }

            if (hasWrites) {
                await batch.commit();
            }
        });

        return () => unsubscribe();
        // 'isFree' entra acá para que al pasar a premium la conversación se
        // recargue completa sin tener que salir y volver a entrar.
    }, [currentUser, userData?.partnerId, isFree]);

    // Cargar mensajes anteriores (paginación). Es una lectura puntual
    // (getDocs), no un listener en tiempo real — los mensajes viejos ya
    // enviados no necesitan actualizarse en vivo.
    const handleLoadEarlier = useCallback(async () => {
        if (!currentUser || !userData?.partnerId || !oldestMessageDocRef.current || isLoadingEarlier) {
            return;
        }

        setIsLoadingEarlier(true);
        try {
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const messagesRef = collection(db, 'relationships', relationshipId, 'messages');
            const q = query(
                messagesRef,
                orderBy('createdAt', 'desc'),
                startAfter(oldestMessageDocRef.current),
                limit(MESSAGES_PAGE_SIZE)
            );

            const snapshot = await getDocs(q);
            const { docs: visibleDocs, limitReached } = applyHistoryLimit(snapshot.docs, isFree);
            const olderMessages = visibleDocs.map(mapMessageDoc);

            setEarlierMessages(prev => [...prev, ...olderMessages]);
            if (visibleDocs.length > 0) {
                oldestMessageDocRef.current = visibleDocs[visibleDocs.length - 1];
            }
            if (limitReached) setHistoryLimitReached(true);
            setHasMoreMessages(!limitReached && snapshot.docs.length === MESSAGES_PAGE_SIZE);
        } catch (error) {
            console.error('Error cargando mensajes anteriores:', error);
        } finally {
            setIsLoadingEarlier(false);
        }
    }, [currentUser, userData?.partnerId, isLoadingEarlier, isFree]);

    // Enviar mensaje de texto
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!currentUser || !userData?.partnerId) return;

        const message = newMessages[0];
        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');

        try {
            await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                text: message.text,
                createdAt: Timestamp.now(),
                authorId: currentUser.uid,
                user: {
                    _id: currentUser.uid,
                    name: userData.name || 'Usuario',
                },
                delivered: false,
                read: false,
                sentAt: Timestamp.now(),
            });

            resetInputRef.current();
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el mensaje',
            });
        }
    }, [currentUser, userData]);

    // Borrado suave de un mensaje propio: deja el documento (con su
    // contenido) pero lo marca 'deleted' para que se muestre como
    // tombstone. Las reglas de Firestore solo permiten esto para el autor,
    // y solo para pasar 'deleted' a true (no para revertirlo).
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!currentUser || !userData?.partnerId) return;

        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
        const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageId);

        try {
            await updateDoc(messageRef, { deleted: true });
            setLiveMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true } : m));
            setEarlierMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true } : m));
        } catch (error) {
            console.error('Error eliminando mensaje:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo eliminar el mensaje',
            });
        }
    }, [currentUser, userData?.partnerId]);

    return {
        currentUser,
        loading,
        messages,
        hasMoreMessages,
        historyLimitReached,
        isLoadingEarlier,
        handleLoadEarlier,
        onSend,
        deleteMessage,
    };
}
