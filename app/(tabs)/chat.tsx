import React, { useState, useEffect, useCallback } from 'react';
import { View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { GiftedChat, IMessage, InputToolbar, Composer, Send, Actions } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  DocumentData,
  updateDoc,
  increment,
  setDoc,
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Feather, Ionicons } from '@expo/vector-icons';

const Chat: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const router = useRouter();

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [userData, setUserData] = useState<DocumentData | null>(null);

    // ... (la lógica de useEffect y onSend no necesita cambios, está perfecta)
    useEffect(() => {
        const fetchUserData = async (currentUser: FirebaseUser) => {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) { setUserData(userDocSnap.data()); }
            else { router.replace('/home'); }
        };
        if (auth.currentUser) { fetchUserData(auth.currentUser); }
    }, []);

    useEffect(() => {
        if (!userData || !userData.partnerId) return;
        const currentUserUid = auth.currentUser!.uid;
        const partnerUid = userData.partnerId;
        const chatId = [currentUserUid, partnerUid].sort().join('_');
        const messagesCollectionRef = collection(db, 'relationships', chatId, 'messages');
        const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    _id: doc.id, text: data.text, createdAt: data.createdAt.toDate(), user: data.user,
                };
            });
            setMessages(fetchedMessages as IMessage[]);
        });
        return () => unsubscribe();
    }, [userData]);
    
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!userData || !userData.partnerId) return;
        const currentUserUid = auth.currentUser!.uid;
        const partnerUid = userData.partnerId;
        const chatId = [currentUserUid, partnerUid].sort().join('_');
        const messagesCollectionRef = collection(db, 'relationships', chatId, 'messages');
        const messageToSend = newMessages[0];
        await addDoc(messagesCollectionRef, {
            text: messageToSend.text,
            createdAt: messageToSend.createdAt,
            user: { _id: currentUserUid, name: userData.displayName, },
        });
    }, [userData]);

    const handleMissYouPress = useCallback(async () => {
        if (!userData || !userData.partnerId) return;
        const currentUserUid = auth.currentUser!.uid;
        const partnerUid = userData.partnerId;
        const chatId = [currentUserUid, partnerUid].sort().join('_');
        const relationshipDocRef = doc(db, 'relationships', chatId);
        try {
            await updateDoc(relationshipDocRef, { missYouCount: increment(1) });
        } catch (error) {
            if ((error as any).code === 'not-found') {
                await setDoc(relationshipDocRef, { missYouCount: 1 }, { merge: true });
            } else {
                console.error("Error al enviar 'miss you':", error);
            }
        }
    }, [userData]);

    if (!theme) return null;

    return (
        // 1. Contenedor principal que ocupa toda la pantalla
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <GiftedChat
                messages={messages}
                onSend={messages => onSend(messages)}
                user={{
                    _id: auth.currentUser?.uid || 'anonymous',
                    name: userData?.displayName || 'Tú',
                }}
                placeholder="Escribe un mensaje..."
                messagesContainerStyle={{ backgroundColor: theme.background, paddingBottom: 20 }}
                renderUsernameOnMessage={true}
                alwaysShowSend={true}
                minInputToolbarHeight={100}

                // 2. Personalizamos el Input Toolbar para que ocupe todo el ancho
                renderInputToolbar={props => (
                    <InputToolbar
                        {...props}
                        containerStyle={{
                            backgroundColor: theme.background,
                            borderTopColor: 'transparent',
                            paddingHorizontal: 0, // Sin padding horizontal en el contenedor
                            paddingVertical: 6,
                        }}
                        primaryStyle={{ alignItems: 'flex-end' }}
                    />
                )}
                
                // 3. El Composer (campo de texto) ahora tiene márgenes para dar espacio a los botones
                renderComposer={props => (
                    <Composer
                        {...props}
                        textInputStyle={{
                            backgroundColor: theme.inputBackground,
                            color: theme.text,
                            borderRadius: 20,
                            paddingTop: 10,
                            paddingBottom: 10,
                            paddingHorizontal: 12,
                            marginLeft: 10, // Margen para el botón de corazón
                            marginRight: 10, // Margen para el botón de enviar
                            lineHeight: 20,
                        }}
                        textInputProps={{ multiline: true }}
                    />
                )}

                // 4. El botón de enviar ahora está dentro de los límites
                renderSend={props => (
                    <Send {...props} containerStyle={{ justifyContent: 'center', height: '100%', paddingRight: 10 }}>
                        <View style={{ backgroundColor: theme.primary, borderRadius: 25, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                            <Feather name="arrow-up" size={24} color={theme.white} />
                        </View>
                    </Send>
                )}

                renderActions={props => (
                    <Actions
                        {...props}
                        containerStyle={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            height: '100%',
                            paddingLeft: 10,
                        }}
                        icon={() => (<Ionicons name="heart-circle-outline" size={32} color={theme.primary} />)}
                        onPressActionButton={handleMissYouPress}
                    />
                )}
            />
            
            {/* 5. KeyboardAvoidingView para iOS, para que el teclado empuje el chat hacia arriba */}
            {Platform.OS === 'ios' && <KeyboardAvoidingView behavior="padding" />}
        </View>
    );
};

export default Chat;