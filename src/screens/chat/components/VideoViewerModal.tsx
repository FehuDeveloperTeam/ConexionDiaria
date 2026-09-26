// Visor de video a pantalla completa — Sprint 9.23.
//
// Hasta ahora este archivo era un stub con el texto "Implementar reproductor":
// existía el componente pero no había forma de mandar un video, así que nunca
// se llegaba a abrir.
//
// Usa el reproductor de expo-av, que es la dependencia que el proyecto ya
// tiene para las notas de voz — no hace falta agregar ninguna. Los controles
// son los nativos de la plataforma: un reproductor propio significaría
// rehacer barra de progreso, volumen y pantalla completa en dos sistemas y en
// web, y no aporta nada frente al del sistema.
import React, { useEffect, useRef } from 'react';
import { Modal, View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export const VideoViewerModal: React.FC<{
    visible: boolean;
    videoUri: string;
    onClose: () => void;
}> = ({ visible, videoUri, onClose }) => {
    const videoRef = useRef<Video>(null);
    const { width, height } = useWindowDimensions();

    // Cerrar el visor tiene que cortar el sonido. Sin esto, el video sigue
    // corriendo detrás del chat: el modal se desmonta pero el reproductor
    // nativo no se entera.
    useEffect(() => {
        if (!visible) videoRef.current?.pauseAsync().catch(() => { });
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Cerrar el video"
                    style={{
                        position: 'absolute', top: 50, left: 20, zIndex: 10,
                        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: 8,
                    }}
                    onPress={onClose}
                >
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>

                {!!videoUri && (
                    <Video
                        ref={videoRef}
                        source={{ uri: videoUri }}
                        style={{ width, height: height * 0.7 }}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        // Se abre reproduciendo: si alguien tocó el video, es
                        // porque quiere verlo.
                        shouldPlay={visible}
                        isLooping={false}
                    />
                )}
            </View>
        </Modal>
    );
};
