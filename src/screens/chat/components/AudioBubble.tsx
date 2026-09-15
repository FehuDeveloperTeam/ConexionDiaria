// Burbuja de nota de voz — Sprint 9.1. Estaba escrita dentro de
// 'renderBubble' en chat.tsx, donde quedaba atrapada por la memoización de
// GiftedChat (ver el comentario de audioPlaybackContext). Como componente
// propio se suscribe al contexto y se redibuja cuando cambia la
// reproducción, aunque la fila de la lista se haya saltado el render.
import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/themeContext';
import { ExtendedMessage } from '../types';
import { MessageStatus } from './MessageStatus';
import { AudioWaveAnimation } from './AudioWaveAnimation';
import { useAudioPlaybackContext } from '../context/audioPlaybackContext';

export const AudioBubble: React.FC<{
    message: ExtendedMessage;
    isOwn: boolean;
    onLongPress: () => void;
}> = ({ message, isOwn, onLongPress }) => {
    const { theme, isDarkMode: isDark } = useTheme();
    const {
        currentlyPlayingId,
        audioProgress,
        audioDurations,
        isLoadingAudio,
        toggleAudioPlayback,
        formatAudioDuration,
    } = useAudioPlaybackContext();

    const messageId = message._id.toString();
    const isPlaying = currentlyPlayingId === messageId;
    const progress = audioProgress[messageId] || 0;
    const duration = message.audioDuration ?? audioDurations[messageId];
    const isLoadingThisAudio = isLoadingAudio === messageId;

    const waveColor = isDark ? '#5B4A79' : '#C9C4EC';
    // Burbuja propia: primary en claro, violeta oscuro propio en oscuro
    // (spec del handoff: no es simplemente 'primary' a menor luminosidad).
    const ownBubbleBg = isDark ? '#3A2D55' : theme.primary;
    const ownBubbleTextColor = isDark ? theme.text : theme.white;

    return (
        <TouchableOpacity
            activeOpacity={1}
            onLongPress={onLongPress}
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
                    {/* Ondas mientras suena; barra de progreso al pausar */}
                    {isPlaying ? (
                        <View style={{ height: 24, justifyContent: 'center' }}>
                            <AudioWaveAnimation color={waveColor} />
                        </View>
                    ) : (
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
                    {new Date(message.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
            </View>
        </TouchableOpacity>
    );
};
