import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import Toast from 'react-native-toast-message';
import { ExtendedMessage } from '../types';

// Reproducción de notas de voz recibidas: config del modo de audio,
// precarga de duraciones y control de reproducción (play/pause/progreso).
export function useAudioPlayback(messages: ExtendedMessage[]) {
    const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
    const [audioDurations, setAudioDurations] = useState<{ [key: string]: number }>({});
    const [isLoadingAudio, setIsLoadingAudio] = useState<string | null>(null);
    const notificationSoundRef = useRef<Audio.Sound | null>(null);
    const completionSoundRef = useRef<Audio.Sound | null>(null);

    // Configurar audio al montar el componente
    useEffect(() => {
        const configureAudio = async () => {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false, // FALSE = ALTAVOZ
                    interruptionModeIOS: 1,
                    interruptionModeAndroid: 1,
                });

                // Cargar sonidos de notificación (opcional - comentado si no tienes los archivos)
                try {
                    const { sound: notifSound } = await Audio.Sound.createAsync(
                        require('../../../../assets/sounds/notification.mp3'),
                        { shouldPlay: false }
                    );
                    notificationSoundRef.current = notifSound;
                } catch {
                    console.log('Archivo notification.mp3 no encontrado - continuando sin sonido');
                }

                try {
                    const { sound: completeSound } = await Audio.Sound.createAsync(
                        require('../../../../assets/sounds/complete.mp3'),
                        { shouldPlay: false }
                    );
                    completionSoundRef.current = completeSound;
                } catch {
                    console.log('Archivo complete.mp3 no encontrado - continuando sin sonido');
                }

            } catch (error) {
                console.error('Error configurando audio:', error);
            }
        };

        configureAudio();

        return () => {
            // Limpiar sonidos al desmontar
            if (notificationSoundRef.current) {
                notificationSoundRef.current.unloadAsync();
            }
            if (completionSoundRef.current) {
                completionSoundRef.current.unloadAsync();
            }
        };
    }, []);

    // Función para detener el audio actual
    const stopCurrentAudio = async () => {
        if (currentSound) {
            try {
                console.log('⏹️ Deteniendo audio actual');
                await currentSound.stopAsync();
                await currentSound.unloadAsync();
            } catch (error) {
                console.error('Error deteniendo audio:', error);
            }
        }
        setCurrentSound(null);
        setCurrentlyPlayingId(null);
    };

    // Callback SIMPLIFICADO para actualización de estado de reproducción
    const onPlaybackStatusUpdate = (messageId: string, status: any) => {
        if (status.isLoaded) {
            if (status.isPlaying && status.durationMillis) {
                const progress = status.positionMillis / status.durationMillis;
                setAudioProgress(prev => ({ ...prev, [messageId]: progress }));
            }

            // Si el audio terminó
            if (status.didJustFinish) {
                console.log('🏁 Audio terminado:', messageId);
                setCurrentSound(null);
                setCurrentlyPlayingId(null);
                setAudioProgress(prev => {
                    const { [messageId]: _, ...rest } = prev;
                    return rest;
                });
            }
        }
    };

    // Función SIMPLIFICADA para reproducir audio (sin cola)
    const playAudio = async (messageId: string, audioUrl: string) => {
        try {
            console.log('🎬 Reproduciendo audio:', messageId);
            setIsLoadingAudio(messageId);

            // Detener cualquier audio que esté reproduciéndose
            await stopCurrentAudio();

            // Configuración para ALTAVOZ
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: false,
                playThroughEarpieceAndroid: false,
                interruptionModeIOS: 1,
                interruptionModeAndroid: 1,
            });

            // Crear y reproducir audio
            const { sound } = await Audio.Sound.createAsync(
                { uri: audioUrl },
                { shouldPlay: true }, // Reproducir inmediatamente
                (status) => onPlaybackStatusUpdate(messageId, status)
            );

            // Obtener duración si no la tenemos
            const status = await sound.getStatusAsync();
            if (status.isLoaded && status.durationMillis && !audioDurations[messageId]) {
                console.log('✅ Duración:', status.durationMillis);
                setAudioDurations(prev => ({
                    ...prev,
                    [messageId]: status.durationMillis!
                }));
            }

            setCurrentSound(sound);
            setCurrentlyPlayingId(messageId);
            setIsLoadingAudio(null);

            console.log('✅ Audio reproduciéndose');

        } catch (error) {
            console.error('❌ Error reproduciendo audio:', error);
            setIsLoadingAudio(null);
            setCurrentlyPlayingId(null);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo reproducir el audio',
            });
        }
    };

    // Función SIMPLE para pausar/reanudar audio
    const toggleAudioPlayback = async (messageId: string, audioUrl: string) => {
        console.log('🎮 Toggle audio:', messageId, 'currentlyPlaying:', currentlyPlayingId);

        // Si este audio está reproduciéndose, PAUSARLO
        if (currentlyPlayingId === messageId) {
            console.log('⏸️ Pausando audio');
            await stopCurrentAudio();
        } else {
            // Si no está reproduciéndose, REPRODUCIRLO (detendrá cualquier otro primero)
            console.log('▶️ Reproduciendo audio');
            await playAudio(messageId, audioUrl);
        }
    };

    // Limpiar audio al desmontar
    useEffect(() => {
        return () => {
            stopCurrentAudio();
        };
    }, []);

    // Precargar duraciones de audios cuando se cargan mensajes
    useEffect(() => {
        const loadAudioDurations = async () => {
            const audioMessages = messages.filter(m => m.audio);

            for (const message of audioMessages) {
                const messageId = message._id.toString();

                // Solo cargar si no tenemos la duración ya
                if (audioDurations[messageId]) {
                    continue;
                }

                try {
                    const { sound } = await Audio.Sound.createAsync(
                        { uri: message.audio! },
                        { shouldPlay: false }
                    );

                    const status = await sound.getStatusAsync();

                    if (status.isLoaded && status.durationMillis) {
                        console.log('✅ Duración precargada:', messageId, status.durationMillis);
                        setAudioDurations(prev => ({
                            ...prev,
                            [messageId]: status.durationMillis!
                        }));
                    }

                    await sound.unloadAsync();
                } catch (error) {
                    console.error('❌ Error precargando:', messageId, error);
                }
            }
        };

        if (messages.length > 0) {
            loadAudioDurations();
        }
    }, [messages.length]); // Solo cuando cambia el número de mensajes

    // Función para formatear duración de audio
    const formatAudioDuration = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return {
        currentlyPlayingId,
        audioProgress,
        audioDurations,
        isLoadingAudio,
        stopCurrentAudio,
        toggleAudioPlayback,
        formatAudioDuration,
    };
}
