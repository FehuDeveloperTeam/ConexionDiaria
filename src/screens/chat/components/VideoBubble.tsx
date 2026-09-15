// Burbuja de video del chat — Sprint 9.23.
//
// La vista previa es el propio reproductor en pausa, no una miniatura
// generada: sacar un fotograma exige expo-video-thumbnails, que no está
// instalado, y con él habría que subir y contabilizar un archivo más por cada
// video. El primer fotograma con el botón de reproducir encima cumple la
// misma función y no agrega nada al almacenamiento de la pareja, que es justo
// lo que el plan gratuito cuenta.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/themeContext';
import { ExtendedMessage } from '../types';

const formatDuration = (millis?: number): string | null => {
    if (!millis || millis <= 0) return null;
    const totalSeconds = Math.round(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const VideoBubble: React.FC<{
    message: ExtendedMessage;
    isOwn: boolean;
    // Modo protección (9.14). El componente de video no acepta blurRadius,
    // así que en vez de difuminarlo no se dibuja: se muestra la tapa y el
    // video recién carga al abrirlo. Es incluso más protector que difuminar,
    // porque ni siquiera se descarga el primer fotograma.
    protected?: boolean;
    onPress: () => void;
    onLongPress: () => void;
}> = ({ message, isOwn, protected: isProtected, onPress, onLongPress }) => {
    const { theme, fontFamilies } = useTheme();
    const duration = formatDuration(message.videoDuration);

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityLabel="Reproducir el video"
            style={{
                marginVertical: 4,
                marginHorizontal: 8,
                alignSelf: isOwn ? 'flex-end' : 'flex-start',
            }}
        >
            <View style={{
                width: 220,
                aspectRatio: 3 / 4,
                borderRadius: 20,
                borderBottomRightRadius: isOwn ? 6 : 20,
                borderBottomLeftRadius: isOwn ? 20 : 6,
                overflow: 'hidden',
                backgroundColor: theme.surfaceAlt,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                {isProtected ? (
                    <View style={{ position: 'absolute', width: '100%', height: '100%', backgroundColor: theme.borderStrong }} />
                ) : (
                    <Video
                        source={{ uri: message.video ?? '' }}
                        style={{ position: 'absolute', width: '100%', height: '100%' }}
                        resizeMode={ResizeMode.COVER}
                        // En pausa y sin controles: acá es una vista previa, no
                        // un reproductor. Se ve entero en el visor.
                        shouldPlay={false}
                        isMuted
                    />
                )}

                <View style={{
                    width: 46, height: 46, borderRadius: 23,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    alignItems: 'center', justifyContent: 'center',
                }}>
                    <Ionicons name="play" size={22} color="#FFFFFF" style={{ marginLeft: 3 }} />
                </View>

                {!!duration && (
                    <View style={{
                        position: 'absolute', right: 8, bottom: 8,
                        backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
                        paddingHorizontal: 6, paddingVertical: 2,
                    }}>
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 11, color: '#FFFFFF' }}>
                            {duration}
                        </Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};
