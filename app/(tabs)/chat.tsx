import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet, 
    ActivityIndicator, Text, TouchableOpacity, Image, LayoutAnimation, UIManager, AppState,
    Alert, Linking, Keyboard, Modal, Dimensions, Animated
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Composer, Send, Actions, Bubble } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { useHeaderHeight } from '@react-navigation/elements';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc,
    DocumentData, updateDoc, Timestamp, deleteDoc, setDoc
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Extender el tipo IMessage para incluir campos personalizados
interface ExtendedMessage extends IMessage {
    audio?: string;
    file?: string;
    fileName?: string;
    fileSize?: number;
    delivered?: boolean;
    read?: boolean;
    audioPlayed?: boolean;
    deleted?: boolean;
    sentAt?: Date;
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

// Componente de palomas de estado
const MessageStatus: React.FC<{ message: ExtendedMessage; isOwn: boolean }> = ({ message, isOwn }) => {
    if (!isOwn || message.deleted) return null;

    const getStatusIcon = () => {
        if (message.read) {
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: -4 }}>
                    <Ionicons name="checkmark" size={14} color="#FF69B4" />
                    <Ionicons name="checkmark" size={14} color="#FF69B4" />
                </View>
            );
        }
        if (message.delivered) {
            return (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: -4 }}>
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                </View>
            );
        }
        return <Ionicons name="checkmark" size={14} color="#FFF" />;
    };

    return (
        <View style={{ marginLeft: 4, marginTop: 2 }}>
            {getStatusIcon()}
        </View>
    );
};

// Componente ImageViewer Modal
const ImageViewerModal: React.FC<{
    visible: boolean;
    imageUri: string;
    onClose: () => void;
}> = ({ visible, imageUri, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.95)',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <TouchableOpacity 
                    style={{
                        position: 'absolute',
                        top: 50,
                        left: 20,
                        zIndex: 10,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        padding: 8,
                    }}
                    onPress={onClose}
                >
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>

                <Image
                    source={{ uri: imageUri }}
                    style={{
                        width: SCREEN_WIDTH,
                        height: SCREEN_HEIGHT * 0.8,
                        resizeMode: 'contain',
                    }}
                />
            </View>
        </Modal>
    );
};

// Componente VideoViewer Modal
const VideoViewerModal: React.FC<{
    visible: boolean;
    videoUri: string;
    onClose: () => void;
}> = ({ visible, videoUri, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.95)',
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <TouchableOpacity 
                    style={{
                        position: 'absolute',
                        top: 50,
                        left: 20,
                        zIndex: 10,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        padding: 8,
                    }}
                    onPress={onClose}
                >
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={{
                        width: SCREEN_WIDTH * 0.9,
                        height: SCREEN_HEIGHT * 0.6,
                        backgroundColor: '#000',
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                    onPress={() => Linking.openURL(videoUri)}
                >
                    <Ionicons name="play-circle" size={80} color="#FFF" />
                    <Text style={{ color: '#FFF', marginTop: 16, fontSize: 16 }}>
                        Toca para reproducir en reproductor externo
                    </Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
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

// Componente de animación de onda sonora
const SoundWaveAnimation: React.FC = () => {
    const [animations] = useState([
        new Animated.Value(0.3),
        new Animated.Value(0.5),
        new Animated.Value(0.7),
        new Animated.Value(0.5),
        new Animated.Value(0.3),
    ]);

    useEffect(() => {
        const animateWaves = () => {
            animations.forEach((anim, index) => {
                Animated.loop(
                    Animated.sequence([
                        Animated.timing(anim, {
                            toValue: 1,
                            duration: 300 + index * 100,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim, {
                            toValue: 0.3,
                            duration: 300 + index * 100,
                            useNativeDriver: true,
                        }),
                    ])
                ).start();
            });
        };

        animateWaves();
    }, []);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 24 }}>
            {animations.map((anim, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 3,
                        height: 24,
                        backgroundColor: '#FF5252',
                        borderRadius: 2,
                        transform: [{ scaleY: anim }],
                    }}
                />
            ))}
        </View>
    );
};

// Componente para renderizar nota de voz
const AudioMessage: React.FC<{ 
    currentMessage: any; 
    theme: any; 
    isOwn: boolean;
    onAudioPlayed: () => void;
}> = ({ currentMessage, theme, isOwn, onAudioPlayed }) => {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);
    const [error, setError] = useState(false);
    const [hasPlayed, setHasPlayed] = useState(currentMessage.audioPlayed || false);

    useEffect(() => {
        loadAudio();
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [currentMessage.audio]);

    const loadAudio = async () => {
        try {
            setIsLoading(true);
            setError(false);
            
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            console.log('Cargando audio desde:', currentMessage.audio);
            
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: currentMessage.audio },
                { shouldPlay: false, progressUpdateIntervalMillis: 100 },
                onPlaybackStatusUpdate
            );
            
            setSound(newSound);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const status = await newSound.getStatusAsync();
            
            if (status.isLoaded && status.durationMillis) {
                setDuration(status.durationMillis);
            }
            setIsLoading(false);
        } catch (err) {
            console.error('Error loading audio:', err);
            setError(true);
            setIsLoading(false);
        }
    };

    const playSound = async () => {
        if (!sound || error) return;
        
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            if (isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
            } else {
                await sound.playAsync();
                setIsPlaying(true);
                
                // Marcar como reproducido solo si no es del usuario actual
                if (!isOwn && !hasPlayed) {
                    setHasPlayed(true);
                    onAudioPlayed();
                }
            }
        } catch (error) {
            console.error('Error playing audio:', error);
            setError(true);
            Alert.alert('Error', 'No se pudo reproducir el audio');
        }
    };

    const onPlaybackStatusUpdate = (status: any) => {
        if (status.isLoaded) {
            if (status.durationMillis && status.durationMillis > 0) {
                setDuration(status.durationMillis);
            }
            setPosition(status.positionMillis || 0);
            
            if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
            }
        } else if (status.error) {
            console.error('Error en reproducción:', status.error);
            setError(true);
        }
    };

    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const buttonColor = !isOwn && hasPlayed ? '#FF69B4' : (isOwn ? '#FFF' : theme.primary);
    const textColor = isOwn ? '#FFF' : theme.text;

    if (error) {
        return (
            <View style={{ padding: 12, alignItems: 'center' }}>
                <TouchableOpacity onPress={loadAudio}>
                    <Ionicons name="refresh" size={24} color={textColor} />
                    <Text style={{ color: textColor, fontSize: 12, marginTop: 4 }}>
                        Error al cargar. Toca para reintentar
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 8,
            minWidth: 200,
        }}>
            <TouchableOpacity 
                onPress={playSound} 
                disabled={isLoading}
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: buttonColor + '30',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 8,
                }}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color={buttonColor} />
                ) : (
                    <Ionicons 
                        name={isPlaying ? "pause" : "play"} 
                        size={20} 
                        color={buttonColor} 
                    />
                )}
            </TouchableOpacity>
            
            <View style={{ flex: 1 }}>
                <View style={{
                    height: 3,
                    backgroundColor: textColor + '30',
                    borderRadius: 1.5,
                    overflow: 'hidden',
                }}>
                    <View style={{
                        height: '100%',
                        backgroundColor: buttonColor,
                        width: duration > 0 ? `${(position / duration) * 100}%` : '0%',
                    }} />
                </View>
                <Text style={{
                    fontSize: 11,
                    color: textColor,
                    marginTop: 4,
                }}>
                    {formatTime(position)} / {formatTime(duration)}
                </Text>
            </View>
        </View>
    );
};

// Componente para renderizar archivos
const FileMessage: React.FC<{ currentMessage: any; theme: any; isOwn: boolean }> = ({ currentMessage, theme, isOwn }) => {
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

    const iconColor = isOwn ? '#FFF' : theme.primary;
    const textColor = isOwn ? '#FFF' : theme.text;

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
                backgroundColor: iconColor + '30',
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: 12,
            }}>
                <MaterialIcons name="insert-drive-file" size={24} color={iconColor} />
            </View>
            
            <View style={{ flex: 1 }}>
                <Text style={{
                    fontSize: 14,
                    color: textColor,
                    fontWeight: '500',
                    marginBottom: 2,
                }} numberOfLines={1}>
                    {currentMessage.fileName || 'Archivo'}
                </Text>
                <Text style={{
                    fontSize: 12,
                    color: textColor + 'CC',
                }}>
                    {formatFileSize(currentMessage.fileSize)}
                </Text>
            </View>

            <Ionicons name="download-outline" size={20} color={iconColor} />
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

    // Estados para visualización de multimedia
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [videoViewerVisible, setVideoViewerVisible] = useState(false);
    const [selectedMediaUri, setSelectedMediaUri] = useState('');

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
                        const fetchedMessages = snapshot.docs.map(doc => ({
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
                            delivered: doc.data().delivered || false,
                            read: doc.data().read || false,
                            audioPlayed: doc.data().audioPlayed || false,
                            deleted: doc.data().deleted || false,
                            sentAt: doc.data().sentAt?.toDate() || doc.data().createdAt.toDate(),
                        })) as ExtendedMessage[];

                        setMessages(fetchedMessages);

                        // Marcar mensajes como leídos si el chat está abierto
                        if (AppState.currentState === 'active') {
                            fetchedMessages.forEach(async (msg) => {
                                if (msg.user._id !== user.uid && !msg.read && !msg.deleted) {
                                    const messageRef = doc(db, 'relationships', chatId, 'messages', msg._id);
                                    await updateDoc(messageRef, { read: true });
                                }
                            });
                        }

                        // Marcar como entregados los mensajes propios
                        fetchedMessages.forEach(async (msg) => {
                            if (msg.user._id === user.uid && !msg.delivered && !msg.deleted) {
                                const messageRef = doc(db, 'relationships', chatId, 'messages', msg._id);
                                await updateDoc(messageRef, { delivered: true });
                            }
                        });

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
            sentAt: Timestamp.now(),
            user: { _id: currentUserUid, name: userData.displayName },
            text: message.text || '',
            delivered: false,
            read: false,
            deleted: false,
        };

        // Agregar campos multimedia si existen
        if (message.image) messageData.image = message.image;
        if (message.video) messageData.video = message.video;
        if (message.audio) {
            messageData.audio = message.audio;
            messageData.audioPlayed = false;
        }
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

    // Función para manejar audio reproducido
    const handleAudioPlayed = async (messageId: string) => {
        if (!user || !userData?.partnerId) return;
        
        try {
            const chatId = [user.uid, userData.partnerId].sort().join('_');
            const messageRef = doc(db, 'relationships', chatId, 'messages', messageId);
            await updateDoc(messageRef, { audioPlayed: true });
        } catch (error) {
            console.error('Error marking audio as played:', error);
        }
    };

    // Función para eliminar mensaje
    const handleDeleteMessage = async (messageId: string, sentAt: Date) => {
        if (!user || !userData?.partnerId) return;

        const now = new Date();
        const timeDiff = now.getTime() - sentAt.getTime();
        const threeMinutes = 3 * 60 * 1000;

        if (timeDiff > threeMinutes) {
            Alert.alert('Tiempo excedido', 'Solo puedes eliminar mensajes dentro de los 3 minutos posteriores al envío');
            return;
        }

        Alert.alert(
            'Eliminar mensaje',
            '¿Estás seguro de que quieres eliminar este mensaje?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const chatId = [user.uid, userData.partnerId].sort().join('_');
                            const messageRef = doc(db, 'relationships', chatId, 'messages', messageId);
                            await updateDoc(messageRef, {
                                deleted: true,
                                text: 'Mensaje eliminado',
                                image: null,
                                video: null,
                                audio: null,
                                file: null,
                            });
                            Toast.show({ type: 'success', text1: 'Mensaje eliminado' });
                        } catch (error) {
                            console.error('Error deleting message:', error);
                            Toast.show({ type: 'error', text1: 'Error al eliminar mensaje' });
                        }
                    }
                }
            ]
        );
    };

    // Función para mostrar opciones de mensaje
    const showMessageOptions = (message: ExtendedMessage) => {
        if (message.user._id !== user?.uid || message.deleted) return;

        const now = new Date();
        const timeDiff = now.getTime() - (message.sentAt?.getTime() || 0);
        const threeMinutes = 3 * 60 * 1000;

        if (timeDiff > threeMinutes) {
            Alert.alert('Información', 'Solo puedes eliminar mensajes dentro de los 3 minutos posteriores al envío');
            return;
        }

        const options = ['Eliminar mensaje', 'Cancelar'];
        const destructiveButtonIndex = 0;
        const cancelButtonIndex = 1;

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                destructiveButtonIndex,
                title: 'Opciones de mensaje',
            },
            (buttonIndex) => {
                if (buttonIndex === 0) {
                    handleDeleteMessage(message._id, message.sentAt || new Date());
                }
            }
        );
    };

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
            videoMaxDuration: 60,
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
            console.error('Error uploading media:', error);
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

        try {
            setIsRecording(false);
            
            await recording.stopAndUnloadAsync();
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
            });
            
            const uri = recording.getURI();
            setRecording(null);

            if (!uri) {
                Alert.alert('Error', 'No se pudo obtener el audio grabado');
                return;
            }

            setIsUploading(true);
            Toast.show({ type: 'info', text1: 'Enviando nota de voz...' });

            const downloadURL = await uploadFile(uri, 'audio');

            const newMessage: ExtendedMessage = {
                _id: Crypto.randomUUID(),
                createdAt: new Date(),
                user: { _id: user!.uid, name: userData!.displayName },
                text: "",
                audio: downloadURL,
            };

            await onSend([newMessage]);
            setIsUploading(false);
            setUploadProgress(0);
            Toast.show({ type: 'success', text1: 'Nota de voz enviada' });
        } catch (error) {
            console.error('Error al detener grabación:', error);
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
                    onLongPress={(context, message) => showMessageOptions(message)}
                    
                    renderMessageImage={(props) => {
                        if (props.currentMessage?.deleted) return null;
                        return (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (props.currentMessage?.image) {
                                        setSelectedMediaUri(props.currentMessage.image);
                                        setImageViewerVisible(true);
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
                        if (props.currentMessage?.deleted) return null;
                        return (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (props.currentMessage?.video) {
                                        setSelectedMediaUri(props.currentMessage.video);
                                        setVideoViewerVisible(true);
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
                    
                    renderBubble={(props) => {
                        const isOwn = props.currentMessage?.user._id === user.uid;

                        // Mensaje eliminado
                        if (props.currentMessage?.deleted) {
                            return (
                                <View style={{
                                    marginVertical: 4,
                                    marginHorizontal: 8,
                                    padding: 12,
                                    backgroundColor: theme.inputBackground + '80',
                                    borderRadius: 16,
                                    maxWidth: '70%',
                                }}>
                                    <Text style={{
                                        color: theme.placeholder,
                                        fontSize: 14,
                                        fontStyle: 'italic',
                                    }}>
                                        🚫 Mensaje eliminado
                                    </Text>
                                </View>
                            );
                        }

                        // Renderizar nota de voz
                        if (props.currentMessage?.audio) {
                            return (
                                <View style={{
                                    marginVertical: 4,
                                    marginHorizontal: 8,
                                }}>
                                    <View style={{
                                        backgroundColor: isOwn ? theme.primary : theme.inputBackground,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                    }}>
                                        <AudioMessage 
                                            currentMessage={props.currentMessage} 
                                            theme={theme}
                                            isOwn={isOwn}
                                            onAudioPlayed={() => handleAudioPlayed(props.currentMessage!._id)}
                                        />
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            paddingHorizontal: 8,
                                            paddingBottom: 4,
                                        }}>
                                            <Text style={{ 
                                                color: isOwn ? '#FFF' : theme.placeholder, 
                                                fontSize: 10,
                                                marginRight: 4,
                                            }}>
                                                {props.currentMessage.createdAt instanceof Date 
                                                    ? props.currentMessage.createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                                                    : ''}
                                            </Text>
                                            <MessageStatus message={props.currentMessage} isOwn={isOwn} />
                                        </View>
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
                                        backgroundColor: isOwn ? theme.primary : theme.inputBackground,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                    }}>
                                        <FileMessage 
                                            currentMessage={props.currentMessage} 
                                            theme={theme}
                                            isOwn={isOwn}
                                        />
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'flex-end',
                                            paddingHorizontal: 12,
                                            paddingBottom: 8,
                                        }}>
                                            <Text style={{ 
                                                color: isOwn ? '#FFF' : theme.placeholder, 
                                                fontSize: 10,
                                                marginRight: 4,
                                            }}>
                                                {props.currentMessage.createdAt instanceof Date 
                                                    ? props.currentMessage.createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                                                    : ''}
                                            </Text>
                                            <MessageStatus message={props.currentMessage} isOwn={isOwn} />
                                        </View>
                                    </View>
                                </View>
                            );
                        }

                        // Burbuja normal
                        return (
                            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
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
                                    renderTime={(timeProps) => (
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginTop: 4,
                                        }}>
                                            <Text style={{
                                                fontSize: 10,
                                                color: isOwn ? '#FFF' : theme.placeholder,
                                                marginRight: 4,
                                            }}>
                                                {timeProps.currentMessage?.createdAt instanceof Date
                                                    ? timeProps.currentMessage.createdAt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                                                    : ''}
                                            </Text>
                                            <MessageStatus message={timeProps.currentMessage as ExtendedMessage} isOwn={isOwn} />
                                        </View>
                                    )}
                                />
                            </View>
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
                                !isRecording ? (
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
                                ) : null
                            )}
                            renderComposer={(composerProps) => (
                                isRecording ? (
                                    <View style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: theme.inputBackground,
                                        borderRadius: 20,
                                        paddingHorizontal: 12,
                                        marginLeft: 0,
                                        marginTop: 0,
                                        marginBottom: 4,
                                        height: 40,
                                    }}>
                                        <View style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: '#FF5252',
                                            marginRight: 8,
                                        }} />
                                        
                                        <SoundWaveAnimation />
                                        
                                        <Text style={{
                                            color: theme.text,
                                            fontSize: 14,
                                            marginLeft: 12,
                                            fontWeight: '500',
                                        }}>
                                            {formatRecordingTime(recordingDuration)}
                                        </Text>
                                    </View>
                                ) : (
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
                                )
                            )}
                            renderSend={(sendProps) => (
                                isRecording ? (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginLeft: 4,
                                        marginRight: 4,
                                        marginBottom: 4,
                                    }}>
                                        <TouchableOpacity
                                            onPress={cancelRecording}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: theme.placeholder + '30',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Ionicons name="close" size={24} color={theme.text} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={stopRecording}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                backgroundColor: theme.primary,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Ionicons name="send" size={20} color={theme.white} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
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
                                )
                            )}
                        />
                    )}
                />
            </KeyboardAvoidingView>

            {/* Image Viewer Modal */}
            <ImageViewerModal
                visible={imageViewerVisible}
                imageUri={selectedMediaUri}
                onClose={() => setImageViewerVisible(false)}
            />

            {/* Video Viewer Modal */}
            <VideoViewerModal
                visible={videoViewerVisible}
                videoUri={selectedMediaUri}
                onClose={() => setVideoViewerVisible(false)}
            />

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