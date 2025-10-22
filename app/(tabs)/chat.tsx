import React, { useState, useEffect, useCallback } from 'react';
import { View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
  DocumentData,
  writeBatch,
  increment
} from 'firebase/firestore';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { Feather, Ionicons } from '@expo/vector-icons';

const ChatScreen: React.FC = () => {
    // --- Hooks ---
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const router = useRouter();
    const headerHeight = useHeaderHeight();
    const insets = useSafeAreaInsets();

    // --- Estados ---
    const [messages, setMessages] = useState<IMessage[]>([]);
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [partnerData, setPartnerData] = useState<DocumentData | null>(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);

    // --- Efectos para Carga de Datos ---
    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null);
                setPartnerData(null);
                setMessages([]);
                setLoading(false);
                router.replace('/(tabs)/login');
            }
        });
        return () => unsubscribeAuth();
    }, [router]);

    useEffect(() => {
        if (!user) return;

        let unsubscribeUser: () => void = () => {};
        let unsubscribePartner: () => void = () => {};
        let unsubscribeMessages: () => void = () => {};

        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                unsubscribePartner();
                unsubscribeMessages();

                if (data.partnerId) {
                    const partnerDocRef = doc(db, 'users', data.partnerId);
                    unsubscribePartner = onSnapshot(partnerDocRef, (partnerSnap) => {
                        setPartnerData(partnerSnap.data() || null);
                    });

                    const chatId = [user.uid, data.partnerId].sort().join('_');
                    const messagesCollectionRef = collection(db, 'relationships', chatId, 'messages');
                    const q = query(messagesCollectionRef, orderBy('createdAt', 'desc'));
                    unsubscribeMessages = onSnapshot(q, (snapshot) => {
                        setMessages(snapshot.docs.map(doc => ({
                            _id: doc.id,
                            text: doc.data().text,
                            createdAt: doc.data().createdAt.toDate(),
                            user: doc.data().user,
                        })) as IMessage[]);
                        setLoading(false);
                    }, (error) => { console.error("Error fetching messages:", error); setLoading(false); });

                } else {
                    setPartnerData(null);
                    setMessages([]);
                    setLoading(false);
                }
            } else {
                auth.signOut();
                setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });

        return () => {
            unsubscribeUser();
            unsubscribePartner();
            unsubscribeMessages();
        };
    }, [user]);

    // --- Funciones de Manejo ---
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!userData || !userData.partnerId || !user) return;
        setInputText('');
        const currentUserUid = user.uid;
        try {
            await addDoc(collection(db, 'relationships', [currentUserUid, userData.partnerId].sort().join('_'), 'messages'), {
                text: newMessages[0].text,
                createdAt: newMessages[0].createdAt,
                user: { _id: currentUserUid, name: userData.displayName },
            });
        } catch (error) { console.error("Error sending message:", error); }
    }, [userData, user]);

    const handleMissYouPress = useCallback(async () => {
        if (!userData || !userData.partnerId || !user) return;
        const currentUserUid = user.uid;
        const chatId = [currentUserUid, userData.partnerId].sort().join('_');
        const today = new Date().toISOString().split('T')[0];
        const relationshipDocRef = doc(db, 'relationships', chatId);
        const historyDocRef = doc(db, 'relationships', chatId, 'missYouHistory', today);
        try {
            const batch = writeBatch(db);
            batch.set(relationshipDocRef, { missYouCounters: { [currentUserUid]: increment(1) } }, { merge: true });
            batch.set(historyDocRef, { [currentUserUid]: increment(1) }, { merge: true });
            await batch.commit();
        } catch (error) { console.error("Error al enviar 'miss you':", error); }
    }, [userData, user]);

    // --- Renderizado ---
    if (!theme) return null;
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }
    if (!user || !userData) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <Text style={{ color: theme.text }}>Error al cargar datos...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView 
            style={{ flex: 1, backgroundColor: theme.background }}
            edges={['top', 'left', 'right']}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
            >
                <GiftedChat
                    messages={messages}
                    onSend={messages => onSend(messages)}
                    user={{
                        _id: user.uid,
                        name: userData?.displayName || 'Tú',
                    }}
                    placeholder="Escribe un mensaje..."
                    
                    // Estilos del contenedor de mensajes - SIN padding extra
                    messagesContainerStyle={{ 
                        backgroundColor: theme.background,
                        paddingBottom: 0,
                    }}
                    
                    alwaysShowSend={true}
                    text={inputText}
                    onInputTextChanged={text => setInputText(text)}
                    
                    // KeyboardAvoidingView maneja el teclado
                    isKeyboardInternallyHandled={false}
                    bottomOffset={0}
                    
                    // Sin altura mínima forzada
                    minInputToolbarHeight={undefined}
                    
                    keyboardShouldPersistTaps="handled"
                    
                    renderInputToolbar={(toolbarProps) => (
                        <InputToolbar
                            {...toolbarProps}
                            containerStyle={{
                                backgroundColor: theme.background,
                                borderTopColor: theme.borderColor,
                                borderTopWidth: StyleSheet.hairlineWidth,
                                paddingHorizontal: 8,
                                paddingTop: 8,
                                // Solo añadir insets.bottom si existe (iOS con notch)
                                paddingBottom: Platform.OS === 'ios' && insets.bottom > 0 ? insets.bottom : 8,
                                // Sin minHeight forzado
                            }}
                            renderActions={() => (
                                <Actions
                                    {...toolbarProps}
                                    containerStyle={{ 
                                        width: 36, 
                                        height: 36, 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        marginLeft: 4,
                                        marginRight: 4,
                                        marginBottom: 4
                                    }}
                                    icon={() => (
                                        <Ionicons 
                                            name="heart-circle-outline" 
                                            size={32} 
                                            color={theme.primary} 
                                        />
                                    )}
                                    onPressActionButton={handleMissYouPress}
                                />
                            )}
                            renderComposer={(composerProps) => (
                                <Composer
                                    {...composerProps}
                                    textInputStyle={{
                                        backgroundColor: theme.inputBackground,
                                        color: theme.text,
                                        borderRadius: 20,
                                        paddingTop: Platform.OS === 'ios' ? 10 : 8,
                                        paddingBottom: Platform.OS === 'ios' ? 10 : 8,
                                        paddingHorizontal: 12,
                                        marginLeft: 0,
                                        marginTop: 0,
                                        marginBottom: 4,
                                        lineHeight: 20,
                                        maxHeight: 100,
                                    }}
                                    textInputProps={{
                                        multiline: true,
                                        returnKeyType: 'default',
                                        blurOnSubmit: false,
                                    }}
                                />
                            )}
                            renderSend={(sendProps) => (
                                <Send
                                    {...sendProps}
                                    disabled={!inputText.trim()}
                                    containerStyle={{
                                        width: 44,
                                        height: 44,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginLeft: 4,
                                        marginRight: 4,
                                        marginBottom: 4,
                                    }}
                                >
                                    <View
                                        style={{
                                            backgroundColor: inputText.trim().length > 0 
                                                ? theme.primary 
                                                : theme.placeholder,
                                            borderRadius: 22,
                                            width: 44,
                                            height: 44,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Feather name="arrow-up" size={24} color={theme.white} />
                                    </View>
                                </Send>
                            )}
                        />
                    )}
                />
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ChatScreen;