import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc,
    updateDoc, Timestamp, limit, getDocs, startAfter,
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
export function useChatMessages(userData: DocumentData | null, resetInput: () => void) {
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
        oldestMessageDocRef.current = null;

        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
        const messagesRef = collection(db, 'relationships', relationshipId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PAGE_SIZE));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const loadedMessages: ExtendedMessage[] = snapshot.docs.map(mapMessageDoc);

            console.log('📨 Mensajes cargados:', loadedMessages.length, 'primer mensaje:', loadedMessages[0]?._id);
            setLiveMessages(loadedMessages);
            setLoading(false);

            // El cursor de paginación se fija con la primera carga de esta
            // ventana en vivo. Los siguientes disparos del listener (por un
            // 'delivered'/'read' que cambia, por ejemplo) no deben moverlo —
            // eso rompería 'cargar mensajes anteriores' a mitad de sesión.
            if (oldestMessageDocRef.current === null) {
                oldestMessageDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
                setHasMoreMessages(snapshot.docs.length === MESSAGES_PAGE_SIZE);
            }

            // Marcar mensajes como entregados
            const undeliveredMessages = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.user._id !== currentUser.uid && !data.delivered;
            });

            for (const messageDoc of undeliveredMessages) {
                const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageDoc.id);
                await updateDoc(messageRef, { delivered: true });
            }

            // Marcar mensajes como leídos cuando la app está activa
            if (AppState.currentState === 'active') {
                const unreadMessages = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.user._id !== currentUser.uid && !data.read;
                });

                for (const messageDoc of unreadMessages) {
                    const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageDoc.id);
                    await updateDoc(messageRef, { read: true });
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser, userData?.partnerId]);

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
            const olderMessages = snapshot.docs.map(mapMessageDoc);

            setEarlierMessages(prev => [...prev, ...olderMessages]);
            if (snapshot.docs.length > 0) {
                oldestMessageDocRef.current = snapshot.docs[snapshot.docs.length - 1];
            }
            setHasMoreMessages(snapshot.docs.length === MESSAGES_PAGE_SIZE);
        } catch (error) {
            console.error('Error cargando mensajes anteriores:', error);
        } finally {
            setIsLoadingEarlier(false);
        }
    }, [currentUser, userData?.partnerId, isLoadingEarlier]);

    // Enviar mensaje de texto
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!currentUser || !userData?.partnerId) return;

        const message = newMessages[0];
        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');

        try {
            await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                text: message.text,
                createdAt: Timestamp.now(),
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

    return {
        currentUser,
        loading,
        messages,
        hasMoreMessages,
        isLoadingEarlier,
        handleLoadEarlier,
        onSend,
    };
}
