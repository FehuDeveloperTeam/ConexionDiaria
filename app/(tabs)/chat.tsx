import React, { useState, useEffect, useCallback } from 'react';
import { View, useColorScheme, Platform, KeyboardAvoidingView } from 'react-native';
import { GiftedChat, Composer, Send, IMessage, InputToolbar, Actions } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import {
  collection,
  addDoc,
  updateDoc,
  increment,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
  DocumentData,
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

    useEffect(() => {
        const fetchUserData = async (currentUser: FirebaseUser) => {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                setUserData(userDocSnap.data());
            } else {
                router.replace('/home');
            }
        };
        if (auth.currentUser) {
            fetchUserData(auth.currentUser);
        }
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
                    _id: doc.id,
                    text: data.text,
                    createdAt: data.createdAt.toDate(),
                    user: data.user,
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
            user: {
                _id: currentUserUid,
                name: userData.displayName,
            },
        });
    }, [userData]);

    const handleMissYouPress = useCallback(async () => {
        if (!userData || !userData.partnerId) return;
        const currentUserUid = auth.currentUser!.uid;
        const partnerUid = userData.partnerId;
        const chatId = [currentUserUid, partnerUid].sort().join('_');
        const relationshipDocRef = doc(db, 'relationships', chatId);
        try {
            await updateDoc(relationshipDocRef, {
                missYouCount: increment(1)
            });
        } catch (error) {
            if ((error as any).code === 'not-found') {
                await setDoc(relationshipDocRef, { missYouCount: 1 }, { merge: true });
            } else {
                console.error("Error al enviar 'miss you':", error);
            }
        }
    }, [userData]);

    if (!theme) {
        return null;
    }

    const MAX_COMPOSER_HEIGHT = 100;

    // --- CORRECCIÓN: Un único y correcto return ---
    return (
        <View style={{ flex: 1, backgroundColor: theme.background }}>
            <GiftedChat
                messages={messages}
                onSend={messages => onSend(messages)}
                user={{
                    _id: auth.currentUser?.uid || 'anonymous',
                    name: userData?.displayName || 'Tú',
                }}
                placeholder="Escribe un mensaje..."
                messagesContainerStyle={{ backgroundColor: theme.background }}
                renderUsernameOnMessage={true}
                alwaysShowSend={true}
                minInputToolbarHeight={MAX_COMPOSER_HEIGHT}

                renderInputToolbar={props => (
                    <InputToolbar
                        {...props}
                        containerStyle={{
                            backgroundColor: theme.background,
                            borderTopColor: 'transparent',
                        }}
                        primaryStyle={{ alignItems: 'flex-end' }}
                    />
                )}
                
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
                            marginLeft: 0,
                            marginRight: 10,
                            lineHeight: 20,
                        }}
                        textInputProps={{ multiline: true }}
                    />
                )}

                renderSend={props => (
                    <Send {...props} containerStyle={{ justifyContent: 'center', height: '100%', marginRight: 10 }}>
                        <View style={{ 
                            backgroundColor: theme.primary, 
                            borderRadius: 25, 
                            width: 44, 
                            height: 44, 
                            justifyContent: 'center', 
                            alignItems: 'center' 
                        }}>
                            <Feather name="arrow-up" size={24} color={theme.white} />
                        </View>
                    </Send>
                )}

                renderActions={props => (
                    <Actions
                        {...props}
                        containerStyle={{
                            width: 44,
                            height: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: 4,
                            marginRight: 4,
                            marginBottom: 0,
                        }}
                        icon={() => (
                            <Ionicons name="heart-circle-outline" size={32} color={theme.primary} />
                        )}
                        onPressActionButton={handleMissYouPress}
                    />
                )}
            />
            {Platform.OS === 'android' && <KeyboardAvoidingView behavior="padding" />}
        </View>
    );
};

export default Chat;