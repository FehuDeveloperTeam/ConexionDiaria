import React, { useState, useEffect, useCallback } from 'react';
import { View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Composer, Send, Actions } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
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
  writeBatch
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Feather, Ionicons } from '@expo/vector-icons';

// Corregimos el nombre del componente para que coincida con el nombre del archivo y la exportación.
const Chat: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const router = useRouter();
    const headerHeight = useHeaderHeight();

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [inputText, setInputText] = useState('');

    useEffect(() => {
        const fetchUserData = async (currentUser: FirebaseUser) => {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) { 
                setUserData(userDocSnap.data()); 
            } else { 
                router.replace('/(tabs)/home'); 
            }
        };
        if (auth.currentUser) { 
            fetchUserData(auth.currentUser); 
        }
    }, [router]);

    useEffect(() => {
        if (!userData || !userData.partnerId || !auth.currentUser) return;
        const currentUserUid = auth.currentUser.uid;
        const partnerUid = userData.partnerId;
        const chatId = [currentUserUid, partnerUid].sort().join('_');
        const messagesCollectionRef = collection(db, 'relationships', chatId, 'messages');
        const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({
                _id: doc.id,
                text: doc.data().text,
                createdAt: doc.data().createdAt.toDate(),
                user: doc.data().user,
            })) as IMessage[]);
        });
        return () => unsubscribe();
    }, [userData]);
    
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!userData || !userData.partnerId || !auth.currentUser) return;
        setInputText('');
        const currentUserUid = auth.currentUser.uid;
        await addDoc(collection(db, 'relationships', [currentUserUid, userData.partnerId].sort().join('_'), 'messages'), {
            text: newMessages[0].text,
            createdAt: newMessages[0].createdAt,
            user: { _id: currentUserUid, name: userData.displayName },
        });
    }, [userData]);

    const handleMissYouPress = useCallback(async () => {
        if (!userData || !userData.partnerId || !auth.currentUser) return;
        const currentUserUid = auth.currentUser.uid;
        const chatId = [currentUserUid, userData.partnerId].sort().join('_');
        const today = new Date().toISOString().split('T')[0];
        const relationshipDocRef = doc(db, 'relationships', chatId);
        const historyDocRef = doc(db, 'relationships', chatId, 'missYouHistory', today);
        try {
            const batch = writeBatch(db);
            batch.set(relationshipDocRef, { missYouCounters: { [currentUserUid]: increment(1) } }, { merge: true });
            batch.set(historyDocRef, { [currentUserUid]: increment(1) }, { merge: true });
            await batch.commit();
        } catch (error) { 
            console.error("Error al enviar 'miss you':", error); 
        }
    }, [userData]);

    if (!theme) return null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={headerHeight}
            >
                <GiftedChat
                    messages={messages}
                    onSend={messages => onSend(messages)}
                    user={{
                        _id: auth.currentUser?.uid || 'anonymous',
                        name: userData?.displayName || 'Tú',
                    }}
                    placeholder="Escribe un mensaje..."
                    messagesContainerStyle={{ backgroundColor: theme.background, paddingBottom: 0 }}
                    alwaysShowSend={true}
                    text={inputText}
                    onInputTextChanged={text => setInputText(text)}
                    renderInputToolbar={(toolbarProps) => (
                        <View style={{ 
                            flexDirection: 'row', 
                            alignItems: 'center', 
                            paddingHorizontal: 10, 
                            paddingTop: 8,
                            paddingBottom: Platform.OS === 'ios' ? 0 : 8, // No añadir padding extra en iOS con SafeAreaView
                            backgroundColor: theme.background,
                            borderTopColor: theme.borderColor,
                            borderTopWidth: StyleSheet.hairlineWidth,
                        }}>
                            <Actions {...toolbarProps} containerStyle={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 10 }} icon={() => (<Ionicons name="heart-circle-outline" size={32} color={theme.primary} />)} onPressActionButton={handleMissYouPress} />
                            <Composer {...toolbarProps} textInputStyle={{ flex: 1, backgroundColor: theme.inputBackground, color: theme.text, borderRadius: 20, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 12, lineHeight: 20, maxHeight: 100, }} textInputProps={{ multiline: true }} />
                            <Send {...toolbarProps} containerStyle={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}>
                                <View style={{ backgroundColor: inputText.trim().length > 0 ? theme.primary : theme.placeholder, borderRadius: 22, width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
                                    <Feather name="arrow-up" size={24} color={theme.white} />
                                </View>
                            </Send>
                        </View>
                    )}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default Chat;