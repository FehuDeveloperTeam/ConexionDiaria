import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, useColorScheme, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { themes } from '../../../config/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Componente FileViewer Modal con Descarga
export const FileViewerModal: React.FC<{
    visible: boolean;
    fileUri: string;
    fileName: string;
    fileSize?: number;
    onClose: () => void;
}> = ({ visible, fileUri, fileName, fileSize, onClose }) => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const getFileExtension = (filename: string) => {
        return filename.split('.').pop()?.toLowerCase() || '';
    };

    const getFileIcon = (filename: string) => {
        const ext = getFileExtension(filename);
        switch (ext) {
            case 'pdf':
                return 'document-text';
            case 'doc':
            case 'docx':
                return 'document';
            case 'xls':
            case 'xlsx':
                return 'stats-chart';
            case 'zip':
            case 'rar':
                return 'archive';
            case 'txt':
                return 'document-text-outline';
            default:
                return 'document-attach';
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return 'Tamaño desconocido';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const handleDownload = async () => {
        try {
            setIsDownloading(true);
            setDownloadProgress(0);

            const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory;
            if (!docDir) {
                throw new Error('No se puede acceder al directorio de archivos');
            }
            const fileUri_local = `${docDir}${fileName}`;

            const downloadResumable = (FileSystem as any).createDownloadResumable(
                fileUri,
                fileUri_local,
                {},
                (downloadProgress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => {
                    const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                    setDownloadProgress(progress * 100);
                }
            );

            const result = await downloadResumable.downloadAsync();

            if (result && result.uri) {
                // Compartir el archivo descargado
                const canShare = await Sharing.isAvailableAsync();
                if (canShare) {
                    await Sharing.shareAsync(result.uri, {
                        mimeType: 'application/*',
                        dialogTitle: 'Guardar archivo',
                    });

                    Toast.show({
                        type: 'success',
                        text1: 'Archivo descargado',
                        text2: 'El archivo se guardó correctamente',
                    });
                } else {
                    Toast.show({
                        type: 'info',
                        text1: 'Archivo guardado',
                        text2: `Guardado en: ${result.uri}`,
                    });
                }
            }

            setIsDownloading(false);
            setDownloadProgress(0);
        } catch (error) {
            console.error('Error descargando archivo:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo descargar el archivo',
            });
            setIsDownloading(false);
            setDownloadProgress(0);
        }
    };

    const handleOpenInBrowser = () => {
        Linking.openURL(fileUri);
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'flex-end',
            }}>
                <View style={{
                    backgroundColor: theme.background,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                    padding: 20,
                    maxHeight: SCREEN_HEIGHT * 0.7,
                }}>
                    {/* Header */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20,
                    }}>
                        <Text style={{
                            fontSize: 18,
                            fontWeight: 'bold',
                            color: theme.text,
                            flex: 1,
                        }}>
                            Vista Previa
                        </Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {/* File Info */}
                    <View style={{
                        alignItems: 'center',
                        paddingVertical: 30,
                    }}>
                        <View style={{
                            width: 100,
                            height: 100,
                            borderRadius: 50,
                            backgroundColor: theme.primary + '20',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 20,
                        }}>
                            <Ionicons
                                name={getFileIcon(fileName) as any}
                                size={50}
                                color={theme.primary}
                            />
                        </View>

                        <Text style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: theme.text,
                            textAlign: 'center',
                            marginBottom: 8,
                        }}>
                            {fileName}
                        </Text>

                        <Text style={{
                            fontSize: 14,
                            color: theme.placeholder,
                            marginBottom: 20,
                        }}>
                            {formatFileSize(fileSize)}
                        </Text>

                        {/* Progress Bar */}
                        {isDownloading && (
                            <View style={{ width: '100%', marginBottom: 20 }}>
                                <View style={{
                                    height: 4,
                                    backgroundColor: theme.placeholder + '30',
                                    borderRadius: 2,
                                    overflow: 'hidden',
                                }}>
                                    <View style={{
                                        height: '100%',
                                        width: `${downloadProgress}%`,
                                        backgroundColor: theme.primary,
                                    }} />
                                </View>
                                <Text style={{
                                    fontSize: 12,
                                    color: theme.placeholder,
                                    textAlign: 'center',
                                    marginTop: 8,
                                }}>
                                    Descargando... {downloadProgress.toFixed(0)}%
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View style={{ marginBottom: 12 }}>
                        <TouchableOpacity
                            style={{
                                backgroundColor: theme.primary,
                                padding: 16,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 8,
                            }}
                            onPress={handleDownload}
                            disabled={isDownloading}
                        >
                            {isDownloading ? (
                                <ActivityIndicator size="small" color={theme.white} />
                            ) : (
                                <Ionicons name="download-outline" size={24} color={theme.white} />
                            )}
                            <Text style={{
                                color: theme.white,
                                fontSize: 16,
                                fontWeight: '600',
                                marginLeft: 8,
                            }}>
                                {isDownloading ? 'Descargando...' : 'Descargar Archivo'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8',
                                padding: 16,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 8,
                            }}
                            onPress={handleOpenInBrowser}
                        >
                            <Ionicons name="open-outline" size={24} color={theme.text} />
                            <Text style={{
                                color: theme.text,
                                fontSize: 16,
                                fontWeight: '600',
                                marginLeft: 8,
                            }}>
                                Abrir en Navegador
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
