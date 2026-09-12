import React, { useState } from 'react';
import {
    View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet,
    ActivityIndicator, Text, TouchableOpacity, Image, UIManager,
    Keyboard, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, InputToolbar, Composer, Send, Actions, Bubble } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { themes } from '../../src/config/theme';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import Toast from 'react-native-toast-message';
import { usePlan } from '../../src/contexts/planContext';
import { ExtendedMessage } from '../../src/screens/chat/types';
import { MessageStatus } from '../../src/screens/chat/components/MessageStatus';
import { UpgradeModal } from '../../src/screens/chat/components/UpgradeModal';
import { ImageViewerModal } from '../../src/screens/chat/components/ImageViewerModal';
import { VideoViewerModal } from '../../src/screens/chat/components/VideoViewerModal';
import { FileViewerModal } from '../../src/screens/chat/components/FileViewerModal';
import { SoundWaveAnimation } from '../../src/screens/chat/components/SoundWaveAnimation';
import { ProfilePhotoModal } from '../../src/screens/chat/components/ProfilePhotoModal';
import { AudioWaveAnimation } from '../../src/screens/chat/components/AudioWaveAnimation';
import { useChatMessages } from '../../src/screens/chat/hooks/useChatMessages';
import { useAudioPlayback } from '../../src/screens/chat/hooks/useAudioPlayback';
import { useChatUploads } from '../../src/screens/chat/hooks/useChatUploads';
import { useAudioRecording } from '../../src/screens/chat/hooks/useAudioRecording';
import { usePartnerPresence } from '../../src/screens/chat/hooks/usePartnerPresence';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Componente Principal del Chat
const ChatScreen = () => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;
    const router = useRouter();

    // Context de Plan
    const { userData, relationshipData, plan, isLoading: planLoading } = usePlan();

    const [inputText, setInputText] = useState('');

    // Estados de UI
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [videoViewerVisible, setVideoViewerVisible] = useState(false);
    const [selectedMediaUri, setSelectedMediaUri] = useState('');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Estados para el modal de archivos
    const [fileViewerVisible, setFileViewerVisible] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; size?: number } | null>(null);

    const [showProfilePhoto, setShowProfilePhoto] = useState(false);
    const [profilePhotoSize, setProfilePhotoSize] = useState<'medium' | 'full'>('medium');

    // Estado para manejar el teclado
    const [, setKeyboardHeight] = useState(0);

    // Calcular almacenamiento usado
    const usedStorage = relationshipData?.usedStorage || 0;
    const maxStorage = plan === 'premium' ? 25 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 25GB vs 100MB

    const {
        currentUser,
        loading,
        messages,
        hasMoreMessages,
        isLoadingEarlier,
        handleLoadEarlier,
        onSend,
        deleteMessage,
    } = useChatMessages(userData, () => setInputText(''));

    // Mantener presionado un mensaje propio (no borrado) ofrece borrarlo.
    const handleMessageLongPress = (_context: unknown, message: ExtendedMessage) => {
        if (message.deleted || message.user._id !== currentUser?.uid) return;

        Alert.alert(
            'Eliminar mensaje',
            'Se mostrará como eliminado para los dos.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: () => deleteMessage(message._id.toString()) },
            ]
        );
    };

    const {
        isUploading,
        uploadProgress,
        uploadAudio,
        showAttachmentMenu,
    } = useChatUploads({
        currentUser,
        userData,
        usedStorage,
        plan,
        maxStorage,
        onNeedUpgrade: () => setShowUpgradeModal(true),
    });

    const {
        isRecording,
        recordingDuration,
        startRecording,
        stopRecording,
        cancelRecording,
        formatRecordingTime,
    } = useAudioRecording({
        plan,
        usedStorage,
        maxStorage,
        uploadAudio,
        onNeedUpgrade: () => setShowUpgradeModal(true),
    });

    const {
        currentlyPlayingId,
        audioProgress,
        audioDurations,
        isLoadingAudio,
        toggleAudioPlayback,
        formatAudioDuration,
    } = useAudioPlayback(currentUser, userData?.partnerId);

    const { partnerInfo } = usePartnerPresence({
        currentUser,
        partnerId: userData?.partnerId,
    });

    // Listener del teclado para iOS
    React.useEffect(() => {
        if (Platform.OS !== 'ios') return;

        const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });

        const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

    // Render de burbujas personalizadas
    const renderBubble = (props: any) => {
        const isOwn = props.currentMessage.user._id === currentUser?.uid;
        const message: ExtendedMessage = props.currentMessage;

        if (message.deleted) {
            return (
                <View style={{
                    padding: 12,
                    marginVertical: 4,
                    marginHorizontal: 8,
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0F0F0',
                    borderRadius: 12,
                }}>
                    <Text style={{
                        color: theme.placeholder,
                        fontStyle: 'italic',
                        fontSize: 14,
                    }}>
                        🚫 Mensaje eliminado
                    </Text>
                </View>
            );
        }

        // Renderizar mensaje de audio
        if (message.audio) {
            const messageId = message._id.toString();
            const isPlaying = currentlyPlayingId === messageId;
            const progress = audioProgress[messageId] || 0;
            const duration = message.audioDuration ?? audioDurations[messageId];
            const isLoading = isLoadingAudio === messageId;

            console.log('🎵 Audio bubble:', {
                messageId: messageId.substring(0, 10),
                isPlaying,
                duration,
                isLoading,
                currentlyPlayingId: currentlyPlayingId?.substring(0, 10)
            });

            return (
                <TouchableOpacity
                    activeOpacity={1}
                    onLongPress={() => handleMessageLongPress(null, message)}
                    style={{
                        marginVertical: 4,
                        marginHorizontal: 8,
                    }}>
                    <View style={{
                        backgroundColor: isOwn ? theme.primary : (colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8'),
                        borderRadius: 16,
                        padding: 12,
                        minWidth: 200,
                        maxWidth: 280,
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 8,
                        }}>
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('🔘 Botón audio presionado:', messageId.substring(0, 10));
                                    toggleAudioPlayback(message);
                                }}
                                disabled={isLoading}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 12,
                                }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={isOwn ? theme.white : theme.primary} />
                                ) : (
                                    <Ionicons
                                        name={isPlaying ? 'pause' : 'play'}
                                        size={22}
                                        color={isOwn ? theme.white : theme.primary}
                                    />
                                )}
                            </TouchableOpacity>

                            <View style={{ flex: 1, marginRight: 8 }}>
                                {/* Ondas de audio animadas cuando está reproduciendo */}
                                {isPlaying ? (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        height: 30,
                                        marginBottom: 4,
                                    }}>
                                        <AudioWaveAnimation color={isOwn ? theme.white : theme.primary} />
                                    </View>
                                ) : (
                                    /* Barra de progreso cuando está pausado */
                                    <View style={{
                                        height: 30,
                                        justifyContent: 'center',
                                        marginBottom: 4,
                                    }}>
                                        <View style={{
                                            height: 3,
                                            backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                        }}>
                                            <View style={{
                                                height: '100%',
                                                width: `${progress * 100}%`,
                                                backgroundColor: isOwn ? theme.white : theme.primary,
                                            }} />
                                        </View>
                                    </View>
                                )}

                                {/* Duración */}
                                <Text style={{
                                    fontSize: 12,
                                    color: isOwn ? theme.white : theme.text,
                                    opacity: 0.8,
                                }}>
                                    {duration ? formatAudioDuration(duration) : '0:00'}
                                </Text>
                            </View>

                            {/* Indicador de no reproducido */}
                            {!isOwn && !message.audioPlayed && (
                                <View style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: theme.primary,
                                    marginLeft: 4,
                                }} />
                            )}
                        </View>

                        {/* Hora y estado */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            marginTop: 4,
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: isOwn ? theme.white : theme.placeholder,
                                opacity: 0.7,
                            }}>
                                {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </Text>
                            {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        // Renderizar mensaje de archivo
        if (message.file) {
            return (
                <TouchableOpacity
                    activeOpacity={1}
                    onLongPress={() => handleMessageLongPress(null, message)}
                    style={{
                        marginVertical: 4,
                        marginHorizontal: 8,
                    }}>
                    <View style={{
                        backgroundColor: isOwn ? theme.primary : (colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8'),
                        borderRadius: 16,
                        padding: 12,
                        maxWidth: 280,
                    }}>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedFile({
                                    uri: message.file!,
                                    name: message.fileName || 'Archivo',
                                    size: message.fileSize,
                                });
                                setFileViewerVisible(true);
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 12,
                            }}
                        >
                            <View style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Ionicons
                                    name="document-text"
                                    size={24}
                                    color={isOwn ? theme.white : theme.primary}
                                />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{
                                        color: isOwn ? theme.white : theme.text,
                                        fontSize: 14,
                                        fontWeight: '500',
                                    }}
                                    numberOfLines={1}
                                >
                                    {message.fileName || 'Archivo'}
                                </Text>
                                {message.fileSize && (
                                    <Text style={{
                                        color: isOwn ? theme.white : theme.placeholder,
                                        fontSize: 12,
                                        marginTop: 2,
                                        opacity: 0.7,
                                    }}>
                                        {(message.fileSize / 1024).toFixed(2)} KB
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Hora y estado - CORREGIDO */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            marginTop: 8,
                        }}>
                            <Text style={{
                                fontSize: 11,
                                color: isOwn ? theme.white : theme.placeholder,
                                opacity: 0.7,
                            }}>
                                {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </Text>
                            {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        // Renderizar burbuja de texto/imagen estándar con hora corregida
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    left: {
                        backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8',
                        marginVertical: 4,
                    },
                    right: {
                        backgroundColor: theme.primary,
                        marginVertical: 4,
                    },
                }}
                textStyle={{
                    left: { color: theme.text },
                    right: { color: theme.white },
                }}
                timeTextStyle={{
                    left: {
                        color: theme.placeholder,
                        fontSize: 11,
                        marginTop: 4,
                        marginLeft: 0,  // CORREGIDO: eliminar margen izquierdo excesivo
                    },
                    right: {
                        color: theme.white,
                        fontSize: 11,
                        marginTop: 4,
                    },
                }}
                renderTime={(timeProps) => (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginTop: 4,
                        paddingHorizontal: 8,  // CORREGIDO: padding horizontal consistente
                        paddingBottom: 4,
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: isOwn ? theme.white : theme.placeholder,
                            opacity: 0.7,
                        }}>
                            {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </Text>
                        {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                    </View>
                )}
                renderMessageImage={(imageProps) => (
                    <TouchableOpacity
                        onPress={() => {
                            if (imageProps.currentMessage.image) {
                                setSelectedMediaUri(imageProps.currentMessage.image);
                                setImageViewerVisible(true);
                            }
                        }}
                    >
                        <Image
                            source={{ uri: imageProps.currentMessage.image }}
                            style={styles.chatImage}
                        />
                    </TouchableOpacity>
                )}
            />
        );
    };

    // Loading state
    if (loading || planLoading) {
        return (
            <View style={{
                flex: 1,
                backgroundColor: theme.background,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ color: theme.text, marginTop: 12 }}>
                    Cargando conversación...
                </Text>
            </View>
        );
    }

    // Sin pareja
    if (!userData?.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: 20,
                }}>
                    <Ionicons name="heart-outline" size={64} color={theme.placeholder} />
                    <Text style={{
                        color: theme.text,
                        fontSize: 18,
                        fontWeight: '600',
                        marginTop: 16,
                        textAlign: 'center',
                    }}>
                        Aún no tienes pareja conectada
                    </Text>
                    <Text style={{
                        color: theme.placeholder,
                        fontSize: 14,
                        marginTop: 8,
                        textAlign: 'center',
                    }}>
                        Conecta con tu pareja para comenzar a chatear
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: theme.background,
                borderBottomWidth: 1,
                borderBottomColor: theme.borderColor,
            }}>
                {/* Botón de regreso */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        marginRight: 12,
                        padding: 4,
                    }}
                >
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>

                {/* Info de pareja (clickeable) */}
                <TouchableOpacity
                    onPress={() => {
                        setProfilePhotoSize('medium');
                        setShowProfilePhoto(true);
                    }}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                >
                    {/* Avatar de la pareja */}
                    {partnerInfo?.photoURL ? (
                        <Image
                            source={{ uri: partnerInfo.photoURL }}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12,
                            }}
                        />
                    ) : (
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: theme.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                        }}>
                            <Text style={{
                                color: theme.white,
                                fontSize: 18,
                                fontWeight: '600',
                            }}>
                                {partnerInfo?.name?.charAt(0).toUpperCase() || '❤️'}
                            </Text>
                        </View>
                    )}

                    {/* Nombre e info */}
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 17,
                            fontWeight: '600',
                            color: theme.text,
                        }}>
                            {partnerInfo?.name || 'Pareja'}
                        </Text>
                        {partnerInfo?.isOnline ? (
                            <Text style={{
                                fontSize: 13,
                                color: '#34C759',
                            }}>
                                En línea
                            </Text>
                        ) : partnerInfo?.lastSeen ? (
                            <Text style={{
                                fontSize: 13,
                                color: theme.placeholder,
                            }}>
                                {(() => {
                                    const lastSeenDate = partnerInfo.lastSeen.toDate();
                                    const now = new Date();
                                    const diffMs = now.getTime() - lastSeenDate.getTime();
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMs / 3600000);
                                    const diffDays = Math.floor(diffMs / 86400000);

                                    if (diffMins < 1) return 'Hace un momento';
                                    if (diffMins < 60) return `Hace ${diffMins} min`;
                                    if (diffHours < 24) return `Hace ${diffHours}h`;
                                    if (diffDays === 1) return 'Ayer';
                                    return lastSeenDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                                })()}
                            </Text>
                        ) : null}
                    </View>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? -170 : 0}
            >
            <View style={{ flex: 1 }}>
                {/* Indicador de carga durante subida */}
                {isUploading && (
                    <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 999,
                        backgroundColor: theme.primary,
                        padding: 8,
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <ActivityIndicator size="small" color={theme.white} />
                            <Text style={{ color: theme.white, fontSize: 14, marginLeft: 8 }}>
                                Subiendo... {uploadProgress.toFixed(0)}%
                            </Text>
                        </View>
                    </View>
                )}

                <GiftedChat
                    messages={messages}
                    onSend={onSend}
                    loadEarlier={hasMoreMessages}
                    onLoadEarlier={handleLoadEarlier}
                    isLoadingEarlier={isLoadingEarlier}
                    user={{
                        _id: currentUser?.uid || '',
                        name: userData?.name || 'Usuario',
                    }}
                    placeholder="Escribe un mensaje..."
                    alwaysShowSend
                    showUserAvatar={false}
                    renderBubble={renderBubble}
                    onLongPress={handleMessageLongPress}
                    renderAvatar={null}
                    text={inputText}
                    onInputTextChanged={setInputText}
                    messagesContainerStyle={{
                        backgroundColor: theme.background,
                    }}
                    minInputToolbarHeight={56}
                    bottomOffset={Platform.OS === 'ios' ? -170 : 0}
                    keyboardShouldPersistTaps="handled"
                    renderChatEmpty={() => (
                        <View style={{
                            flex: 1,
                            transform: [{ scaleY: -1 }],
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Ionicons name="chatbubbles-outline" size={64} color={theme.placeholder} />
                            <Text style={{
                                color: theme.placeholder,
                                marginTop: 12,
                                fontSize: 16,
                            }}>
                                No hay mensajes aún
                            </Text>
                            <Text style={{
                                color: theme.placeholder,
                                marginTop: 4,
                                fontSize: 14,
                            }}>
                                Envía el primer mensaje
                            </Text>
                        </View>
                    )}
                    renderInputToolbar={(toolbarProps) => (
                        !isRecording ? (
                            <InputToolbar
                                {...toolbarProps}
                                containerStyle={{
                                    backgroundColor: theme.background,
                                    borderTopColor: theme.borderColor,
                                    borderTopWidth: 1,
                                    paddingVertical: 4,
                                    paddingHorizontal: 8,
                                    minHeight: 48,
                                    marginBottom: 0,
                                }}
                                primaryStyle={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 44,
                                }}
                                renderActions={(actionsProps) =>
                                    !isRecording ? (
                                        <Actions
                                            {...actionsProps}
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
                                                <Ionicons
                                                    name="add-circle"
                                                    size={32}
                                                    color={theme.primary}
                                                />
                                            )}
                                            onPressActionButton={showAttachmentMenu}
                                        />
                                    ) : null
                                }
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
                                            marginBottom: 0,
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
                                                marginBottom: 0,
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
                                            marginBottom: 8,
                                            marginLeft: 4,
                                            marginRight: 4,

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
                                        inputText.trim().length > 0 ? (
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
                                                    marginBottom: 0,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        backgroundColor: theme.primary,
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
                                        ) : (
                                            <TouchableOpacity
                                                onPress={startRecording}
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: theme.primary,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginLeft: 4,
                                                    marginRight: 4,
                                                    marginBottom: 0,
                                                }}
                                            >
                                                <Ionicons name="mic" size={24} color={theme.white} />
                                            </TouchableOpacity>
                                        )
                                    )
                                )}
                            />
                        ) : (
                            <InputToolbar
                                {...toolbarProps}
                                containerStyle={{
                                    backgroundColor: theme.background,
                                    borderTopColor: theme.borderColor,
                                    borderTopWidth: 1,
                                    paddingVertical: 4,
                                    paddingHorizontal: 8,
                                    minHeight: 48,
                                    marginBottom: 0,
                                }}
                                primaryStyle={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 44,
                                }}
                                renderComposer={(composerProps) => (
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
                                )}
                                renderSend={(sendProps) => (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 0,
                                        marginLeft: 4,
                                        marginRight: 4,

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
                                )}
                            />
                        )
                    )}
                />

            {/* Profile Photo Modal */}
            <ProfilePhotoModal
                visible={showProfilePhoto}
                photoURL={partnerInfo?.photoURL}
                name={partnerInfo?.name || 'Pareja'}
                size={profilePhotoSize}
                onClose={() => setShowProfilePhoto(false)}
                onExpand={() => setProfilePhotoSize('full')}
            />

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

            {/* File Viewer Modal */}
            {selectedFile && (
                <FileViewerModal
                    visible={fileViewerVisible}
                    fileUri={selectedFile.uri}
                    fileName={selectedFile.name}
                    fileSize={selectedFile.size}
                    onClose={() => {
                        setFileViewerVisible(false);
                        setSelectedFile(null);
                    }}
                />
            )}

            {/* Upgrade Modal */}
            <UpgradeModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                usedStorage={usedStorage}
                maxStorage={maxStorage}
            />

            {/* Toast Container */}
            <Toast />
            </View>
            </KeyboardAvoidingView>
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
