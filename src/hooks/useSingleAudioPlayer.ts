// Reproductor de un audio a la vez — Sprint 9.15.
//
// OJO — COPIA HERMANA: la misma máquina de estados existe en
// src/screens/chat/hooks/useAudioPlayback.ts, que además marca el mensaje como
// escuchado y suena avisos de inicio y fin. **Un arreglo acá NO llega allá.**
// Antes de tocar este archivo, mirar si el mismo problema existe en el otro.
//
// La unificación quedó pendiente a propósito (Sprint 11.8): fusionarlas obliga
// a cambiar este hook, del que dependen las Notas, y la reproducción real no
// se puede probar en el entorno de desarrollo remoto —sin dispositivo y con
// expo-av simulado—. Es el código que costó tres intentos arreglar, así que se
// prefirió cubrir el núcleo con pruebas (tests/ui/singleAudioPlayer.test.tsx)
// antes que refactorizarlo a ciegas.
//
// Es la parte genérica del reproductor del chat (Sprint 9.1), sin lo que
// depende de los mensajes: acá no se marca nada como escuchado ni se suenan
// avisos, solo se reproduce, se pausa y se retoma.
//
// Mantiene las dos decisiones que costaron aquel sprint:
//   - el sonido activo vive en refs, no en estado, porque quien decide si
//     pausar o cargar otro necesita el valor de AHORA; con un useState a
//     medio aplicar terminaban sonando dos audios a la vez;
//   - cada intento lleva un número, así una carga que quedó obsoleta porque
//     el usuario tocó otro audio se descarta en vez de sonar tarde.
import { useState, useEffect, useRef } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

export function useSingleAudioPlayer() {
    // Solo es 'playingId' lo que está SONANDO: al pausar vuelve a null para
    // que el botón muestre play, conservando el progreso para retomar.
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ [key: string]: number }>({});

    const soundRef = useRef<Audio.Sound | null>(null);
    const loadedIdRef = useRef<string | null>(null);
    const playTokenRef = useRef(0);

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

    const handleStatus = (id: string, token: number, status: AVPlaybackStatus) => {
        if (token !== playTokenRef.current) return;
        if (!status.isLoaded) return;

        if (status.durationMillis) {
            setProgress(prev => ({ ...prev, [id]: status.positionMillis / status.durationMillis! }));
        }

        if (status.didJustFinish) {
            releaseActiveSound();
            setPlayingId(null);
            setProgress(prev => {
                const { [id]: _unused, ...rest } = prev;
                return rest;
            });
        }
    };

    const toggle = async (id: string, url: string) => {
        // Suena este mismo: pausar sin perder la posición.
        if (playingId === id && soundRef.current) {
            try {
                await soundRef.current.pauseAsync();
                setPlayingId(null);
            } catch (error) {
                console.error('Error pausando el audio:', error);
            }
            return;
        }

        // Sigue cargado pero pausado: retomar donde quedó.
        if (loadedIdRef.current === id && soundRef.current) {
            try {
                await soundRef.current.playAsync();
                setPlayingId(id);
                return;
            } catch {
                // Si no se pudo retomar, se recarga desde cero más abajo.
            }
        }

        const token = ++playTokenRef.current;
        try {
            setLoadingId(id);
            await releaseActiveSound();
            setPlayingId(null);
            // Se descargó el anterior, así que ese audio vuelve a empezar de
            // cero: la barra tiene que decir lo mismo.
            setProgress(prev => ({ ...prev, [id]: 0 }));

            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    playsInSilentModeIOS: true,
                    staysActiveInBackground: false,
                    shouldDuckAndroid: false,
                    playThroughEarpieceAndroid: false,
                });
            } catch {
                // En web esta llamada no siempre aplica; no debe impedir oír nada.
            }

            // Se carga en pausa y se arranca abajo, ya con el estado puesto:
            // si naciera sonando, el botón se enteraría varios await después.
            const { sound } = await Audio.Sound.createAsync(
                { uri: url },
                { shouldPlay: false },
                (status) => handleStatus(id, token, status)
            );

            if (token !== playTokenRef.current) {
                await sound.unloadAsync().catch(() => {});
                return;
            }

            soundRef.current = sound;
            loadedIdRef.current = id;
            setPlayingId(id);
            setLoadingId(null);
            await sound.playAsync();
        } catch (error) {
            console.error('Error reproduciendo el audio:', error);
            await releaseActiveSound();
            setLoadingId(null);
            setPlayingId(null);
        }
    };

    // Al desmontar se suelta lo que esté sonando, trabajando sobre los refs
    // para que el efecto no dependa de nada que cambie entre renders.
    useEffect(() => {
        return () => {
            playTokenRef.current += 1;
            const sound = soundRef.current;
            soundRef.current = null;
            loadedIdRef.current = null;
            sound?.unloadAsync().catch(() => {});
        };
    }, []);

    return { playingId, loadingId, progress, toggle };
}

export const formatAudioDuration = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
