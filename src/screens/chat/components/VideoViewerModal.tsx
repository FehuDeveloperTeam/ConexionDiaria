import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Componente VideoViewer Modal
// TODO: es un stub — falta implementar el reproductor de video real.
export const VideoViewerModal: React.FC<{
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

                <Text style={{ color: '#FFF', fontSize: 16 }}>
                    Vista previa de video - Implementar reproductor
                </Text>
            </View>
        </Modal>
    );
};
