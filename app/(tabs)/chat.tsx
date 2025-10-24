import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet, 
    ActivityIndicator, Text, TouchableOpacity, Image, LayoutAnimation, UIManager
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Composer, Send, Actions, Bubble } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc,
    DocumentData, writeBatch, increment
} from 'firebase/firestore';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { Feather, Ionicons } from '@expo/vector-icons';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Componente ChatHeader
const ChatHeader: React.FC<{
    partnerData: DocumentData | null;
    theme: any;
    onBack: () => void;
}> = ({ partnerData, theme, onBack }) => {
    const insets = useSafeAreaInsets();
    
    // Simulación de estado online (deberías implementar esto con Firestore)
    const isOnline = false; // Cambia esto según tu lógica
    const lastSeen = "Hace 2 horas"; // Implementa esto con datos reales

    return (
        <View style={{
            backgroundColor: theme.background,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.borderColor,
            paddingTop: insets.top,
            paddingHorizontal: 16,
            paddingBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
        }}>
            {/* Botón de regreso */}
            <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
                <Ionicons name="chevron-back" size={28} color={theme.primary} />
            </TouchableOpacity>

            {/* Foto de perfil */}
            <View style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: theme.placeholder,
                marginRight: 12,
                overflow: 'hidden',
            }}>
                {partnerData?.photoURL ? (
                    <Image 
                        source={{ uri: partnerData.photoURL }} 
                        style={{ width: '100%', height: '100%' }}
                    />
                ) : (
                    <View style={{ 
                        width: '100%', 
                        height: '100%', 
                        justifyContent: 'center', 
                        alignItems: 'center',
                        backgroundColor: theme.primary + '20'
                    }}>
                        <Text style={{ 
                            color: theme.primary, 
                            fontSize: 18, 
                            fontWeight: '600' 
                        }}>
                            {partnerData?.displayName?.[0]?.toUpperCase() || 'P'}
                        </Text>
                    </View>
                )}
                
                {/* Indicador online */}
                {isOnline && (
                    <View style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: '#4CAF50',
                        borderWidth: 2,
                        borderColor: theme.background,
                    }} />
                )}
            </View>

            {/* Nombre y estado */}
            <View style={{ flex: 1 }}>
                <Text style={{ 
                    color: theme.text, 
                    fontSize: 16, 
                    fontWeight: '600',
                    marginBottom: 2,
                }}>
                    {partnerData?.displayName || 'Tu pareja'}
                </Text>
                <Text style={{ 
                    color: theme.placeholder, 
                    fontSize: 12,
                }}>
                    {isOnline ? 'En línea' : lastSeen}
                </Text>
            </View>
        </View>
    );
};

const ChatScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const router = useRouter();
    const headerHeight = useHeaderHeight();
    const insets = useSafeAreaInsets();

    const [messages, setMessages] = useState<IMessage[]>([]);
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [partnerData, setPartnerData] = useState<DocumentData | null>(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Animación suave del teclado
    useEffect(() => {
        const configureAnimation = () => {
            LayoutAnimation.configureNext(
                LayoutAnimation.create(
                    250, // Duración en ms
                    LayoutAnimation.Types.easeInEaseOut,
                    LayoutAnimation.Properties.opacity
                )
            );
        };

        const keyboardWillShow = () => {
            configureAnimation();
            setKeyboardVisible(true);
        };

        const keyboardWillHide = () => {
            configureAnimation();
            setKeyboardVisible(false);
        };

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showListener = require('react-native').Keyboard.addListener(showEvent, keyboardWillShow);
        const hideListener = require('react-native').Keyboard.addListener(hideEvent, keyboardWillHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null);
                setPartnerData(null);
                setMessages([]);
                setLoading(false);
                router.replace('/login');
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
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['left', 'right']}>
            {/* Header del chat */}
            <ChatHeader 
                partnerData={partnerData} 
                theme={theme}
                onBack={() => router.back()}
            />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <GiftedChat
                    messages={messages}
                    onSend={messages => onSend(messages)}
                    user={{
                        _id: user.uid,
                        name: userData?.displayName || 'Tú',
                    }}
                    placeholder="Escribe un mensaje..."
                    messagesContainerStyle={{ 
                        backgroundColor: theme.background,
                        paddingBottom: 0,
                    }}
                    alwaysShowSend={true}
                    text={inputText}
                    onInputTextChanged={text => setInputText(text)}
                    isKeyboardInternallyHandled={false}
                    bottomOffset={0}
                    minInputToolbarHeight={undefined}
                    keyboardShouldPersistTaps="handled"
                    
                    // Estilo de las burbujas
                    renderBubble={(props) => (
                        <Bubble
                            {...props}
                            wrapperStyle={{
                                left: {
                                    backgroundColor: theme.inputBackground,
                                },
                                right: {
                                    backgroundColor: theme.primary,
                                },
                            }}
                            textStyle={{
                                left: {
                                    color: theme.text,
                                },
                                right: {
                                    color: theme.white,
                                },
                            }}
                        />
                    )}
                    
                    renderInputToolbar={(toolbarProps) => (
                        <InputToolbar
                            {...toolbarProps}
                            containerStyle={{
                                backgroundColor: theme.background,
                                borderTopColor: theme.borderColor,
                                borderTopWidth: StyleSheet.hairlineWidth,
                                paddingHorizontal: 8,
                                paddingTop: 8,
                                paddingBottom: Platform.OS === 'ios' && insets.bottom > 0 ? insets.bottom : 8,
                            }}
                            renderActions={() => (
                                <Actions
                                    {...toolbarProps}
                                    containerStyle={{ 
                                        width: 36, height: 36, alignItems: 'center', 
                                        justifyContent: 'center', marginLeft: 4, marginRight: 4, marginBottom: 4 
                                    }}
                                    icon={() => (<Ionicons name="heart-circle-outline" size={32} color={theme.primary} />)}
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
                                        width: 44, height: 44, alignItems: 'center',
                                        justifyContent: 'center', marginLeft: 4, marginRight: 4, marginBottom: 4,
                                    }}
                                >
                                    <View
                                        style={{
                                            backgroundColor: inputText.trim().length > 0 
                                                ? theme.primary 
                                                : theme.placeholder,
                                            borderRadius: 22, width: 44, height: 44,
                                            justifyContent: 'center', alignItems: 'center',
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