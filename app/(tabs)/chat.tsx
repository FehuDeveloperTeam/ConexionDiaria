import React, { useState } from 'react';
import {
    View, Platform, KeyboardAvoidingView, StyleSheet,
    ActivityIndicator, Text, TouchableOpacity, Image, UIManager,
    Keyboard, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, InputToolbar, Composer, Send, Actions, Bubble } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { spacing, radii } from '../../src/config/theme';
import { useTheme } from '../../src/contexts/themeContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { usePlan } from '../../src/contexts/planContext';
import { ExtendedMessage } from '../../src/screens/chat/types';
import { MessageStatus } from '../../src/screens/chat/components/MessageStatus';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { useResponsive } from '../../src/hooks/useResponsive';
import { ChatDesktopRail } from '../../src/screens/chat/components/ChatDesktopRail';
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
    const { theme, isDarkMode, fontFamilies } = useTheme();
    const { isWide } = useResponsive();
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

    // Hoja de adjuntar propia (Sprint 7.4b) — reemplaza el action sheet nativo.
    const [isAttachSheetVisible, setIsAttachSheetVisible] = useState(false);

    // Estado para manejar el teclado
    const [, setKeyboardHeight] = useState(0);

    // Calcular almacenamiento usado
    const usedStorage = relationshipData?.usedStorage || 0;
    const maxStorage = plan === 'premium' ? 25 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 25GB vs 100MB
    // Aviso de almacenamiento — solo aplica al plan gratuito (premium ya tiene 25GB).
    const storageUsageRatio = maxStorage > 0 ? usedStorage / maxStorage : 0;
    const showStorageWarning = plan === 'free' && storageUsageRatio >= 0.9;
    const formatStorageMB = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

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
        pickFromCamera,
        pickFromGallery,
        pickDocument,
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

    // Render de burbujas personalizadas — Sprint 7.4a (sistema de diseño).
    const isDark = isDarkMode;
    const formatMessageTime = (date: Date | number) =>
        new Date(date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    // Burbuja propia: primary en claro, violeta oscuro propio en oscuro
    // (spec del handoff: no es simplemente 'primary' a menor luminosidad).
    const ownBubbleBg = isDark ? '#3A2D55' : theme.primary;
    const ownBubbleTextColor = isDark ? theme.text : theme.white;

    const renderBubble = (props: any) => {
        const isOwn = props.currentMessage.user._id === currentUser?.uid;
        const message: ExtendedMessage = props.currentMessage;

        if (message.deleted) {
            return (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 12,
                    marginVertical: 4,
                    marginHorizontal: 8,
                    alignSelf: isOwn ? 'flex-end' : 'flex-start',
                    backgroundColor: theme.divider,
                    borderWidth: 1,
                    borderStyle: 'dashed',
                    borderColor: theme.borderStrong,
                    borderRadius: 16,
                }}>
                    <Ionicons name="ban-outline" size={16} color={theme.textFaint} />
                    <Text style={{
                        color: theme.textFaint,
                        fontStyle: 'italic',
                        fontSize: 13.5,
                    }}>
                        Este mensaje fue eliminado
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
            const isLoadingThisAudio = isLoadingAudio === messageId;
            const waveColor = isDark ? '#5B4A79' : '#C9C4EC';

            return (
                <TouchableOpacity
                    activeOpacity={1}
                    onLongPress={() => handleMessageLongPress(null, message)}
                    style={{
                        marginVertical: 4,
                        marginHorizontal: 8,
                        alignSelf: isOwn ? 'flex-end' : 'flex-start',
                    }}>
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: isOwn ? ownBubbleBg : theme.surface,
                        borderWidth: isOwn ? 0 : 1,
                        borderColor: theme.borderSoft,
                        borderRadius: 20,
                        borderBottomRightRadius: isOwn ? 6 : 20,
                        borderBottomLeftRadius: isOwn ? 20 : 6,
                        padding: 11,
                        minWidth: 200,
                        maxWidth: 280,
                    }}>
                        <TouchableOpacity
                            onPress={() => toggleAudioPlayback(message)}
                            disabled={isLoadingThisAudio}
                            style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: theme.primary,
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 12,
                            }}
                        >
                            {isLoadingThisAudio ? (
                                <ActivityIndicator size="small" color={theme.white} />
                            ) : (
                                <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={theme.white} />
                            )}
                        </TouchableOpacity>

                        <View style={{ flex: 1, marginRight: 8 }}>
                            {/* Ondas de audio animadas cuando está reproduciendo */}
                            {isPlaying ? (
                                <View style={{ height: 24, justifyContent: 'center' }}>
                                    <AudioWaveAnimation color={waveColor} />
                                </View>
                            ) : (
                                /* Barra de progreso cuando está pausado */
                                <View style={{ height: 24, justifyContent: 'center' }}>
                                    <View style={{ height: 3, backgroundColor: waveColor, borderRadius: 1.5, overflow: 'hidden' }}>
                                        <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: theme.primary }} />
                                    </View>
                                </View>
                            )}

                            <Text style={{
                                fontSize: 11.5,
                                fontWeight: '600',
                                color: isOwn ? ownBubbleTextColor : theme.textMuted,
                                marginTop: 4,
                            }}>
                                {duration ? formatAudioDuration(duration) : '0:00'}
                            </Text>
                        </View>

                        {/* Punto de "no escuchado" */}
                        {!isOwn && !message.audioPlayed && (
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.affection }} />
                        )}
                    </View>

                    <View style={{
                        flexDirection: 'row',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        alignItems: 'center',
                        marginTop: 3,
                        paddingHorizontal: 4,
                    }}>
                        <Text style={{ fontSize: 10, color: theme.textFaint }}>
                            {formatMessageTime(message.createdAt)}
                        </Text>
                        {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
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
                        alignSelf: isOwn ? 'flex-end' : 'flex-start',
                    }}>
                    <View style={{
                        backgroundColor: isOwn ? ownBubbleBg : theme.surface,
                        borderWidth: isOwn ? 0 : 1,
                        borderColor: theme.borderSoft,
                        borderRadius: 20,
                        borderBottomRightRadius: isOwn ? 6 : 20,
                        borderBottomLeftRadius: isOwn ? 20 : 6,
                        padding: 11,
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
                                gap: 10,
                            }}
                        >
                            <View style={{
                                width: 36,
                                height: 36,
                                borderRadius: 11,
                                backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : theme.primaryTint,
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Ionicons name="document-text" size={20} color={isOwn ? ownBubbleTextColor : theme.primary} />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text
                                    style={{ color: isOwn ? ownBubbleTextColor : theme.text, fontSize: 13, fontWeight: '700' }}
                                    numberOfLines={1}
                                >
                                    {message.fileName || 'Archivo'}
                                </Text>
                                {message.fileSize && (
                                    <Text style={{ color: isOwn ? ownBubbleTextColor : theme.textFaint, fontSize: 11, marginTop: 2, opacity: isOwn ? 0.8 : 1 }}>
                                        {(message.fileSize / 1024).toFixed(1)} KB
                                    </Text>
                                )}
                            </View>

                            <Ionicons name="download-outline" size={20} color={isOwn ? ownBubbleTextColor : theme.textMuted} />
                        </TouchableOpacity>

                        <View style={{
                            flexDirection: 'row',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            marginTop: 8,
                        }}>
                            <Text style={{ fontSize: 10, color: isOwn ? ownBubbleTextColor : theme.textFaint, opacity: isOwn ? 0.8 : 1 }}>
                                {formatMessageTime(message.createdAt)}
                            </Text>
                            {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                        </View>
                    </View>
                </TouchableOpacity>
            );
        }

        // Renderizar burbuja de texto/imagen estándar
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    left: {
                        backgroundColor: theme.surface,
                        borderWidth: 1,
                        borderColor: theme.borderSoft,
                        borderRadius: 20,
                        borderBottomLeftRadius: 6,
                        marginVertical: 4,
                    },
                    right: {
                        backgroundColor: ownBubbleBg,
                        borderRadius: 20,
                        borderBottomRightRadius: 6,
                        marginVertical: 4,
                    },
                }}
                textStyle={{
                    left: { color: theme.text, fontSize: 14.5, lineHeight: 20 },
                    right: { color: ownBubbleTextColor, fontSize: 14.5, lineHeight: 20 },
                }}
                renderTime={(timeProps: any) => (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginTop: 4,
                        paddingHorizontal: 8,
                        paddingBottom: 4,
                    }}>
                        <Text style={{ fontSize: 10, color: isOwn ? ownBubbleTextColor : theme.textFaint, opacity: isOwn ? 0.8 : 1 }}>
                            {formatMessageTime(timeProps.currentMessage.createdAt)}
                        </Text>
                        {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                    </View>
                )}
                renderMessageImage={(imageProps: any) => (
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

    // Separador de día — pill centrado (spec del handoff). El handoff da
    // '#EFEFF7'/'#5C5C68' como valores de claro; en oscuro se reemplazan
    // por los tokens de superficie/texto atenuado (Sprint 7.9, auditoría
    // de modo oscuro — antes quedaba fijo en claro sin importar el tema).
    const renderDay = (props: any) => (
        <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <View style={{ backgroundColor: isDark ? theme.surfaceAlt : '#EFEFF7', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 12 }}>
                <Text style={{ fontSize: 10.5, fontWeight: '600', color: isDark ? theme.textMuted : '#5C5C68' }}>
                    {new Date(props.currentMessage.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                </Text>
            </View>
        </View>
    );

    // Sprint 8.4: "Enter envía" en escritorio (handoff, "Detalles de PC").
    // react-native-web reenvía el evento de teclado completo a onKeyPress
    // (no solo nativeEvent.key como en nativo), así que Enter sin Shift se
    // puede interceptar acá mismo — Shift+Enter sigue insertando salto de
    // línea. 'onSend' de useChatMessages solo lee 'message.text' del
    // primer elemento del array (ver ese hook): no hace falta reconstruir
    // _id/user/createdAt como hace GiftedChat internamente, esos campos
    // los pone Firestore al guardar.
    const handleComposerKeyPress = (e: any) => {
        if (Platform.OS !== 'web') return;
        if (e.key !== 'Enter' || e.shiftKey) return;
        e.preventDefault?.();
        const text = inputText.trim();
        if (text.length === 0) return;
        onSend([{ text } as any]);
        setInputText('');
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
            <View style={{ flex: 1, flexDirection: 'row' }}>
            <DesktopContentWrap>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.s16,
                paddingVertical: spacing.s12,
                backgroundColor: theme.background,
                borderBottomWidth: 1,
                borderBottomColor: theme.borderSoft,
            }}>
                {/* Botón de regreso */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        marginRight: spacing.s12,
                        padding: 4,
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
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
                                width: 42,
                                height: 42,
                                borderRadius: 21,
                                marginRight: spacing.s12,
                            }}
                        />
                    ) : (
                        <View style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: theme.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: spacing.s12,
                        }}>
                            <Text style={{
                                color: theme.white,
                                fontSize: 18,
                                fontFamily: fontFamilies.bodySemiBold,
                            }}>
                                {partnerInfo?.name?.charAt(0).toUpperCase() || '❤️'}
                            </Text>
                        </View>
                    )}

                    {/* Nombre e info */}
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 16,
                            fontFamily: fontFamilies.bodyBold,
                            color: theme.text,
                        }}>
                            {partnerInfo?.name || 'Pareja'}
                        </Text>
                        {partnerInfo?.isOnline ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <View style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: 3.5,
                                    backgroundColor: theme.success,
                                    marginRight: 5,
                                }} />
                                <Text style={{ fontSize: 13, color: theme.success }}>
                                    En línea
                                </Text>
                            </View>
                        ) : partnerInfo?.lastSeen ? (
                            <Text style={{
                                fontSize: 13,
                                color: theme.textFaint,
                                marginTop: 2,
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
                    placeholder="Escribe algo lindo…"
                    alwaysShowSend
                    showUserAvatar={false}
                    renderBubble={renderBubble}
                    renderDay={renderDay}
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
                        <View>
                            {showStorageWarning && (
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing.s10,
                                    backgroundColor: theme.warnBg,
                                    borderTopWidth: 1,
                                    borderTopColor: theme.warnBorder,
                                    paddingHorizontal: spacing.s16,
                                    paddingVertical: spacing.s10,
                                }}>
                                    <Ionicons name="cloud-offline-outline" size={18} color={theme.warnText} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.warnText }}>
                                            {formatStorageMB(usedStorage)} de {formatStorageMB(maxStorage)} usados
                                        </Text>
                                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 11, color: theme.warnText, opacity: 0.85 }}>
                                            Premium sube a 25 GB compartidos
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setShowUpgradeModal(true)}
                                        style={{
                                            paddingHorizontal: spacing.s14,
                                            paddingVertical: spacing.s8,
                                            borderRadius: radii.pill,
                                            backgroundColor: theme.premium,
                                        }}
                                    >
                                        <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 12, color: theme.premiumTextOnFill }}>
                                            Ampliar
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {!isRecording ? (
                                <InputToolbar
                                    {...toolbarProps}
                                    containerStyle={{
                                        backgroundColor: theme.background,
                                        borderTopColor: theme.borderSoft,
                                        borderTopWidth: showStorageWarning ? 0 : 1,
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
                                    renderActions={(actionsProps) => (
                                        <Actions
                                            {...actionsProps}
                                            containerStyle={{
                                                width: 40,
                                                height: 40,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginLeft: 4,
                                                marginRight: 4,
                                                marginBottom: 0,
                                            }}
                                            icon={() => (
                                                <Ionicons
                                                    name="add-circle"
                                                    size={23}
                                                    color={theme.primary}
                                                />
                                            )}
                                            onPressActionButton={() => setIsAttachSheetVisible(true)}
                                        />
                                    )}
                                    renderComposer={(composerProps) => (
                                        <Composer
                                            {...composerProps}
                                            textInputStyle={{
                                                backgroundColor: theme.inputBackground,
                                                color: theme.text,
                                                borderRadius: radii.pill,
                                                paddingTop: Platform.OS === 'ios' ? 10 : 8,
                                                paddingBottom: Platform.OS === 'ios' ? 10 : 8,
                                                paddingHorizontal: spacing.s16,
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
                                                onKeyPress: handleComposerKeyPress,
                                            }}
                                        />
                                    )}
                                    renderSend={(sendProps) => (
                                        inputText.trim().length > 0 ? (
                                            <Send
                                                {...sendProps}
                                                disabled={!inputText.trim()}
                                                containerStyle={{
                                                    width: 40,
                                                    height: 40,
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
                                                        borderRadius: 20,
                                                        width: 40,
                                                        height: 40,
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Ionicons name="send" size={20} color={theme.white} />
                                                </View>
                                            </Send>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={startRecording}
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 20,
                                                    backgroundColor: theme.primary,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginLeft: 4,
                                                    marginRight: 4,
                                                    marginBottom: 0,
                                                }}
                                            >
                                                <Ionicons name="mic" size={23} color={theme.white} />
                                            </TouchableOpacity>
                                        )
                                    )}
                                />
                            ) : (
                                <InputToolbar
                                    {...toolbarProps}
                                    containerStyle={{
                                        backgroundColor: theme.background,
                                        borderTopColor: theme.borderSoft,
                                        borderTopWidth: showStorageWarning ? 0 : 1,
                                        paddingVertical: 8,
                                        paddingHorizontal: 8,
                                        minHeight: 64,
                                        marginBottom: 0,
                                    }}
                                    primaryStyle={{
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minHeight: 48,
                                    }}
                                    renderActions={() => (
                                        <TouchableOpacity
                                            onPress={cancelRecording}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginLeft: 4,
                                                marginRight: 4,
                                            }}
                                        >
                                            <Ionicons name="trash-outline" size={22} color={theme.danger} />
                                        </TouchableOpacity>
                                    )}
                                    renderComposer={() => (
                                        <View style={{ flex: 1 }}>
                                            <View style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                backgroundColor: theme.dangerBg,
                                                borderRadius: radii.pill,
                                                paddingHorizontal: spacing.s14,
                                                height: 40,
                                            }}>
                                                <View style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 4,
                                                    backgroundColor: theme.danger,
                                                    marginRight: spacing.s8,
                                                }} />

                                                <SoundWaveAnimation />

                                                <Text style={{
                                                    color: theme.danger,
                                                    fontSize: 13,
                                                    marginLeft: spacing.s10,
                                                    fontFamily: fontFamilies.bodySemiBold,
                                                }}>
                                                    {formatRecordingTime(recordingDuration)}
                                                </Text>
                                            </View>
                                            <Text style={{
                                                fontSize: 10.5,
                                                color: theme.textFaint,
                                                marginTop: 3,
                                                marginLeft: spacing.s14,
                                            }}>
                                                Suelta para enviar
                                            </Text>
                                        </View>
                                    )}
                                    renderSend={() => (
                                        <View style={{
                                            padding: 6,
                                            borderRadius: 29,
                                            backgroundColor: 'rgba(187,134,252,0.18)',
                                            marginLeft: 4,
                                            marginRight: 4,
                                        }}>
                                            <TouchableOpacity
                                                onPress={stopRecording}
                                                style={{
                                                    width: 46,
                                                    height: 46,
                                                    borderRadius: 23,
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
                            )}
                        </View>
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

            {/* Upgrade Modal — Sprint 7.9: reemplaza el UpgradeModal propio del
                chat (hardcoded en claro, sin conectar a la compra real) por
                el PaywallSheet compartido, igual que el resto de la app. */}
            <PaywallSheet
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onUpgradePress={() => { setShowUpgradeModal(false); router.push('/(tabs)/config'); }}
                icon="cloud-upload"
                title="Almacenamiento lleno"
                description={`Usaron ${Math.round(usedStorage / (1024 * 1024))} MB de ${Math.round(maxStorage / (1024 * 1024))} MB disponibles.`}
                benefits={['25 GB de almacenamiento compartido', 'Envío ilimitado de fotos, audios y archivos', 'Calidad original sin compresión']}
            />

            {/* Hoja de adjuntar — Sprint 7.4b: reemplaza el action sheet nativo */}
            <Modal
                visible={isAttachSheetVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsAttachSheetVisible(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setIsAttachSheetVisible(false)}
                >
                    <View
                        style={{
                            backgroundColor: theme.surface,
                            borderTopLeftRadius: radii.sheetTop,
                            borderTopRightRadius: radii.sheetTop,
                            paddingTop: spacing.s12,
                            paddingBottom: spacing.s26,
                            paddingHorizontal: spacing.s20,
                        }}
                    >
                        <View style={{
                            width: 40,
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: theme.borderStrong,
                            alignSelf: 'center',
                            marginBottom: spacing.s20,
                        }} />
                        <View style={{ flexDirection: 'row', gap: spacing.s12 }}>
                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    paddingVertical: spacing.s16,
                                    borderRadius: 16,
                                    backgroundColor: theme.surfaceAlt,
                                }}
                                onPress={() => {
                                    setIsAttachSheetVisible(false);
                                    pickFromCamera();
                                }}
                            >
                                <Ionicons name="camera" size={26} color={theme.primary} />
                                <Text style={{
                                    fontFamily: fontFamilies.bodySemiBold,
                                    fontSize: 11,
                                    color: theme.text,
                                    marginTop: spacing.s8,
                                }}>
                                    Cámara
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    paddingVertical: spacing.s16,
                                    borderRadius: 16,
                                    backgroundColor: theme.surfaceAlt,
                                }}
                                onPress={() => {
                                    setIsAttachSheetVisible(false);
                                    pickFromGallery();
                                }}
                            >
                                <Ionicons name="image" size={26} color={theme.primary} />
                                <Text style={{
                                    fontFamily: fontFamilies.bodySemiBold,
                                    fontSize: 11,
                                    color: theme.text,
                                    marginTop: spacing.s8,
                                }}>
                                    Galería
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flex: 1,
                                    alignItems: 'center',
                                    paddingVertical: spacing.s16,
                                    borderRadius: 16,
                                    backgroundColor: theme.surfaceAlt,
                                }}
                                onPress={() => {
                                    setIsAttachSheetVisible(false);
                                    pickDocument();
                                }}
                            >
                                <Ionicons name="attach" size={26} color={theme.primary} />
                                <Text style={{
                                    fontFamily: fontFamilies.bodySemiBold,
                                    fontSize: 11,
                                    color: theme.text,
                                    marginTop: spacing.s8,
                                }}>
                                    Documento
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Toast Container */}
            <Toast />
            </View>
            </KeyboardAvoidingView>
            </DesktopContentWrap>

            {/* Carril derecho — Sprint 8.8, solo en escritorio ancho (>=1080px) */}
            {isWide && (
                <ChatDesktopRail
                    partnerInfo={partnerInfo}
                    messages={messages}
                    usedStorage={usedStorage}
                    maxStorage={maxStorage}
                    onOpenImage={(uri) => {
                        setSelectedMediaUri(uri);
                        setImageViewerVisible(true);
                    }}
                    onOpenFile={(file) => {
                        setSelectedFile(file);
                        setFileViewerVisible(true);
                    }}
                />
            )}
            </View>
        </SafeAreaView>
    );
};

// Estilos
const styles = StyleSheet.create({
    chatImage: {
        width: 250,
        height: 150,
        borderRadius: 16,
        margin: 5,
        resizeMode: 'cover',
    }
});

export default ChatScreen;
