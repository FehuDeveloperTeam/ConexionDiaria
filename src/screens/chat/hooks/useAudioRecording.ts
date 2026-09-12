import { useState, useRef } from 'react';
import { Alert, Keyboard } from 'react-native';
import { Audio } from 'expo-av';
import Toast from 'react-native-toast-message';

// Grabación de notas de voz: permisos, contador de duración y el envío
// (o cancelación) al soltar, delegando la subida en useChatUploads.
export function useAudioRecording({
    plan,
    usedStorage,
    maxStorage,
    uploadAudio,
    onNeedUpgrade,
}: {
    plan: 'free' | 'premium';
    usedStorage: number;
    maxStorage: number;
    uploadAudio: (uri: string) => Promise<void>;
    onNeedUpgrade: () => void;
}) {
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Función para formatear tiempo de grabación
    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Función para iniciar grabación de audio
    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();

            if (permission.status !== 'granted') {
                Alert.alert(
                    'Permiso Denegado',
                    'Necesitamos acceso al micrófono para grabar notas de voz.',
                    [{ text: 'OK' }]
                );
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsRecording(true);
            setRecordingDuration(0);

            // Iniciar contador de duración
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

            Keyboard.dismiss();

        } catch (error) {
            console.error('Error iniciando grabación:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo iniciar la grabación',
            });
        }
    };

    // Función para detener grabación y enviar
    const stopRecording = async () => {
        if (!recording) return;

        try {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }

            setIsRecording(false);
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();

            if (uri) {
                // Verificar almacenamiento antes de subir
                if (plan === 'free') {
                    const fileInfo = await fetch(uri);
                    const blob = await fileInfo.blob();
                    const fileSize = blob.size;

                    if (usedStorage + fileSize > maxStorage) {
                        onNeedUpgrade();
                        setRecording(null);
                        return;
                    }
                }

                await uploadAudio(uri);
            }

            setRecording(null);
            setRecordingDuration(0);

        } catch (error) {
            console.error('Error deteniendo grabación:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el audio',
            });
        }
    };

    // Función para cancelar grabación
    const cancelRecording = async () => {
        if (!recording) return;

        try {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }

            setIsRecording(false);
            await recording.stopAndUnloadAsync();
            setRecording(null);
            setRecordingDuration(0);

            Toast.show({
                type: 'info',
                text1: 'Grabación cancelada',
            });

        } catch (error) {
            console.error('Error cancelando grabación:', error);
        }
    };

    return {
        isRecording,
        recordingDuration,
        startRecording,
        stopRecording,
        cancelRecording,
        formatRecordingTime,
    };
}
