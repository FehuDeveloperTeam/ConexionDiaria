// Visor de imágenes del chat — Sprint 9.2. Antes recibía una sola URI y
// mostraba únicamente la foto pinchada; ahora recibe todas las del hilo y se
// puede recorrer con las flechas o la tira de miniaturas, igual que el visor
// del Álbum.
//
// Dos detalles heredados de arreglar ese visor: el alto de la imagen se mide
// con onLayout en vez de calcularse con Dimensions al cargar el módulo (un
// valor que no se entera de que la ventana cambió de tamaño), y la tira de
// miniaturas lleva flexGrow/flexShrink 0 porque en react-native-web todo
// ScrollView trae flexGrow:1, y en uno horizontal ese crecimiento va en el
// eje del padre — o sea vertical — y se comía media pantalla.
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import Toast from 'react-native-toast-message';

export const ImageViewerModal: React.FC<{
    images: string[];
    index: number | null;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}> = ({ images, index, onIndexChange, onClose }) => {
    const [isDownloading, setIsDownloading] = useState(false);
    const [boxSize, setBoxSize] = useState({ width: 0, height: 0 });

    const currentUri = index !== null ? images[index] : undefined;

    const handleDownload = async () => {
        if (!currentUri) return;
        try {
            setIsDownloading(true);

            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso Denegado', 'Necesitamos permisos para guardar la imagen');
                setIsDownloading(false);
                return;
            }

            const filename = currentUri.split('/').pop()?.split('?')[0] || `image_${Date.now()}.jpg`;
            const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
            if (!docDir) {
                throw new Error('No se puede acceder al directorio de archivos');
            }
            const fileUri = `${docDir}${filename}`;

            const downloadResult = await (FileSystem as any).downloadAsync(currentUri, fileUri);
            await MediaLibrary.createAssetAsync(downloadResult.uri);

            Toast.show({
                type: 'success',
                text1: 'Imagen guardada',
                text2: 'La imagen se guardó en tu galería',
            });
        } catch (error) {
            console.error('Error descargando imagen:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo descargar la imagen',
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <Modal
            visible={index !== null}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' }}>
                {currentUri && index !== null && (
                    <>
                        <SafeAreaView
                            edges={['top']}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}
                        >
                            <TouchableOpacity onPress={onClose} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Cerrar la imagen">
                                <Ionicons name="close" size={26} color="#FFFFFF" />
                            </TouchableOpacity>

                            <Text style={{ flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>
                                {images.length > 1 ? `${index + 1} de ${images.length}` : ''}
                            </Text>

                            <TouchableOpacity onPress={handleDownload} disabled={isDownloading} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Descargar la imagen">
                                {isDownloading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <Ionicons name="download-outline" size={24} color="#FFFFFF" />
                                )}
                            </TouchableOpacity>
                        </SafeAreaView>

                        <View
                            style={{ flex: 1, justifyContent: 'center' }}
                            onLayout={(e) => setBoxSize({
                                width: e.nativeEvent.layout.width,
                                height: e.nativeEvent.layout.height,
                            })}
                        >
                            <ScrollView
                                style={{ flex: 1 }}
                                contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
                                maximumZoomScale={3}
                                minimumZoomScale={1}
                                showsHorizontalScrollIndicator={false}
                                showsVerticalScrollIndicator={false}
                                centerContent
                            >
                                {boxSize.height > 0 && (
                                    <Image
                                        source={{ uri: currentUri }}
                                        style={{
                                            width: boxSize.width * 0.94,
                                            height: boxSize.height * 0.94,
                                            resizeMode: 'contain',
                                        }}
                                    />
                                )}
                            </ScrollView>

                            {index > 0 && (
                                <TouchableOpacity
                                    onPress={() => onIndexChange(index - 1)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Imagen anterior"
                                    style={{
                                        position: 'absolute', left: 16, top: '50%', marginTop: -19,
                                        width: 38, height: 38, borderRadius: 19,
                                        backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                            {index < images.length - 1 && (
                                <TouchableOpacity
                                    onPress={() => onIndexChange(index + 1)}
                                    accessibilityRole="button"
                                    accessibilityLabel="Imagen siguiente"
                                    style={{
                                        position: 'absolute', right: 16, top: '50%', marginTop: -19,
                                        width: 38, height: 38, borderRadius: 19,
                                        backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
                                    }}
                                >
                                    <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {images.length > 1 && (
                            <SafeAreaView edges={['bottom']}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={{ flexGrow: 0, flexShrink: 0 }}
                                    contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' }}
                                >
                                    {images.map((uri, idx) => (
                                        <TouchableOpacity key={`${uri}-${idx}`} onPress={() => onIndexChange(idx)}>
                                            <Image
                                                source={{ uri }}
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 8,
                                                    opacity: idx === index ? 1 : 0.5,
                                                    borderWidth: idx === index ? 2 : 0,
                                                    borderColor: '#FFFFFF',
                                                }}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </SafeAreaView>
                        )}
                    </>
                )}
            </View>
        </Modal>
    );
};
