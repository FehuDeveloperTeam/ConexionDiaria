import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Componente ImageViewer Modal con Zoom
export const ImageViewerModal: React.FC<{
    visible: boolean;
    imageUri: string;
    onClose: () => void;
    onDownload?: () => void;
}> = ({ visible, imageUri, onClose, onDownload }) => {
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        try {
            setIsDownloading(true);

            // Solicitar permisos
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso Denegado', 'Necesitamos permisos para guardar la imagen');
                setIsDownloading(false);
                return;
            }

            // Descargar imagen
            const filename = imageUri.split('/').pop() || `image_${Date.now()}.jpg`;
            const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
            if (!docDir) {
                throw new Error('No se puede acceder al directorio de archivos');
            }
            const fileUri = `${docDir}${filename}`;

            const downloadResult = await (FileSystem as any).downloadAsync(imageUri, fileUri);

            // Guardar en galería
            await MediaLibrary.createAssetAsync(downloadResult.uri);

            Toast.show({
                type: 'success',
                text1: 'Imagen guardada',
                text2: 'La imagen se guardó en tu galería',
            });

            setIsDownloading(false);
        } catch (error) {
            console.error('Error descargando imagen:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo descargar la imagen',
            });
            setIsDownloading(false);
        }
    };

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
            }}>
                {/* Botón Cerrar */}
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

                {/* Botón Descargar */}
                <TouchableOpacity
                    style={{
                        position: 'absolute',
                        top: 50,
                        right: 20,
                        zIndex: 10,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        padding: 8,
                    }}
                    onPress={handleDownload}
                    disabled={isDownloading}
                >
                    {isDownloading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Ionicons name="download-outline" size={28} color="#FFF" />
                    )}
                </TouchableOpacity>

                {/* Imagen con Zoom usando ScrollView */}
                <ScrollView
                    contentContainerStyle={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    centerContent={true}
                >
                    <Image
                        source={{ uri: imageUri }}
                        style={{
                            width: SCREEN_WIDTH,
                            height: SCREEN_HEIGHT * 0.8,
                            resizeMode: 'contain',
                        }}
                    />
                </ScrollView>

                {/* Instrucciones */}
                <View style={{
                    position: 'absolute',
                    bottom: 40,
                    left: 0,
                    right: 0,
                    alignItems: 'center',
                }}>
                    <Text style={{
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: 14,
                    }}>
                        Pellizca para hacer zoom
                    </Text>
                </View>
            </View>
        </Modal>
    );
};
