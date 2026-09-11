import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
    View, useColorScheme, Platform, KeyboardAvoidingView, StyleSheet,
    ActivityIndicator, Text, TouchableOpacity, Image, UIManager, AppState,
    Alert, Linking, Keyboard, Modal, Dimensions, Animated, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GiftedChat, IMessage, InputToolbar, Composer, Send, Actions, Bubble } from 'react-native-gifted-chat';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc,
    updateDoc, Timestamp, limit, getDocs, startAfter,
    QueryDocumentSnapshot, DocumentData
} from 'firebase/firestore';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useActionSheet, ActionSheetProvider } from '@expo/react-native-action-sheet';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import Toast from 'react-native-toast-message';
import { usePlan } from '../../src/contexts/planContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Tamaño de página para el chat: la ventana "en vivo" (onSnapshot) carga las
// últimas MESSAGES_PAGE_SIZE, y "cargar mensajes anteriores" trae de a
// MESSAGES_PAGE_SIZE más con una lectura puntual (getDocs), no en tiempo real.
const MESSAGES_PAGE_SIZE = 40;

// Extender el tipo IMessage para incluir campos personalizados
interface ExtendedMessage extends IMessage {
    audio?: string;
    file?: string;
    fileName?: string;
    fileSize?: number;
    delivered?: boolean;
    read?: boolean;
    audioPlayed?: boolean;
    deleted?: boolean;
    sentAt?: Date;
}

// Convierte un documento de Firestore de la subcolección 'messages' al
// formato que usa GiftedChat. Se usa tanto en el listener en vivo como en
// 'cargar mensajes anteriores', para no duplicar el mapeo.
const mapMessageDoc = (doc: QueryDocumentSnapshot<DocumentData>): ExtendedMessage => {
    const data = doc.data();
    return {
        _id: doc.id,
        text: data.text || '',
        createdAt: data.createdAt?.toDate() || new Date(),
        user: {
            _id: data.user._id,
            name: data.user.name,
        },
        image: data.image,
        video: data.video,
        audio: data.audio,
        file: data.file,
        fileName: data.fileName,
        fileSize: data.fileSize,
        delivered: data.delivered ?? false,
        read: data.read ?? false,
        audioPlayed: data.audioPlayed ?? false,
        deleted: data.deleted ?? false,
        sentAt: data.sentAt?.toDate(),
    };
};

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Función helper para convertir URI a Blob
const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) { 
            console.error("uriToBlob falló:", e);
            reject(new TypeError("Network request failed")); 
        };
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
};

// Componente de palomas de estado - Mejorado estilo WhatsApp
const MessageStatus: React.FC<{ message: ExtendedMessage; isOwn: boolean }> = ({ message, isOwn }) => {
    if (!isOwn || message.deleted) return null;

    const getStatusIcon = () => {
        if (message.read) {
            return (
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginLeft: 2,
                    position: 'relative',
                    width: 16,
                    height: 14,
                }}>
                    <Ionicons 
                        name="checkmark" 
                        size={14} 
                        color="#FF69B4" 
                        style={{ position: 'absolute', left: 0 }}
                    />
                    <Ionicons 
                        name="checkmark" 
                        size={14} 
                        color="#FF69B4" 
                        style={{ position: 'absolute', left: 4 }}
                    />
                </View>
            );
        }
        if (message.delivered) {
            return (
                <View style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    marginLeft: 2,
                    position: 'relative',
                    width: 16,
                    height: 14,
                }}>
                    <Ionicons 
                        name="checkmark" 
                        size={14} 
                        color="#FFF" 
                        style={{ position: 'absolute', left: 0 }}
                    />
                    <Ionicons 
                        name="checkmark" 
                        size={14} 
                        color="#FFF" 
                        style={{ position: 'absolute', left: 4 }}
                    />
                </View>
            );
        }
        return <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginLeft: 2 }} />;
    };

    return (
        <View style={{ marginLeft: 4 }}>
            {getStatusIcon()}
        </View>
    );
};

// Modal de Upgrade Premium
const UpgradeModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    usedStorage: number;
    maxStorage: number;
}> = ({ visible, onClose, usedStorage, maxStorage }) => {
    const usedMB = (usedStorage / (1024 * 1024)).toFixed(2);
    const maxMB = (maxStorage / (1024 * 1024)).toFixed(0);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
            }}>
                <View style={{
                    backgroundColor: '#FFF',
                    borderRadius: 20,
                    padding: 24,
                    width: '90%',
                    maxWidth: 400,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}>
                    {/* Icono */}
                    <View style={{
                        alignItems: 'center',
                        marginBottom: 20,
                    }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: '#FFE5F0',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Ionicons name="cloud-upload" size={40} color="#FF69B4" />
                        </View>
                    </View>

                    {/* Título */}
                    <Text style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: '#1a1a1a',
                        textAlign: 'center',
                        marginBottom: 12,
                    }}>
                        Almacenamiento Lleno
                    </Text>

                    {/* Descripción */}
                    <Text style={{
                        fontSize: 16,
                        color: '#666',
                        textAlign: 'center',
                        marginBottom: 20,
                        lineHeight: 24,
                    }}>
                        Has utilizado {usedMB} MB de {maxMB} MB disponibles
                    </Text>

                    {/* Beneficios Premium */}
                    <View style={{
                        backgroundColor: '#F8F8F8',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                    }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: '#1a1a1a',
                            marginBottom: 12,
                        }}>
                            Con Premium obtendrás:
                        </Text>
                        
                        <View style={{ }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    25 GB de almacenamiento
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    Envío ilimitado de multimedia
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    Calidad original sin compresión
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    Respaldo de conversaciones
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Botones */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#FF69B4',
                            borderRadius: 12,
                            paddingVertical: 14,
                            marginBottom: 12,
                            shadowColor: '#FF69B4',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                        onPress={() => {
                            // TODO: Navegar a pantalla de compra Premium
                            Toast.show({
                                type: 'info',
                                text1: 'Próximamente',
                                text2: 'La pantalla de upgrade estará disponible pronto',
                            });
                            onClose();
                        }}
                    >
                        <Text style={{
                            color: '#FFF',
                            fontSize: 16,
                            fontWeight: '600',
                            textAlign: 'center',
                        }}>
                            Actualizar a Premium
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            paddingVertical: 12,
                        }}
                        onPress={onClose}
                    >
                        <Text style={{
                            color: '#666',
                            fontSize: 14,
                            textAlign: 'center',
                        }}>
                            Cerrar
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

// Componente ImageViewer Modal con Zoom
const ImageViewerModal: React.FC<{
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

// Componente VideoViewer Modal
const VideoViewerModal: React.FC<{
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

// Componente FileViewer Modal con Descarga
const FileViewerModal: React.FC<{
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
                                name={getFileIcon(fileName)} 
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

// Componente de Animación de Onda de Sonido (para grabación)
const SoundWaveAnimation: React.FC = () => {
    const [heights] = useState([
        useState(new Animated.Value(4))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(12))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(4))[0],
    ]);

    useEffect(() => {
        const animations = heights.map((height, index) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(height, {
                        toValue: 16,
                        duration: 300 + index * 100,
                        useNativeDriver: false,
                    }),
                    Animated.timing(height, {
                        toValue: 4,
                        duration: 300 + index * 100,
                        useNativeDriver: false,
                    }),
                ])
            );
        });

        animations.forEach(anim => anim.start());

        return () => {
            animations.forEach(anim => anim.stop());
        };
    }, []);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {heights.map((height, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 3,
                        height: height,
                        backgroundColor: '#FF69B4',
                        borderRadius: 2,
                        marginRight: index < heights.length - 1 ? 2 : 0,
                    }}
                />
            ))}
        </View>
    );
};

// Modal para ver foto de perfil de la pareja
const ProfilePhotoModal: React.FC<{
    visible: boolean;
    photoURL?: string;
    name: string;
    size: 'medium' | 'full';
    onClose: () => void;
    onExpand: () => void;
}> = ({ visible, photoURL, name, size, onClose, onExpand }) => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Botón Cerrar */}
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
                    onPress={onClose}
                >
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>

                {/* Foto de perfil */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={size === 'medium' ? onExpand : undefined}
                    style={{
                        alignItems: 'center',
                    }}
                >
                    {photoURL ? (
                        <Image
                            source={{ uri: photoURL }}
                            style={{
                                width: size === 'medium' ? 200 : SCREEN_WIDTH,
                                height: size === 'medium' ? 200 : SCREEN_HEIGHT * 0.8,
                                borderRadius: size === 'medium' ? 100 : 0,
                                resizeMode: size === 'medium' ? 'cover' : 'contain',
                            }}
                        />
                    ) : (
                        <View style={{
                            width: size === 'medium' ? 200 : 300,
                            height: size === 'medium' ? 200 : 300,
                            borderRadius: size === 'medium' ? 100 : 150,
                            backgroundColor: theme.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Text style={{
                                color: theme.white,
                                fontSize: size === 'medium' ? 80 : 120,
                                fontWeight: '600',
                            }}>
                                {name?.charAt(0).toUpperCase() || '❤️'}
                            </Text>
                        </View>
                    )}

                    {size === 'medium' && (
                        <Text style={{
                            color: '#FFF',
                            fontSize: 24,
                            fontWeight: '600',
                            marginTop: 20,
                        }}>
                            {name}
                        </Text>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

// Componente de Animación de Onda de Audio (para reproducción en mensaje)
const AudioWaveAnimation: React.FC<{ color: string }> = ({ color }) => {
    const [heights] = useState([
        useState(new Animated.Value(4))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(14))[0],
        useState(new Animated.Value(10))[0],
        useState(new Animated.Value(6))[0],
        useState(new Animated.Value(12))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(4))[0],
    ]);

    useEffect(() => {
        const animations = heights.map((height, index) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(height, {
                        toValue: 18 + Math.random() * 6,
                        duration: 400 + index * 80,
                        useNativeDriver: false,
                    }),
                    Animated.timing(height, {
                        toValue: 4 + Math.random() * 4,
                        duration: 400 + index * 80,
                        useNativeDriver: false,
                    }),
                ])
            );
        });

        animations.forEach(anim => anim.start());

        return () => {
            animations.forEach(anim => anim.stop());
        };
    }, []);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            {heights.map((height, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 3,
                        height: height,
                        backgroundColor: color,
                        borderRadius: 1.5,
                        marginHorizontal: 2,
                    }}
                />
            ))}
        </View>
    );
};

// Componente Principal del Chat
const ChatScreen = () => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;
    const router = useRouter();
    const { showActionSheetWithOptions } = useActionSheet();

    // Context de Plan
    const { userData, relationshipData, plan, isLoading: planLoading } = usePlan();

    // Estados principales
    // 'messages' se arma a partir de dos piezas: la ventana en vivo (los
    // últimos MESSAGES_PAGE_SIZE, vía onSnapshot) y las páginas anteriores
    // ya cargadas con "cargar mensajes anteriores" (estáticas, vía getDocs).
    const [liveMessages, setLiveMessages] = useState<ExtendedMessage[]>([]);
    const [earlierMessages, setEarlierMessages] = useState<ExtendedMessage[]>([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
    const oldestMessageDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
    const messages = useMemo(
        () => [...liveMessages, ...earlierMessages],
        [liveMessages, earlierMessages]
    );
    const [inputText, setInputText] = useState('');
    const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Estados para reproducción de audio SIMPLIFICADOS
    const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
    const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
    const [audioProgress, setAudioProgress] = useState<{ [key: string]: number }>({});
    const [audioDurations, setAudioDurations] = useState<{ [key: string]: number }>({});
    const [isLoadingAudio, setIsLoadingAudio] = useState<string | null>(null);
    const notificationSoundRef = useRef<Audio.Sound | null>(null);
    const completionSoundRef = useRef<Audio.Sound | null>(null);

    // Estados para grabación de audio
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Estados de UI
    const [imageViewerVisible, setImageViewerVisible] = useState(false);
    const [videoViewerVisible, setVideoViewerVisible] = useState(false);
    const [selectedMediaUri, setSelectedMediaUri] = useState('');
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    
    // Estados para el modal de archivos
    const [fileViewerVisible, setFileViewerVisible] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{uri: string; name: string; size?: number} | null>(null);

    // Estados para el header (info de la pareja)
    const [partnerInfo, setPartnerInfo] = useState<{
        name: string;
        isOnline: boolean;
        lastSeen: Timestamp | null;
        photoURL?: string;
    } | null>(null);
    const [showProfilePhoto, setShowProfilePhoto] = useState(false);
    const [profilePhotoSize, setProfilePhotoSize] = useState<'medium' | 'full'>('medium');
    
    // Estado para manejar el teclado
    const [, setKeyboardHeight] = useState(0);

    // Calcular almacenamiento usado
    const usedStorage = relationshipData?.usedStorage || 0;
    const maxStorage = plan === 'premium' ? 25 * 1024 * 1024 * 1024 : 100 * 1024 * 1024; // 25GB vs 100MB

    // Listener del teclado para iOS
    useEffect(() => {
        if (Platform.OS !== 'ios') return;

        const keyboardWillShow = Keyboard.addListener('keyboardWillShow', (e) => {
            setKeyboardHeight(e.endCoordinates.height);
        });

        const keyboardWillHide = Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
        });

        return () => {
            keyboardWillShow.remove();
            keyboardWillHide.remove();
        };
    }, []);

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
                        require('../../assets/sounds/notification.mp3'),
                        { shouldPlay: false }
                    );
                    notificationSoundRef.current = notifSound;
                } catch {
                    console.log('Archivo notification.mp3 no encontrado - continuando sin sonido');
                }

                try {
                    const { sound: completeSound } = await Audio.Sound.createAsync(
                        require('../../assets/sounds/complete.mp3'),
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

    // Escuchar cambios en los datos de la pareja para el header
    useEffect(() => {
        console.log('🔍 Hook de pareja ejecutado:', {
            hasUserData: !!userData,
            partnerId: userData?.partnerId
        });

        if (!userData?.partnerId) {
            console.log('⚠️ No hay partnerId aún');
            return;
        }

        console.log('👥 Cargando datos de la pareja:', userData.partnerId);

        const partnerRef = doc(db, 'users', userData.partnerId);
        const unsubscribe = onSnapshot(partnerRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();
                
                // Intentar obtener el nombre de diferentes campos posibles
                const partnerName = data.name || data.displayName || data.fullName || data.username || 'Pareja';
                
                console.log('✅ Datos de pareja recibidos:', {
                    rawData: data,
                    name: data.name,
                    displayName: data.displayName,
                    fullName: data.fullName,
                    username: data.username,
                    selectedName: partnerName,
                    isOnline: data.isOnline,
                    hasLastSeen: !!data.lastSeen,
                    hasPhotoURL: !!data.photoURL
                });
                
                setPartnerInfo({
                    name: partnerName,
                    isOnline: data.isOnline || false,
                    lastSeen: data.lastSeen || null,
                    photoURL: data.photoURL || data.photoUrl || undefined,
                });
            } else {
                console.log('❌ Documento de pareja no existe');
            }
        }, (error) => {
            console.error('❌ Error cargando datos de pareja:', error);
        });

        return () => unsubscribe();
    }, [userData?.partnerId]);

    // Actualizar estado de presencia del usuario actual (isOnline/lastSeen)
    useEffect(() => {
        if (!currentUser) return;

        console.log('🟢 Iniciando sistema de presencia para:', currentUser.uid);

        const userStatusRef = doc(db, 'users', currentUser.uid);
        let updateInterval: ReturnType<typeof setInterval>;

        // Función para marcar como online
        const setUserOnline = async () => {
            try {
                await updateDoc(userStatusRef, {
                    isOnline: true,
                    lastSeen: Timestamp.now()
                });
                console.log('✅ Usuario marcado como online');
            } catch (error) {
                console.error('❌ Error actualizando presencia:', error);
            }
        };

        // Función para marcar como offline
        const setUserOffline = async () => {
            try {
                await updateDoc(userStatusRef, {
                    isOnline: false,
                    lastSeen: Timestamp.now()
                });
                console.log('🔴 Usuario marcado como offline');
            } catch (error) {
                console.error('❌ Error actualizando presencia:', error);
            }
        };

        // Marcar como online al iniciar
        setUserOnline();

        // Actualizar cada 30 segundos para mantener online
        updateInterval = setInterval(() => {
            if (AppState.currentState === 'active') {
                setUserOnline();
            }
        }, 30000);

        // Listener de cambios de estado de la app
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('📱 App activa');
                await setUserOnline();
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                console.log('📱 App en background');
                await setUserOffline();
            }
        });

        // Cleanup: marcar como offline al desmontar
        return () => {
            clearInterval(updateInterval);
            setUserOffline();
            subscription.remove();
        };
    }, [currentUser]);

    // Actualizar la visualización del tiempo de última conexión cada minuto
    useEffect(() => {
        const interval = setInterval(() => {
            // Forzar re-render para actualizar "Hace X min"
            if (partnerInfo && !partnerInfo.isOnline && partnerInfo.lastSeen) {
                setPartnerInfo(prev => prev ? { ...prev } : null);
            }
        }, 60000); // Cada 60 segundos

        return () => clearInterval(interval);
    }, [partnerInfo]);

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

    // Función SIMPLIFICADA para reproducir audio (sin cola)
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
                        setShowUpgradeModal(true);
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

    // Autenticación y carga de mensajes
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(!user);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!currentUser || !userData?.partnerId) {
            setLiveMessages([]);
            setEarlierMessages([]);
            setHasMoreMessages(false);
            oldestMessageDocRef.current = null;
            setLoading(false);
            return;
        }

        // Nueva conversación (cambió el usuario o la pareja): descartar
        // cualquier página "anterior" que se hubiera cargado para la charla previa.
        setEarlierMessages([]);
        setHasMoreMessages(false);
        oldestMessageDocRef.current = null;

        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
        const messagesRef = collection(db, 'relationships', relationshipId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PAGE_SIZE));

        const unsubscribe = onSnapshot(q, async (snapshot) => {
            const loadedMessages: ExtendedMessage[] = snapshot.docs.map(mapMessageDoc);

            console.log('📨 Mensajes cargados:', loadedMessages.length, 'primer mensaje:', loadedMessages[0]?._id);
            setLiveMessages(loadedMessages);
            setLoading(false);

            // El cursor de paginación se fija con la primera carga de esta
            // ventana en vivo. Los siguientes disparos del listener (por un
            // 'delivered'/'read' que cambia, por ejemplo) no deben moverlo —
            // eso rompería 'cargar mensajes anteriores' a mitad de sesión.
            if (oldestMessageDocRef.current === null) {
                oldestMessageDocRef.current = snapshot.docs[snapshot.docs.length - 1] ?? null;
                setHasMoreMessages(snapshot.docs.length === MESSAGES_PAGE_SIZE);
            }

            // Marcar mensajes como entregados
            const undeliveredMessages = snapshot.docs.filter(doc => {
                const data = doc.data();
                return data.user._id !== currentUser.uid && !data.delivered;
            });

            for (const messageDoc of undeliveredMessages) {
                const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageDoc.id);
                await updateDoc(messageRef, { delivered: true });
            }

            // Marcar mensajes como leídos cuando la app está activa
            if (AppState.currentState === 'active') {
                const unreadMessages = snapshot.docs.filter(doc => {
                    const data = doc.data();
                    return data.user._id !== currentUser.uid && !data.read;
                });

                for (const messageDoc of unreadMessages) {
                    const messageRef = doc(db, 'relationships', relationshipId, 'messages', messageDoc.id);
                    await updateDoc(messageRef, { read: true });
                }
            }
        });

        return () => unsubscribe();
    }, [currentUser, userData?.partnerId]);

    // Cargar mensajes anteriores (paginación). Es una lectura puntual
    // (getDocs), no un listener en tiempo real — los mensajes viejos ya
    // enviados no necesitan actualizarse en vivo.
    const handleLoadEarlier = useCallback(async () => {
        if (!currentUser || !userData?.partnerId || !oldestMessageDocRef.current || isLoadingEarlier) {
            return;
        }

        setIsLoadingEarlier(true);
        try {
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const messagesRef = collection(db, 'relationships', relationshipId, 'messages');
            const q = query(
                messagesRef,
                orderBy('createdAt', 'desc'),
                startAfter(oldestMessageDocRef.current),
                limit(MESSAGES_PAGE_SIZE)
            );

            const snapshot = await getDocs(q);
            const olderMessages = snapshot.docs.map(mapMessageDoc);

            setEarlierMessages(prev => [...prev, ...olderMessages]);
            if (snapshot.docs.length > 0) {
                oldestMessageDocRef.current = snapshot.docs[snapshot.docs.length - 1];
            }
            setHasMoreMessages(snapshot.docs.length === MESSAGES_PAGE_SIZE);
        } catch (error) {
            console.error('Error cargando mensajes anteriores:', error);
        } finally {
            setIsLoadingEarlier(false);
        }
    }, [currentUser, userData?.partnerId, isLoadingEarlier]);

    // Enviar mensaje de texto
    const onSend = useCallback(async (newMessages: IMessage[] = []) => {
        if (!currentUser || !userData?.partnerId) return;

        const message = newMessages[0];
        const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');

        try {
            await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                text: message.text,
                createdAt: Timestamp.now(),
                user: {
                    _id: currentUser.uid,
                    name: userData.name || 'Usuario',
                },
                delivered: false,
                read: false,
                sentAt: Timestamp.now(),
            });

            setInputText('');
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el mensaje',
            });
        }
    }, [currentUser, userData]);

    // Función para verificar espacio de almacenamiento
    const checkStorage = async (fileSize: number): Promise<boolean> => {
        if (plan === 'premium') return true;

        if (usedStorage + fileSize > maxStorage) {
            setShowUpgradeModal(true);
            return false;
        }

        return true;
    };

    // Función para subir imagen
    const uploadImage = async (uri: string) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Comprimir imagen
            const compressedImage = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            // Verificar tamaño y almacenamiento
            const response = await fetch(compressedImage.uri);
            const blob = await response.blob();
            const fileSize = blob.size;

            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const filename = `${Crypto.randomUUID()}.jpg`;
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/images/${filename}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo imagen:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir la imagen',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        image: downloadURL,
                        text: '',
                        createdAt: Timestamp.now(),
                        user: {
                            _id: currentUser.uid,
                            name: userData.name || 'Usuario',
                        },
                        delivered: false,
                        read: false,
                        sentAt: Timestamp.now(),
                    });

                    // Actualizar almacenamiento usado
                    const relationshipRef = doc(db, 'relationships', relationshipId);
                    await updateDoc(relationshipRef, {
                        usedStorage: (usedStorage || 0) + fileSize
                    });

                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({
                        type: 'success',
                        text1: 'Imagen enviada',
                    });
                }
            );

        } catch (error) {
            console.error('Error en uploadImage:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo procesar la imagen',
            });
        }
    };

    // Función para subir audio
    const uploadAudio = async (uri: string) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            const blob = await uriToBlob(uri);
            const fileSize = blob.size;

            // Verificar almacenamiento
            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const filename = `${Crypto.randomUUID()}.m4a`;
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/audios/${filename}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo audio:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir el audio',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        audio: downloadURL,
                        text: '',
                        createdAt: Timestamp.now(),
                        user: {
                            _id: currentUser.uid,
                            name: userData.name || 'Usuario',
                        },
                        delivered: false,
                        read: false,
                        audioPlayed: false,
                        sentAt: Timestamp.now(),
                    });

                    // Actualizar almacenamiento usado
                    const relationshipRef = doc(db, 'relationships', relationshipId);
                    await updateDoc(relationshipRef, {
                        usedStorage: (usedStorage || 0) + fileSize
                    });

                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({
                        type: 'success',
                        text1: 'Audio enviado',
                    });
                }
            );

        } catch (error) {
            console.error('Error en uploadAudio:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el audio',
            });
        }
    };

    // Función para subir archivo
    const uploadFile = async (fileUri: string, fileName: string, fileSize: number) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Verificar almacenamiento
            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const blob = await uriToBlob(fileUri);
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/files/${fileName}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo archivo:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir el archivo',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        file: downloadURL,
                        fileName: fileName,
                        fileSize: fileSize,
                        text: '',
                        createdAt: Timestamp.now(),
                        user: {
                            _id: currentUser.uid,
                            name: userData.name || 'Usuario',
                        },
                        delivered: false,
                        read: false,
                        sentAt: Timestamp.now(),
                    });

                    // Actualizar almacenamiento usado
                    const relationshipRef = doc(db, 'relationships', relationshipId);
                    await updateDoc(relationshipRef, {
                        usedStorage: (usedStorage || 0) + fileSize
                    });

                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({
                        type: 'success',
                        text1: 'Archivo enviado',
                    });
                }
            );

        } catch (error) {
            console.error('Error en uploadFile:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el archivo',
            });
        }
    };

    // Función para mostrar menú de adjuntos
    const showAttachmentMenu = () => {
        const options = ['Cámara', 'Galería', 'Documento', 'Cancelar'];
        const cancelButtonIndex = 3;

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                title: 'Adjuntar archivo',
            },
            async (buttonIndex) => {
                if (buttonIndex === 0) {
                    // Cámara
                    const permission = await ImagePicker.requestCameraPermissionsAsync();
                    if (permission.granted) {
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                            await uploadImage(result.assets[0].uri);
                        }
                    }
                } else if (buttonIndex === 1) {
                    // Galería
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (permission.granted) {
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                            await uploadImage(result.assets[0].uri);
                        }
                    }
                } else if (buttonIndex === 2) {
                    // Documento
                    const result = await DocumentPicker.getDocumentAsync({
                        type: '*/*',
                        copyToCacheDirectory: true,
                    });

                    if (!result.canceled && result.assets[0]) {
                        const file = result.assets[0];
                        await uploadFile(file.uri, file.name, file.size || 0);
                    }
                }
            }
        );
    };

    // Render de burbujas personalizadas
    const renderBubble = (props: any) => {
        const isOwn = props.currentMessage.user._id === currentUser?.uid;
        const message: ExtendedMessage = props.currentMessage;

        if (message.deleted) {
            return (
                <View style={{
                    padding: 12,
                    marginVertical: 4,
                    marginHorizontal: 8,
                    backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F0F0F0',
                    borderRadius: 12,
                }}>
                    <Text style={{ 
                        color: theme.placeholder, 
                        fontStyle: 'italic',
                        fontSize: 14,
                    }}>
                        🚫 Mensaje eliminado
                    </Text>
                </View>
            );
        }

        // Renderizar mensaje de audio
        if (message.audio) {
            const messageId = message._id.toString();
            const isPlaying = currentlyPlayingId === messageId;
            const progress = audioProgress[messageId] || 0;
            const duration = audioDurations[messageId];
            const isLoading = isLoadingAudio === messageId;

            console.log('🎵 Audio bubble:', {
                messageId: messageId.substring(0, 10),
                isPlaying,
                duration,
                isLoading,
                currentlyPlayingId: currentlyPlayingId?.substring(0, 10)
            });

            return (
                <View style={{
                    marginVertical: 4,
                    marginHorizontal: 8,
                }}>
                    <View style={{
                        backgroundColor: isOwn ? theme.primary : (colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8'),
                        borderRadius: 16,
                        padding: 12,
                        minWidth: 200,
                        maxWidth: 280,
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 8,
                        }}>
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('🔘 Botón audio presionado:', messageId.substring(0, 10));
                                    toggleAudioPlayback(messageId, message.audio!);
                                }}
                                disabled={isLoading}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 22,
                                    backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginRight: 12,
                                }}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color={isOwn ? theme.white : theme.primary} />
                                ) : (
                                    <Ionicons 
                                        name={isPlaying ? 'pause' : 'play'} 
                                        size={22} 
                                        color={isOwn ? theme.white : theme.primary} 
                                    />
                                )}
                            </TouchableOpacity>

                            <View style={{ flex: 1, marginRight: 8 }}>
                                {/* Ondas de audio animadas cuando está reproduciendo */}
                                {isPlaying ? (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        height: 30,
                                        marginBottom: 4,
                                    }}>
                                        <AudioWaveAnimation color={isOwn ? theme.white : theme.primary} />
                                    </View>
                                ) : (
                                    /* Barra de progreso cuando está pausado */
                                    <View style={{
                                        height: 30,
                                        justifyContent: 'center',
                                        marginBottom: 4,
                                    }}>
                                        <View style={{
                                            height: 3,
                                            backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                                            borderRadius: 2,
                                            overflow: 'hidden',
                                        }}>
                                            <View style={{
                                                height: '100%',
                                                width: `${progress * 100}%`,
                                                backgroundColor: isOwn ? theme.white : theme.primary,
                                            }} />
                                        </View>
                                    </View>
                                )}

                                {/* Duración */}
                                <Text style={{
                                    fontSize: 12,
                                    color: isOwn ? theme.white : theme.text,
                                    opacity: 0.8,
                                }}>
                                    {duration ? formatAudioDuration(duration) : '0:00'}
                                </Text>
                            </View>

                            {/* Indicador de no reproducido */}
                            {!isOwn && !message.audioPlayed && (
                                <View style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: theme.primary,
                                    marginLeft: 4,
                                }} />
                            )}
                        </View>

                        {/* Hora y estado */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            marginTop: 4,
                        }}>
                            <Text style={{ 
                                fontSize: 11, 
                                color: isOwn ? theme.white : theme.placeholder,
                                opacity: 0.7,
                            }}>
                                {new Date(message.createdAt).toLocaleTimeString('es-ES', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}
                            </Text>
                            {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                        </View>
                    </View>
                </View>
            );
        }

        // Renderizar mensaje de archivo
        if (message.file) {
            return (
                <View style={{
                    marginVertical: 4,
                    marginHorizontal: 8,
                }}>
                    <View style={{
                        backgroundColor: isOwn ? theme.primary : (colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8'),
                        borderRadius: 16,
                        padding: 12,
                        maxWidth: 280,
                    }}>
                        <TouchableOpacity
                            onPress={() => {
                                setSelectedFile({
                                    uri: message.file!,
                                    name: message.fileName || 'Archivo',
                                    size: message.fileSize,
                                });
                                setFileViewerVisible(true);
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginBottom: 12,
                            }}
                        >
                            <View style={{
                                width: 48,
                                height: 48,
                                borderRadius: 24,
                                backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}>
                                <Ionicons 
                                    name="document-text" 
                                    size={24} 
                                    color={isOwn ? theme.white : theme.primary} 
                                />
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text 
                                    style={{ 
                                        color: isOwn ? theme.white : theme.text,
                                        fontSize: 14,
                                        fontWeight: '500',
                                    }}
                                    numberOfLines={1}
                                >
                                    {message.fileName || 'Archivo'}
                                </Text>
                                {message.fileSize && (
                                    <Text style={{ 
                                        color: isOwn ? theme.white : theme.placeholder,
                                        fontSize: 12,
                                        marginTop: 2,
                                        opacity: 0.7,
                                    }}>
                                        {(message.fileSize / 1024).toFixed(2)} KB
                                    </Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* Hora y estado - CORREGIDO */}
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: isOwn ? 'flex-end' : 'flex-start',
                            alignItems: 'center',
                            marginTop: 8,
                        }}>
                            <Text style={{ 
                                fontSize: 11, 
                                color: isOwn ? theme.white : theme.placeholder,
                                opacity: 0.7,
                            }}>
                                {new Date(message.createdAt).toLocaleTimeString('es-ES', { 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })}
                            </Text>
                            {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                        </View>
                    </View>
                </View>
            );
        }

        // Renderizar burbuja de texto/imagen estándar con hora corregida
        return (
            <Bubble
                {...props}
                wrapperStyle={{
                    left: {
                        backgroundColor: colorScheme === 'dark' ? '#2C2C2E' : '#E8E8E8',
                        marginVertical: 4,
                    },
                    right: {
                        backgroundColor: theme.primary,
                        marginVertical: 4,
                    },
                }}
                textStyle={{
                    left: { color: theme.text },
                    right: { color: theme.white },
                }}
                timeTextStyle={{
                    left: { 
                        color: theme.placeholder,
                        fontSize: 11,
                        marginTop: 4,
                        marginLeft: 0,  // CORREGIDO: eliminar margen izquierdo excesivo
                    },
                    right: { 
                        color: theme.white,
                        fontSize: 11,
                        marginTop: 4,
                    },
                }}
                renderTime={(timeProps) => (
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: isOwn ? 'flex-end' : 'flex-start',
                        marginTop: 4,
                        paddingHorizontal: 8,  // CORREGIDO: padding horizontal consistente
                        paddingBottom: 4,
                    }}>
                        <Text style={{
                            fontSize: 11,
                            color: isOwn ? theme.white : theme.placeholder,
                            opacity: 0.7,
                        }}>
                            {new Date(message.createdAt).toLocaleTimeString('es-ES', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                            })}
                        </Text>
                        {isOwn && <MessageStatus message={message} isOwn={isOwn} />}
                    </View>
                )}
                renderMessageImage={(imageProps) => (
                    <TouchableOpacity
                        onPress={() => {
                            if (imageProps.currentMessage.image) {
                                setSelectedMediaUri(imageProps.currentMessage.image);
                                setImageViewerVisible(true);
                            }
                        }}
                    >
                        <Image
                            source={{ uri: imageProps.currentMessage.image }}
                            style={styles.chatImage}
                        />
                    </TouchableOpacity>
                )}
            />
        );
    };

    // Loading state
    if (loading || planLoading) {
        return (
            <View style={{ 
                flex: 1, 
                backgroundColor: theme.background,
                justifyContent: 'center',
                alignItems: 'center',
            }}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={{ color: theme.text, marginTop: 12 }}>
                    Cargando conversación...
                </Text>
            </View>
        );
    }

    // Sin pareja
    if (!userData?.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={{ 
                    flex: 1, 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    padding: 20,
                }}>
                    <Ionicons name="heart-outline" size={64} color={theme.placeholder} />
                    <Text style={{ 
                        color: theme.text, 
                        fontSize: 18,
                        fontWeight: '600',
                        marginTop: 16,
                        textAlign: 'center',
                    }}>
                        Aún no tienes pareja conectada
                    </Text>
                    <Text style={{ 
                        color: theme.placeholder, 
                        fontSize: 14,
                        marginTop: 8,
                        textAlign: 'center',
                    }}>
                        Conecta con tu pareja para comenzar a chatear
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: theme.background,
                borderBottomWidth: 1,
                borderBottomColor: theme.borderColor,
            }}>
                {/* Botón de regreso */}
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        marginRight: 12,
                        padding: 4,
                    }}
                >
                    <Ionicons name="chevron-back" size={28} color={theme.text} />
                </TouchableOpacity>

                {/* Info de pareja (clickeable) */}
                <TouchableOpacity
                    onPress={() => {
                        setProfilePhotoSize('medium');
                        setShowProfilePhoto(true);
                    }}
                    style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                    }}
                    activeOpacity={0.7}
                >
                    {/* Avatar de la pareja */}
                    {partnerInfo?.photoURL ? (
                        <Image
                            source={{ uri: partnerInfo.photoURL }}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginRight: 12,
                            }}
                        />
                    ) : (
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: theme.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                        }}>
                            <Text style={{
                                color: theme.white,
                                fontSize: 18,
                                fontWeight: '600',
                            }}>
                                {partnerInfo?.name?.charAt(0).toUpperCase() || '❤️'}
                            </Text>
                        </View>
                    )}

                    {/* Nombre e info */}
                    <View style={{ flex: 1 }}>
                        <Text style={{
                            fontSize: 17,
                            fontWeight: '600',
                            color: theme.text,
                        }}>
                            {partnerInfo?.name || 'Pareja'}
                        </Text>
                        {partnerInfo?.isOnline ? (
                            <Text style={{
                                fontSize: 13,
                                color: '#34C759',
                            }}>
                                En línea
                            </Text>
                        ) : partnerInfo?.lastSeen ? (
                            <Text style={{
                                fontSize: 13,
                                color: theme.placeholder,
                            }}>
                                {(() => {
                                    const lastSeenDate = partnerInfo.lastSeen.toDate();
                                    const now = new Date();
                                    const diffMs = now.getTime() - lastSeenDate.getTime();
                                    const diffMins = Math.floor(diffMs / 60000);
                                    const diffHours = Math.floor(diffMs / 3600000);
                                    const diffDays = Math.floor(diffMs / 86400000);

                                    if (diffMins < 1) return 'Hace un momento';
                                    if (diffMins < 60) return `Hace ${diffMins} min`;
                                    if (diffHours < 24) return `Hace ${diffHours}h`;
                                    if (diffDays === 1) return 'Ayer';
                                    return lastSeenDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                                })()}
                            </Text>
                        ) : null}
                    </View>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? -170 : 0}
            >
            <View style={{ flex: 1 }}>
                {/* Indicador de carga durante subida */}
                {isUploading && (
                    <View style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        zIndex: 999,
                        backgroundColor: theme.primary,
                        padding: 8,
                    }}>
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <ActivityIndicator size="small" color={theme.white} />
                            <Text style={{ color: theme.white, fontSize: 14, marginLeft: 8 }}>
                                Subiendo... {uploadProgress.toFixed(0)}%
                            </Text>
                        </View>
                    </View>
                )}

                <GiftedChat
                    messages={messages}
                    onSend={onSend}
                    loadEarlier={hasMoreMessages}
                    onLoadEarlier={handleLoadEarlier}
                    isLoadingEarlier={isLoadingEarlier}
                    user={{
                        _id: currentUser?.uid || '',
                        name: userData?.name || 'Usuario',
                    }}
                    placeholder="Escribe un mensaje..."
                    alwaysShowSend
                    showUserAvatar={false}
                    renderBubble={renderBubble}
                    renderAvatar={null}
                    text={inputText}
                    onInputTextChanged={setInputText}
                    messagesContainerStyle={{
                        backgroundColor: theme.background,
                    }}
                    minInputToolbarHeight={56}
                    bottomOffset={Platform.OS === 'ios' ? -170 : 0}
                    keyboardShouldPersistTaps="handled"
                    renderChatEmpty={() => (
                        <View style={{ 
                            flex: 1, 
                            transform: [{ scaleY: -1 }],
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Ionicons name="chatbubbles-outline" size={64} color={theme.placeholder} />
                            <Text style={{ 
                                color: theme.placeholder, 
                                marginTop: 12,
                                fontSize: 16,
                            }}>
                                No hay mensajes aún
                            </Text>
                            <Text style={{ 
                                color: theme.placeholder, 
                                marginTop: 4,
                                fontSize: 14,
                            }}>
                                Envía el primer mensaje
                            </Text>
                        </View>
                    )}
                    renderInputToolbar={(toolbarProps) => (
                        !isRecording ? (
                            <InputToolbar
                                {...toolbarProps}
                                containerStyle={{
                                    backgroundColor: theme.background,
                                    borderTopColor: theme.borderColor,
                                    borderTopWidth: 1,
                                    paddingVertical: 4,
                                    paddingHorizontal: 8,
                                    minHeight: 48,
                                    marginBottom: 0,
                                }}
                                primaryStyle={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 44,
                                }}
                                renderActions={(actionsProps) => 
                                    !isRecording ? (
                                        <Actions
                                            {...actionsProps}
                                            containerStyle={{ 
                                                width: 44,
                                                height: 44,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                marginLeft: 4,
                                                marginRight: 4,
                                                marginBottom: 0,
                                            }}
                                            icon={() => (
                                                <Ionicons 
                                                    name="add-circle" 
                                                    size={32} 
                                                    color={theme.primary} 
                                                />
                                            )}
                                            onPressActionButton={showAttachmentMenu}
                                        />
                                    ) : null
                                }
                                renderComposer={(composerProps) => (
                                    isRecording ? (
                                        <View style={{
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: theme.inputBackground,
                                            borderRadius: 20,
                                            paddingHorizontal: 12,
                                            marginLeft: 0,
                                            marginTop: 0,
                                            marginBottom: 0,
                                            height: 40,
                                        }}>
                                            <View style={{
                                                width: 8,
                                                height: 8,
                                                borderRadius: 4,
                                                backgroundColor: '#FF5252',
                                                marginRight: 8,
                                            }} />
                                            
                                            <SoundWaveAnimation />
                                            
                                            <Text style={{
                                                color: theme.text,
                                                fontSize: 14,
                                                marginLeft: 12,
                                                fontWeight: '500',
                                            }}>
                                                {formatRecordingTime(recordingDuration)}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Composer
                                            {...composerProps}
                                            textInputStyle={{
                                                backgroundColor: theme.inputBackground,
                                                color: theme.text,
                                                borderRadius: 20,
                                                paddingTop: Platform.OS === 'ios' ? 10 : 8,
                                                paddingBottom: Platform.OS === 'ios' ? 10 : 8,
                                                paddingHorizontal: 12,
                                                marginLeft: 0,
                                                marginTop: 0,
                                                marginBottom: 0,
                                                lineHeight: 20,
                                                maxHeight: 100,
                                            }}
                                            textInputProps={{
                                                multiline: true,
                                                returnKeyType: 'default',
                                                blurOnSubmit: false,
                                            }}
                                        />
                                    )
                                )}
                                renderSend={(sendProps) => (
                                    isRecording ? (
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            marginBottom: 8,
                                            marginLeft: 4,
                                            marginRight: 4,
                                 
                                        }}>
                                            <TouchableOpacity
                                                onPress={cancelRecording}
                                                style={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 20,
                                                    backgroundColor: theme.placeholder + '30',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <Ionicons name="close" size={24} color={theme.text} />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={stopRecording}
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: theme.primary,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                }}
                                            >
                                                <Ionicons name="send" size={20} color={theme.white} />
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        inputText.trim().length > 0 ? (
                                            <Send
                                                {...sendProps}
                                                disabled={!inputText.trim()}
                                                containerStyle={{
                                                    width: 44, 
                                                    height: 44, 
                                                    alignItems: 'center',
                                                    justifyContent: 'center', 
                                                    marginLeft: 4, 
                                                    marginRight: 4, 
                                                    marginBottom: 0,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        backgroundColor: theme.primary,
                                                        borderRadius: 22, 
                                                        width: 44, 
                                                        height: 44,
                                                        justifyContent: 'center', 
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    <Feather name="arrow-up" size={24} color={theme.white} />
                                                </View>
                                            </Send>
                                        ) : (
                                            <TouchableOpacity
                                                onPress={startRecording}
                                                style={{
                                                    width: 44,
                                                    height: 44,
                                                    borderRadius: 22,
                                                    backgroundColor: theme.primary,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginLeft: 4,
                                                    marginRight: 4,
                                                    marginBottom: 0,
                                                }}
                                            >
                                                <Ionicons name="mic" size={24} color={theme.white} />
                                            </TouchableOpacity>
                                        )
                                    )
                                )}
                            />
                        ) : (
                            <InputToolbar
                                {...toolbarProps}
                                containerStyle={{
                                    backgroundColor: theme.background,
                                    borderTopColor: theme.borderColor,
                                    borderTopWidth: 1,
                                    paddingVertical: 4,
                                    paddingHorizontal: 8,
                                    minHeight: 48,
                                    marginBottom: 0,
                                }}
                                primaryStyle={{
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 44,
                                }}
                                renderComposer={(composerProps) => (
                                    <View style={{
                                        flex: 1,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        backgroundColor: theme.inputBackground,
                                        borderRadius: 20,
                                        paddingHorizontal: 12,
                                        marginLeft: 0,
                                        marginTop: 0,
                                        marginBottom: 4,
                                        height: 40,
                                    }}>
                                        <View style={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: 4,
                                            backgroundColor: '#FF5252',
                                            marginRight: 8,
                                        }} />
                                        
                                        <SoundWaveAnimation />
                                        
                                        <Text style={{
                                            color: theme.text,
                                            fontSize: 14,
                                            marginLeft: 12,
                                            fontWeight: '500',
                                        }}>
                                            {formatRecordingTime(recordingDuration)}
                                        </Text>
                                    </View>
                                )}
                                renderSend={(sendProps) => (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        marginBottom: 0,
                                        marginLeft: 4,
                                        marginRight: 4,
                                    
                                    }}>
                                        <TouchableOpacity
                                            onPress={cancelRecording}
                                            style={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: 20,
                                                backgroundColor: theme.placeholder + '30',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Ionicons name="close" size={24} color={theme.text} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={stopRecording}
                                            style={{
                                                width: 44,
                                                height: 44,
                                                borderRadius: 22,
                                                backgroundColor: theme.primary,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <Ionicons name="send" size={20} color={theme.white} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            />
                        )
                    )}
                />

            {/* Profile Photo Modal */}
            <ProfilePhotoModal
                visible={showProfilePhoto}
                photoURL={partnerInfo?.photoURL}
                name={partnerInfo?.name || 'Pareja'}
                size={profilePhotoSize}
                onClose={() => setShowProfilePhoto(false)}
                onExpand={() => setProfilePhotoSize('full')}
            />

            {/* Image Viewer Modal */}
            <ImageViewerModal
                visible={imageViewerVisible}
                imageUri={selectedMediaUri}
                onClose={() => setImageViewerVisible(false)}
            />

            {/* Video Viewer Modal */}
            <VideoViewerModal
                visible={videoViewerVisible}
                videoUri={selectedMediaUri}
                onClose={() => setVideoViewerVisible(false)}
            />

            {/* File Viewer Modal */}
            {selectedFile && (
                <FileViewerModal
                    visible={fileViewerVisible}
                    fileUri={selectedFile.uri}
                    fileName={selectedFile.name}
                    fileSize={selectedFile.size}
                    onClose={() => {
                        setFileViewerVisible(false);
                        setSelectedFile(null);
                    }}
                />
            )}

            {/* Upgrade Modal */}
            <UpgradeModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                usedStorage={usedStorage}
                maxStorage={maxStorage}
            />

            {/* Toast Container */}
            <Toast />
            </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

// Estilos
const styles = StyleSheet.create({
    chatImage: {
        width: 250,
        height: 150,
        borderRadius: 13,
        margin: 3,
        resizeMode: 'cover',
    }
});

// Exportar envuelto en ActionSheetProvider
const ChatScreenWithActions = () => {
    return (
        <ActionSheetProvider>
            <ChatScreen />
        </ActionSheetProvider>
    );
};

export default ChatScreenWithActions;