import { useState, useEffect, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { db } from '../../../config/firebaseConfig';
import { ExtendedMessage } from '../types';

// OJO — COPIA HERMANA: la máquina de estados de este archivo (refs + número
// de intento) es la misma que src/hooks/useSingleAudioPlayer.ts, que usan las
// Notas. **Un arreglo acá NO llega allá.** Antes de tocar este archivo, mirar
// si el mismo problema existe en el otro; el núcleo compartido tiene pruebas
// en tests/ui/singleAudioPlayer.test.tsx.
//
// Por qué siguen separadas: ver el comentario de useSingleAudioPlayer.ts.
//
// Reproducción de notas de voz recibidas: config del modo de audio y
// control de reproducción (play/pausa/progreso/marcar escuchado). La
// duración de cada audio no se mide acá — viaja en 'message.audioDuration',
// grabada por useAudioRecording al terminar de grabar.
//
// Sprint 9.1 — el sonido activo vive en refs, no en estado. Antes estaba en
// un useState, así que 'toggleAudioPlayback' decidía con un valor que React
// todavía no había aplicado: tocar un audio mientras otro seguía cargando
// dejaba al primero sin detener y sonaban los dos a la vez. Un ref se lee y
// se escribe en el momento, que es lo que necesita algo que solo admite una
// reproducción a la vez.
export function useAudioPlayback(
    currentUser: FirebaseUser | null,
    partnerId: string | null | undefined
) {
    // 'currentlyPlayingId' es solo lo que está SONANDO: al pausar vuelve a
    // null para que el botón muestre play de nuevo, mientras el progreso se
    // conserva para poder retomar donde quedó.
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
    const [audioDurations, setAudioDurations] = useState<{ [key: string]: number }>({});
    const [isLoadingAudio, setIsLoadingAudio] = useState<string | null>(null);

    const soundRef = useRef<Audio.Sound | null>(null);
    const loadedIdRef = useRef<string | null>(null);
    // Cada intento de reproducción se lleva un número. Si mientras uno carga
    // el usuario toca otro audio, el que llega tarde ve que su número quedó
    // obsoleto, se descarga y no suena.
    const playTokenRef = useRef(0);

    const startCueRef = useRef<Audio.Sound | null>(null);
    const endCueRef = useRef<Audio.Sound | null>(null);

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
            } catch (error) {
                console.error('Error configurando audio:', error);
            }

            // Avisos de inicio y término. Si falta el archivo se sigue sin
            // aviso: no vale la pena romper la reproducción por esto.
            try {
                const { sound } = await Audio.Sound.createAsync(
                    require('../../../../assets/sounds/notification.mp3'),
                    { shouldPlay: false }
                );
                startCueRef.current = sound;
            } catch {
                console.log('notification.mp3 no disponible — se reproduce sin aviso de inicio');
            }

            try {
                const { sound } = await Audio.Sound.createAsync(
                    require('../../../../assets/sounds/complete.mp3'),
                    { shouldPlay: false }
                );
                endCueRef.current = sound;
            } catch {
                console.log('complete.mp3 no disponible — se reproduce sin aviso de término');
            }
        };

        configureAudio();

        return () => {
            startCueRef.current?.unloadAsync().catch(() => {});
            endCueRef.current?.unloadAsync().catch(() => {});
        };
    }, []);

    // Los avisos se cargan una vez y se rebobinan en cada uso: 'replayAsync'
    // vuelve al inicio y reproduce, así suena igual la segunda vez.
    const playCue = async (cue: Audio.Sound | null) => {
        if (!cue) return;
        try {
            await cue.replayAsync();
        } catch {
            // Un aviso que falla nunca debe impedir escuchar la nota de voz.
        }
    };

    // Suelta el sonido activo. Limpia los refs ANTES de esperar, para que
    // cualquier toque que llegue mientras tanto ya lo vea liberado.
    const releaseActiveSound = async () => {
        const sound = soundRef.current;
        soundRef.current = null;
        loadedIdRef.current = null;
        if (!sound) return;
        try {
            await sound.unloadAsync();
        } catch {
            // Ya estaba descargado.
        }
    };

    const handleStatus = (messageId: string, token: number, status: AVPlaybackStatus) => {
        // Estado de una carga que ya fue reemplazada por otra.
        if (token !== playTokenRef.current) return;
        if (!status.isLoaded) return;

        if (status.durationMillis) {
            setAudioProgress(prev => ({
                ...prev,
                [messageId]: status.positionMillis / status.durationMillis!,
            }));
        }

        if (status.didJustFinish) {
            playCue(endCueRef.current);
            releaseActiveSound();
            setCurrentlyPlayingId(null);
            setAudioProgress(prev => {
                const { [messageId]: _unused, ...rest } = prev;
                return rest;
            });
        }
    };

    // Marca un audio ajeno como escuchado (el punto de "no reproducido"
    // junto al mensaje). Las reglas de Firestore solo dejan tocar
    // exactamente este campo desde acá, no el resto del mensaje.
    const markAudioPlayed = async (messageId: string) => {
        if (!currentUser || !partnerId) return;

        const relationshipId = [currentUser.uid, partnerId].sort().join('_');
        const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageId);

        try {
            await updateDoc(messageRef, { audioPlayed: true });
        } catch (error) {
            console.error('Error marcando audio como escuchado:', error);
        }
    };

    const playAudio = async (message: ExtendedMessage) => {
        const messageId = message._id.toString();
        const token = ++playTokenRef.current;

        try {
            setIsLoadingAudio(messageId);
            await releaseActiveSound();
            setCurrentlyPlayingId(null);
            // Se descargó el sonido anterior, así que ese audio vuelve a
            // empezar de cero: la barra tiene que decir lo mismo.
            setAudioProgress(prev => ({ ...prev, [messageId]: 0 }));

            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                    interruptionModeIOS: 1,
                    interruptionModeAndroid: 1,
                });
            } catch {
                // En web esta llamada no siempre aplica; no debe impedir oír el audio.
            }

            // Se carga en pausa y se arranca más abajo, ya con el estado
            // puesto. Antes nacía sonando y el botón recién se enteraba
            // después de varios await, por eso no alcanzaba a mostrar pausa.
            const { sound } = await Audio.Sound.createAsync(
                { uri: message.audio! },
                { shouldPlay: false },
                (status) => handleStatus(messageId, token, status)
            );

            if (token !== playTokenRef.current) {
                await sound.unloadAsync().catch(() => {});
                return;
            }

            soundRef.current = sound;
            loadedIdRef.current = messageId;

            // Duración de respaldo, solo para mensajes viejos que no tengan
            // 'audioDuration' guardado desde la grabación.
            if (!message.audioDuration && !audioDurations[messageId]) {
                const status = await sound.getStatusAsync();
                if (status.isLoaded && status.durationMillis) {
                    setAudioDurations(prev => ({
                        ...prev,
                        [messageId]: status.durationMillis!,
                    }));
                }
            }

            setCurrentlyPlayingId(messageId);
            setIsLoadingAudio(null);

            await playCue(startCueRef.current);
            await sound.playAsync();

            if (currentUser && message.user._id !== currentUser.uid && !message.audioPlayed) {
                markAudioPlayed(messageId);
            }
        } catch (error) {
            console.error('Error reproduciendo audio:', error);
            await releaseActiveSound();
            setIsLoadingAudio(null);
            setCurrentlyPlayingId(null);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo reproducir el audio',
            });
        }
    };

    const toggleAudioPlayback = async (message: ExtendedMessage) => {
        const messageId = message._id.toString();

        // Está sonando este mismo: pausar sin perder la posición.
        if (currentlyPlayingId === messageId && soundRef.current) {
            try {
                await soundRef.current.pauseAsync();
                setCurrentlyPlayingId(null);
            } catch (error) {
                console.error('Error pausando audio:', error);
            }
            return;
        }

        // Sigue cargado pero pausado: retomar donde quedó.
        if (loadedIdRef.current === messageId && soundRef.current) {
            try {
                await soundRef.current.playAsync();
                setCurrentlyPlayingId(messageId);
                return;
            } catch {
                // Si no se pudo retomar, se recarga desde cero más abajo.
            }
        }

        await playAudio(message);
    };

    // Al desmontar se suelta lo que esté sonando. Se trabaja sobre los refs
    // en vez de llamar a una función del cuerpo del hook, así el efecto no
    // depende de nada que cambie entre renders.
    useEffect(() => {
        return () => {
            playTokenRef.current += 1;
            const sound = soundRef.current;
            soundRef.current = null;
            loadedIdRef.current = null;
            sound?.unloadAsync().catch(() => {});
        };
    }, []);

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
        toggleAudioPlayback,
        formatAudioDuration,
    };
}
