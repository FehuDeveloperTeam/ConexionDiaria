import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet, 
    ActivityIndicator, Text, TouchableOpacity, Image, LayoutAnimation, UIManager, AppState,
    Alert, Linking, Keyboard
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Composer, Send, Actions, Bubble } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc,
    DocumentData, updateDoc, Timestamp
} from 'firebase/firestore';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useActionSheet, ActionSheetProvider } from '@expo/react-native-action-sheet';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import { Audio } from 'expo-av';
import Toast from 'react-native-toast-message';

// Extender el tipo IMessage para incluir campos personalizados
interface ExtendedMessage extends IMessage {
    audio?: string;
    file?: string;
    fileName?: string;
    fileSize?: number;
}

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Función helper para convertir URI a Blob
const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) { 
            console.error("uriToBlob falló:", e);
            reject(new TypeError("Network request failed")); 
        };
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
};

// Componente ChatHeader
const ChatHeader: React.FC<{
    partnerData: DocumentData | null;
    theme: any;
    onBack: () => void;
}> = ({ partnerData, theme, onBack }) => {
    const insets = useSafeAreaInsets();
    
    const lastSeenDate = partnerData?.lastSeen?.toDate();
    const now = new Date();
    const timeSinceLastSeen = lastSeenDate ? now.getTime() - lastSeenDate.getTime() : Infinity;
    const isOnline = partnerData?.isOnline && timeSinceLastSeen < 30000;
    
    const getLastSeenText = () => {
        if (!lastSeenDate) return "Sin conexión reciente";
        
        const diffMs = now.getTime() - lastSeenDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return "Hace un momento";
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays === 1) return "Ayer";
        if (diffDays < 7) return `Hace ${diffDays} días`;
        return lastSeenDate.toLocaleDateString();
    };
    
    const lastSeen = getLastSeenText();

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
            <TouchableOpacity onPress={onBack} style={{ marginRight: 12 }}>
                <Ionicons name="chevron-back" size={28} color={theme.primary} />
            </TouchableOpacity>

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

// Componente para renderizar nota de voz
const AudioMessage: React.FC<{ currentMessage: any; theme: any }> = ({ currentMessage, theme }) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    useEffect(() => {
        return sound ? () => { sound.unloadAsync(); } : undefined;
    }, [sound]);

    const playSound = async () => {
        try {
            if (sound) {
                if (isPlaying) {
                    await sound.pauseAsync();
                    setIsPlaying(false);
                } else {
                    await sound.playAsync();
                    setIsPlaying(true);
                }
            } else {
                const { sound: newSound } = await Audio.Sound.createAsync(
                    { uri: currentMessage.audio },
                    { shouldPlay: true },
                    onPlaybackStatusUpdate
                );
                setSound(newSound);
                setIsPlaying(true);
            }
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setPosition(status.positionMillis || 0);
            
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
            }
        }
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 8,
            minWidth: 200,
        }}>
            <TouchableOpacity onPress={playSound} style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.primary + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 8,
            }}>
                <Ionicons 
                    name={isPlaying ? "pause" : "play"} 
                    size={20} 
                    color={theme.primary} 
                />
            </TouchableOpacity>
            
            <View style={{ flex: 1 }}>
                <View style={{
                    height: 3,
                    backgroundColor: theme.placeholder + '30',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                }}>
                    <View style={{
                        height: '100%',
                        backgroundColor: theme.primary,
                        width: duration > 0 ? `${(position / duration) * 100}%` : '0%',
                    }} />
                </View>
                <Text style={{
                    fontSize: 11,
                    color: theme.placeholder,
                    marginTop: 4,
                }}>
                    {formatTime(position)} / {formatTime(duration)}
                </Text>
            </View>
        </View>
    );
};

// Componente para renderizar archivos
const FileMessage: React.FC<{ currentMessage: any; theme: any }> = ({ currentMessage, theme }) => {
    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleDownload = () => {
        if (currentMessage.file) {
            Linking.openURL(currentMessage.file);
        }
    };

    return (
        <TouchableOpacity 
            onPress={handleDownload}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 12,
                minWidth: 200,
            }}
        >
            <View style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                backgroundColor: theme.primary + '20',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
            }}>
                <MaterialIcons name="insert-drive-file" size={24} color={theme.primary} />
            </View>
            
            <View style={{ flex: 1 }}>
                <Text style={{
                    fontSize: 14,
                    color: theme.text,
                    fontWeight: '500',
                    marginBottom: 2,
                }} numberOfLines={1}>
                    {currentMessage.fileName || 'Archivo'}
                </Text>
                <Text style={{
                    fontSize: 12,
                    color: theme.placeholder,
                }}>
                    {formatFileSize(currentMessage.fileSize)}
                </Text>
            </View>

            <Ionicons name="download-outline" size={20} color={theme.primary} />
        </TouchableOpacity>
    );
};

const ChatScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const router = useRouter();
    const headerHeight = useHeaderHeight();
    const insets = useSafeAreaInsets();
    const { showActionSheetWithOptions } = useActionSheet();

    const [messages, setMessages] = useState<ExtendedMessage[]>([]);
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [partnerData, setPartnerData] = useState<DocumentData | null>(null);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    
    // Estados para grabación de audio
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);

    useEffect(() => {
        const configureAnimation = () => {
            LayoutAnimation.configureNext(
                LayoutAnimation.create(
                    250,
                    LayoutAnimation.Types.easeInEaseOut,
                    LayoutAnimation.Properties.opacity
                )
            );
        };

        const keyboardWillShow = () => {
            configureAnimation();
        };

        const keyboardWillHide = () => {
            configureAnimation();
        };

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showListener = Keyboard.addListener(showEvent, keyboardWillShow);
        const hideListener = Keyboard.addListener(hideEvent, keyboardWillHide);

        return () => {
            showListener.remove();
            hideListener.remove();
        };
    }, []);

    // Contador de duración de grabación
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } else {
            setRecordingDuration(0);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

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

        const userStatusRef = doc(db, 'users', user.uid);
        let updateInterval: ReturnType<typeof setInterval>;
        
        const setUserOnline = async () => {
            try {
                await updateDoc(userStatusRef, {
                    isOnline: true,
                    lastSeen: Timestamp.now(),
                });
            } catch (error) {
                console.error('Error setting user online:', error);
            }
        };

        const setUserOffline = () => {
            if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
                const url = `https://firestore.googleapis.com/v1/projects/${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${user.uid}`;
                const data = JSON.stringify({
                    fields: {
                        isOnline: { booleanValue: false },
                        lastSeen: { timestampValue: new Date().toISOString() }
                    }
                });
                navigator.sendBeacon(url, data);
            }
            
            updateDoc(userStatusRef, {
                isOnline: false,
                lastSeen: Timestamp.now(),
            }).catch(console.error);
        };

        setUserOnline();

        updateInterval = setInterval(() => {
            if (AppState.currentState === 'active') {
                setUserOnline();
            }
        }, 15000);

        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                await setUserOnline();
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                setUserOffline();
            }
        });

        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
            const handleBeforeUnload = () => {
                setUserOffline();
            };
            
            const handleVisibilityChange = () => {
                if (document.hidden) {
                    setUserOffline();
                } else {
                    setUserOnline();
                }
            };

            window.addEventListener('beforeunload', handleBeforeUnload);
            document.addEventListener('visibilitychange', handleVisibilityChange);
            
            return () => {
                clearInterval(updateInterval);
                setUserOffline();
                subscription.remove();
                window.removeEventListener('beforeunload', handleBeforeUnload);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            };
        }

        return () => {
            clearInterval(updateInterval);
            setUserOffline();
            subscription.remove();
        };
    }, [user]);

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
                            text: doc.data().text || '',
                            createdAt: doc.data().createdAt.toDate(),
                            user: doc.data().user,
                            image: doc.data().image || undefined,
                            video: doc.data().video || undefined,
                            audio: doc.data().audio || undefined,
                            file: doc.data().file || undefined,
                            fileName: doc.data().fileName || undefined,
                            fileSize: doc.data().fileSize || undefined,
                        })) as ExtendedMessage[]);
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

    const onSend = useCallback(async (newMessages: ExtendedMessage[] = []) => {
        if (!userData || !userData.partnerId || !user) return;
        
        const message = newMessages[0];
        
        if (message.text) {
            setInputText('');
        }

        const currentUserUid = user.uid;
        
        const messageData: any = {
            createdAt: message.createdAt,
            user: { _id: currentUserUid, name: userData.displayName },
            text: message.text || '',
        };

        // Agregar campos multimedia si existen
        if (message.image) messageData.image = message.image;
        if (message.video) messageData.video = message.video;
        if (message.audio) messageData.audio = message.audio;
        if (message.file) {
            messageData.file = message.file;
            messageData.fileName = message.fileName;
            messageData.fileSize = message.fileSize;
        }

        try {
            await addDoc(collection(db, 'relationships', [currentUserUid, userData.partnerId].sort().join('_'), 'messages'), messageData);
        } catch (error) { 
            console.error("Error sending message:", error);
            Toast.show({ type: 'error', text1: 'Error al enviar mensaje' });
        }
    }, [userData, user]);

    // Función para subir archivo a Firebase Storage
    const uploadFile = async (fileUri: string, fileType: 'image' | 'video' | 'audio' | 'file', fileName?: string) => {
        try {
            let finalUri = fileUri;
            
            // Comprimir imágenes
            if (fileType === 'image') {
                const manipResult = await ImageManipulator.manipulateAsync(
                    fileUri,
                    [{ resize: { width: 1080 } }],
                    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
                );
                finalUri = manipResult.uri;
            }

            const blob = await uriToBlob(finalUri);
            const chatId = [user!.uid, userData!.partnerId].sort().join('_');
            const extension = fileType === 'image' ? 'jpg' : 
                             fileType === 'video' ? 'mp4' : 
                             fileType === 'audio' ? 'm4a' : 
                             fileName?.split('.').pop() || 'bin';
            const uploadFileName = `${Crypto.randomUUID()}.${extension}`;
            const storageRef = ref(storage, `chatMedia/${chatId}/${uploadFileName}`);
            
            const uploadTask = uploadBytesResumable(storageRef, blob);

            return new Promise<string>((resolve, reject) => {
                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(progress);
                    }, 
                    (error) => {
                        console.error("Error al subir archivo:", error);
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        resolve(downloadURL);
                    }
                );
            });
        } catch (error) {
            console.error("Error procesando archivo:", error);
            throw error;
        }
    };

    // Función para elegir foto/video
    const handlePickMedia = async () => {
        if (isUploading) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Se necesita acceso a la galería.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.7,
        });

        if (result.canceled || !result.assets || !result.assets[0]) return;

        const asset = result.assets[0];
        setIsUploading(true);
        Toast.show({ type: 'info', text1: 'Subiendo archivo...' });

        try {
            const fileType: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
            const downloadURL = await uploadFile(asset.uri, fileType);
            
            const newMessage: ExtendedMessage = {
                _id: Crypto.randomUUID(),
                text: '',
                createdAt: new Date(),
                user: { _id: user!.uid, name: userData!.displayName },
                [fileType]: downloadURL,
            };

            onSend([newMessage]);
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'success', text1: 'Archivo enviado' });
        } catch (error) {
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'error', text1: 'Error al subir el archivo' });
        }
    };

    // Función para tomar foto
    const handleTakePhoto = async () => {
        if (isUploading) return;

        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Se necesita acceso a la cámara.");
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            quality: 0.7,
        });

        if (result.canceled || !result.assets || !result.assets[0]) return;

        setIsUploading(true);
        Toast.show({ type: 'info', text1: 'Subiendo foto...' });

        try {
            const downloadURL = await uploadFile(result.assets[0].uri, 'image');
            
            const newMessage: ExtendedMessage = {
                _id: Crypto.randomUUID(),
                text: '',
                createdAt: new Date(),
                user: { _id: user!.uid, name: userData!.displayName },
                image: downloadURL,
            };

            onSend([newMessage]);
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'success', text1: 'Foto enviada' });
        } catch (error) {
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'error', text1: 'Error al subir la foto' });
        }
    };

    // Función para grabar audio
    const startRecording = async () => {
        try {
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permisos necesarios", "Se necesita acceso al micrófono.");
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            setRecording(recording);
            setIsRecording(true);
        } catch (err) {
            console.error('Failed to start recording', err);
            Alert.alert('Error', 'No se pudo iniciar la grabación');
        }
    };

    const stopRecording = async () => {
        if (!recording) return;

        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);

        if (!uri) return;

        setIsUploading(true);
        Toast.show({ type: 'info', text1: 'Enviando nota de voz...' });

        try {
            const downloadURL = await uploadFile(uri, 'audio');
            
            const newMessage: ExtendedMessage = {
                _id: Crypto.randomUUID(),
                createdAt: new Date(),
                user: { _id: user!.uid, name: userData!.displayName },
                text: "",
                audio: downloadURL,
            };

            onSend([newMessage]);
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'success', text1: 'Nota de voz enviada' });
        } catch (error) {
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'error', text1: 'Error al enviar nota de voz' });
        }
    };

    const cancelRecording = async () => {
        if (!recording) return;
        
        setIsRecording(false);
        await recording.stopAndUnloadAsync();
        setRecording(null);
    };

    // Función para elegir documento
    const handlePickDocument = async () => {
        if (isUploading) return;

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || !result.assets[0]) return;

            const asset = result.assets[0];
            
            // Límite de 10MB para archivos
            if (asset.size && asset.size > 10 * 1024 * 1024) {
                Alert.alert('Archivo muy grande', 'El archivo no puede superar los 10MB');
                return;
            }

            setIsUploading(true);
            Toast.show({ type: 'info', text1: 'Subiendo archivo...' });

            const downloadURL = await uploadFile(asset.uri, 'file', asset.name);
            
            const newMessage: ExtendedMessage = {
                _id: Crypto.randomUUID(),
                createdAt: new Date(),
                user: { _id: user!.uid, name: userData!.displayName },
                text: '',
                file: downloadURL,
                fileName: asset.name,
                fileSize: asset.size,
            };

            onSend([newMessage]);
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'success', text1: 'Archivo enviado' });
        } catch (error) {
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'error', text1: 'Error al subir el archivo' });
        }
    };

    // Menú de opciones multimedia
    const showAttachmentMenu = () => {
        const options = ['📷 Cámara', '🖼️ Galería', '🎤 Nota de voz', '📎 Archivo', 'Cancelar'];
        const cancelButtonIndex = 4;

        showActionSheetWithOptions(
            { 
                options, 
                cancelButtonIndex,
                title: 'Enviar multimedia',
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    handleTakePhoto();
                } else if (buttonIndex === 1) {
                    handlePickMedia();
                } else if (buttonIndex === 2) {
                    startRecording();
                } else if (buttonIndex === 3) {
                    handlePickDocument();
                }
            }
        );
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

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
            <ChatHeader 
                partnerData={partnerData} 
                theme={theme}
                onBack={() => router.back()}
            />

            {/* Indicador de subida */}
            {isUploading && (
                <View style={{
                    padding: 8,
                    backgroundColor: theme.inputBackground,
                    alignItems: 'center',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    gap: 10,
                }}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={{ color: theme.placeholder, fontSize: 12 }}>
                        Subiendo... {Math.round(uploadProgress)}%
                    </Text>
                </View>
            )}

            {/* Indicador de grabación */}
            {isRecording && (
                <View style={{
                    padding: 12,
                    backgroundColor: '#FF5252',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{
                            width: 12,
                            height: 12,
                            borderRadius: 6,
                            backgroundColor: '#FFF',
                        }} />
                        <Text style={{ color: '#FFF', fontWeight: '600' }}>
                            Grabando... {formatRecordingTime(recordingDuration)}
                        </Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity 
                            onPress={cancelRecording}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 6,
                                borderRadius: 16,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                            }}
                        >
                            <Text style={{ color: '#FFF', fontWeight: '600' }}>Cancelar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={stopRecording}
                            style={{
                                paddingHorizontal: 16,
                                paddingVertical: 6,
                                borderRadius: 16,
                                backgroundColor: '#FFF',
                            }}
                        >
                            <Text style={{ color: '#FF5252', fontWeight: '600' }}>Enviar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

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
                    renderAvatar={null}
                    showUserAvatar={false}
                    showAvatarForEveryMessage={false}
                    
                    // Props para renderizar multimedia
                    renderMessageImage={(props) => {
                        return (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (props.currentMessage?.image) {
                                        Linking.openURL(props.currentMessage.image);
                                    }
                                }}
                            >
                                <Image 
                                    source={{ uri: props.currentMessage?.image }}
                                    style={styles.chatImage}
                                />
                            </TouchableOpacity>
                        );
                    }}
                    
                    renderMessageVideo={(props) => {
                        return (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (props.currentMessage?.video) {
                                        Linking.openURL(props.currentMessage.video);
                                    }
                                }}
                                style={styles.chatImage}
                            >
                                <View style={{
                                    ...styles.chatImage,
                                    backgroundColor: theme.placeholder + '30',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}>
                                    <Ionicons name="play-circle" size={50} color={theme.white} />
                                    <Text style={{ 
                                        color: theme.white, 
                                        fontSize: 12, 
                                        marginTop: 8,
                                        fontWeight: '500' 
                                    }}>
                                        Toca para reproducir
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    
                    // Estilo de las burbujas
                    renderBubble={(props) => {
                        // Renderizar nota de voz
                        if (props.currentMessage?.audio) {
                            return (
                                <View style={{
                                    marginVertical: 4,
                                    marginHorizontal: 8,
                                }}>
                                    <View style={{
                                        backgroundColor: props.position === 'right' ? theme.primary : theme.inputBackground,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                    }}>
                                        <AudioMessage currentMessage={props.currentMessage} theme={theme} />
                                    </View>
                                </View>
                            );
                        }

                        // Renderizar archivo
                        if (props.currentMessage?.file) {
                            return (
                                <View style={{
                                    marginVertical: 4,
                                    marginHorizontal: 8,
                                }}>
                                    <View style={{
                                        backgroundColor: props.position === 'right' ? theme.primary : theme.inputBackground,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                    }}>
                                        <FileMessage currentMessage={props.currentMessage} theme={theme} />
                                    </View>
                                </View>
                            );
                        }

                        // Burbuja normal
                        return (
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
                        );
                    }}
                    
                    renderInputToolbar={(toolbarProps) => (
                        <InputToolbar
                            {...toolbarProps}
                            containerStyle={{
                                backgroundColor: theme.background,
                                borderTopColor: theme.borderColor,
                                borderTopWidth: StyleSheet.hairlineWidth,
                                paddingHorizontal: 8,
                                paddingTop: 8,
                                paddingBottom: Platform.OS === 'ios' && insets.bottom > 0 ? insets.bottom / 2 : 8,
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
                                            name="add-circle" 
                                            size={32} 
                                            color={theme.primary} 
                                        />
                                    )}
                                    onPressActionButton={showAttachmentMenu}
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

            {/* Toast Container */}
            <Toast />
        </SafeAreaView>
    );
};

// Estilos
const styles = StyleSheet.create({
    chatImage: {
        width: 250,
        height: 150,
        borderRadius: 13,
        margin: 3,
        resizeMode: 'cover',
    }
});

// Exportar envuelto en ActionSheetProvider
const ChatScreenWithActions = () => {
    return (
        <ActionSheetProvider>
            <ChatScreen />
        </ActionSheetProvider>
    );
};

export default ChatScreenWithActions;