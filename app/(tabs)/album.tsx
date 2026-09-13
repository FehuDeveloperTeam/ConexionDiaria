// Sprint 7.6b — re-skin de Álbum según el sistema de diseño: grid de 3
// columnas agrupado por mes, celdas de subida/fallo, y visor full-screen
// con navegación por miniaturas y acciones (descargar/compartir/borrar).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, ScrollView, useWindowDimensions,
    ActivityIndicator, Image, TouchableOpacity, Alert,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db, storage } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import { DocumentData, onSnapshot, collection, query, orderBy, limit, addDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { EmptyState } from '../../src/components/EmptyState';
import { ConfirmDestructiveModal } from '../../src/components/ConfirmDestructiveModal';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { useResponsive, CONTENT_MAX_WIDTH } from '../../src/hooks/useResponsive';
import { useRouter } from 'expo-router';

const GRID_GAP = 6;
const GRID_COLUMNS = 2;

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

interface UploadItem {
    localId: string;
    uri: string;
    progress: number;
    status: 'uploading' | 'failed';
}

const monthKeyOf = (date: Date) =>
    date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();

const AlbumScreen: React.FC = () => {
    const { theme, isDarkMode: isDark, fontFamilies } = useTheme();
    const { isDesktop } = useResponsive();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const router = useRouter();

    // El grid vive dentro de <DesktopContentWrap>, que en escritorio limita
    // el ancho a CONTENT_MAX_WIDTH — antes esto se calculaba con el ancho
    // completo de la ventana, así que en escritorio las celdas quedaban
    // enormes y el grid de 3 columnas terminaba viéndose como una sola
    // columna apilada (regresión de 7.6b al envolver Álbum en 8.3).
    const containerWidth = isDesktop ? Math.min(windowWidth, CONTENT_MAX_WIDTH) : windowWidth;
    const CELL_SIZE = (containerWidth - spacing.s22 * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

    const { user, userData } = usePlan();
    const [photos, setPhotos] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);

    const [viewerIndex, setViewerIndex] = useState<number | null>(null);
    const [deletingPhoto, setDeletingPhoto] = useState<DocumentData | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const partnerId = userData?.partnerId as string | undefined;

    useEffect(() => {
        if (!user || !partnerId) {
            setPhotos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const chatId = [user.uid, partnerId].sort().join('_');
        const photosCollectionRef = collection(db, 'relationships', chatId, 'photos');
        const q = query(photosCollectionRef, orderBy('createdAt', 'desc'), limit(150));

        const unsubscribePhotos = onSnapshot(q, (snapshot) => {
            setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => { console.error("Error fetching photos:", error); setLoading(false); });

        return () => unsubscribePhotos();
    }, [user, partnerId]);

    const uploadPickedImage = useCallback(async (localId: string, uri: string) => {
        if (!user || !userData?.partnerId) return;

        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            const blob = await uriToBlob(manipResult.uri);
            const chatId = [user.uid, userData.partnerId].sort().join('_');
            const fileName = `${Crypto.randomUUID()}.jpg`;
            const storageRef = ref(storage, `albums/${chatId}/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadItems(prev => prev.map(it => it.localId === localId ? { ...it, progress } : it));
                },
                (error) => {
                    console.error("Error al subir imagen:", error);
                    setUploadItems(prev => prev.map(it => it.localId === localId ? { ...it, status: 'failed' } : it));
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const photosCollectionRef = collection(db, 'relationships', chatId, 'photos');
                    await addDoc(photosCollectionRef, {
                        imageUrl: downloadURL,
                        createdAt: serverTimestamp(),
                        authorId: user.uid,
                        title: "",
                        description: "",
                    });
                    setUploadItems(prev => prev.filter(it => it.localId !== localId));
                    Toast.show({ type: 'success', text1: '¡Foto añadida!' });
                }
            );
        } catch (error) {
            console.error("Error procesando imagen:", error);
            setUploadItems(prev => prev.map(it => it.localId === localId ? { ...it, status: 'failed' } : it));
        }
    }, [user, userData]);

    const handleAddPhoto = useCallback(async () => {
        if (!user || !userData || !userData.partnerId) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Necesitamos permiso para acceder a tus fotos.");
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled || !result.assets) return;

        const localId = Crypto.randomUUID();
        const uri = result.assets[0].uri;
        setUploadItems(prev => [{ localId, uri, progress: 0, status: 'uploading' }, ...prev]);
        uploadPickedImage(localId, uri);
    }, [user, userData, uploadPickedImage]);

    const handleRetryUpload = (item: UploadItem) => {
        setUploadItems(prev => prev.map(it => it.localId === item.localId ? { ...it, status: 'uploading', progress: 0 } : it));
        uploadPickedImage(item.localId, item.uri);
    };

    const confirmDeletePhoto = async () => {
        if (!deletingPhoto || !user || !userData?.partnerId) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        try {
            await deleteDoc(doc(db, 'relationships', chatId, 'photos', deletingPhoto.id));
            await deleteObject(ref(storage, deletingPhoto.imageUrl));
            setDeletingPhoto(null);
            setViewerIndex(null);
            Toast.show({ type: 'success', text1: 'Foto eliminada' });
        } catch (error) {
            console.error("Error eliminando foto:", error);
            Toast.show({ type: 'error', text1: 'Error al eliminar la foto' });
        }
    };

    const handleDownload = async (photo: DocumentData) => {
        try {
            setIsDownloading(true);
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status !== 'granted') {
                Toast.show({ type: 'error', text1: 'Permiso denegado', text2: 'Necesitamos acceso a tu galería' });
                setIsDownloading(false);
                return;
            }
            const filename = photo.imageUrl.split('/').pop()?.split('?')[0] || `foto_${Date.now()}.jpg`;
            const fileUri = `${(FileSystem as any).cacheDirectory}${filename}`;
            const downloadResult = await (FileSystem as any).downloadAsync(photo.imageUrl, fileUri);
            await MediaLibrary.createAssetAsync(downloadResult.uri);
            Toast.show({ type: 'success', text1: 'Foto guardada en tu galería' });
        } catch (error) {
            console.error('Error descargando foto:', error);
            Toast.show({ type: 'error', text1: 'No se pudo descargar la foto' });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShare = async (photo: DocumentData) => {
        try {
            setIsSharing(true);
            const filename = photo.imageUrl.split('/').pop()?.split('?')[0] || `foto_${Date.now()}.jpg`;
            const fileUri = `${(FileSystem as any).cacheDirectory}${filename}`;
            const { uri } = await (FileSystem as any).downloadAsync(photo.imageUrl, fileUri);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
            } else {
                Toast.show({ type: 'error', text1: 'Compartir no disponible en este dispositivo' });
            }
        } catch (error) {
            console.error('Error compartiendo foto:', error);
            Toast.show({ type: 'error', text1: 'No se pudo compartir la foto' });
        } finally {
            setIsSharing(false);
        }
    };

    // Agrupar por mes, con las subidas en curso ancladas al mes actual.
    const monthGroups = useMemo(() => {
        type Cell = { kind: 'photo'; photo: DocumentData } | { kind: 'pending'; item: UploadItem };
        const groups: { month: string; cells: Cell[] }[] = [];
        const indexByMonth = new Map<string, number>();

        photos.forEach(photo => {
            const date = photo.createdAt?.toDate ? photo.createdAt.toDate() : new Date();
            const key = monthKeyOf(date);
            let idx = indexByMonth.get(key);
            if (idx === undefined) {
                idx = groups.length;
                groups.push({ month: key, cells: [] });
                indexByMonth.set(key, idx);
            }
            groups[idx].cells.push({ kind: 'photo', photo });
        });

        if (uploadItems.length > 0) {
            const currentKey = monthKeyOf(new Date());
            const pendingCells: Cell[] = uploadItems.map(item => ({ kind: 'pending', item }));
            const idx = indexByMonth.get(currentKey);
            if (idx !== undefined) {
                groups[idx].cells = [...pendingCells, ...groups[idx].cells];
            } else {
                groups.unshift({ month: currentKey, cells: pendingCells });
            }
        }

        return groups;
    }, [photos, uploadItems]);

    // --- Renderizado ---
    if (loading) {
        return <FullScreenLoader />;
    }
    if (userData && !userData.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
                <EmptyState
                    icon="images-outline"
                    title="Aún no hay recuerdos"
                    message="Conéctate con tu pareja para crear su álbum compartido."
                    onConnectPress={() => router.push('/(tabs)/home')}
                />
            </SafeAreaView>
        );
    }
    if (!user || !userData) {
        return <FullScreenLoader />;
    }

    const currentPhoto = viewerIndex !== null ? photos[viewerIndex] : null;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <View style={{ paddingHorizontal: spacing.s22, paddingTop: spacing.s16, paddingBottom: spacing.s10 }}>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.text }}>Álbum</Text>
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.textMuted, marginTop: spacing.s4 }}>
                    {photos.length} fotos
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.s22, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
                {monthGroups.length === 0 && (
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textFaint, textAlign: 'center', marginTop: spacing.s26 }}>
                        Aún no han añadido fotos a su álbum.
                    </Text>
                )}

                {monthGroups.map(group => (
                    <View key={group.month} style={{ marginBottom: spacing.s16 }}>
                        <Text style={{
                            fontFamily: fontFamilies.bodyBold,
                            fontSize: 11,
                            letterSpacing: 0.9,
                            color: theme.textFaint,
                            marginBottom: spacing.s10,
                        }}>
                            {group.month}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                            {group.cells.map(cell => {
                                if (cell.kind === 'pending') {
                                    const { item } = cell;
                                    if (item.status === 'failed') {
                                        return (
                                            <TouchableOpacity
                                                key={item.localId}
                                                onPress={() => handleRetryUpload(item)}
                                                style={{
                                                    width: CELL_SIZE,
                                                    height: CELL_SIZE,
                                                    borderRadius: 12,
                                                    borderWidth: 1,
                                                    borderStyle: 'dashed',
                                                    borderColor: theme.borderStrong,
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 3,
                                                    padding: 4,
                                                }}
                                            >
                                                <Ionicons name="image-outline" size={22} color={theme.textFaint} />
                                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 8.5, color: theme.textFaint, textAlign: 'center' }}>
                                                    No se pudo cargar
                                                </Text>
                                                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 8.5, color: theme.primary }}>
                                                    Reintentar
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    }
                                    return (
                                        <View
                                            key={item.localId}
                                            style={{
                                                width: CELL_SIZE,
                                                height: CELL_SIZE,
                                                borderRadius: 12,
                                                backgroundColor: theme.surfaceAlt,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: spacing.s6,
                                            }}
                                        >
                                            <ActivityIndicator size="small" color={theme.primary} />
                                            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10, color: theme.primary }}>
                                                {Math.round(item.progress)}%
                                            </Text>
                                        </View>
                                    );
                                }

                                const { photo } = cell;
                                const flatIndex = photos.findIndex(p => p.id === photo.id);
                                return (
                                    <TouchableOpacity
                                        key={photo.id}
                                        onPress={() => setViewerIndex(flatIndex)}
                                        style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 12, overflow: 'hidden' }}
                                    >
                                        <Image source={{ uri: photo.imageUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* CTA Agregar — en escritorio no hay tab bar que despejar abajo */}
            <TouchableOpacity
                onPress={handleAddPhoto}
                style={{
                    position: 'absolute',
                    right: 20,
                    bottom: isDesktop ? 24 : 118,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.s8,
                    paddingHorizontal: spacing.s18,
                    paddingVertical: spacing.s14,
                    borderRadius: radii.pill,
                    backgroundColor: theme.primary,
                    ...(isDark ? { borderWidth: 1, borderColor: theme.border } : {
                        shadowColor: '#6A5ACD', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.36, shadowRadius: 26, elevation: 12,
                    }),
                }}
            >
                <Ionicons name="image" size={20} color={theme.white} />
                <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 15, color: theme.white }}>Agregar</Text>
            </TouchableOpacity>
            </DesktopContentWrap>

            {/* Visor full-screen */}
            <Modal visible={viewerIndex !== null} transparent animationType="fade" onRequestClose={() => setViewerIndex(null)}>
                <View style={{ flex: 1, backgroundColor: '#08080A' }}>
                    {currentPhoto && (
                        <>
                            <SafeAreaView edges={['top']} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s10 }}>
                                <TouchableOpacity onPress={() => setViewerIndex(null)} style={{ padding: spacing.s8 }}>
                                    <Ionicons name="close" size={26} color="#FFFFFF" />
                                </TouchableOpacity>
                                <Text style={{ flex: 1, textAlign: 'center', fontFamily: fontFamilies.bodySemiBold, fontSize: 12.5, color: '#FFFFFF' }}>
                                    {(currentPhoto.createdAt?.toDate ? currentPhoto.createdAt.toDate() : new Date())
                                        .toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <View style={{ width: 42, alignItems: 'flex-end' }}>
                                    {currentPhoto.authorId === user.uid && (
                                        <TouchableOpacity onPress={() => setDeletingPhoto(currentPhoto)} style={{ padding: spacing.s8 }}>
                                            <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </SafeAreaView>

                            <View style={{ flex: 1, justifyContent: 'center' }}>
                                <ScrollView
                                    style={{ flex: 1 }}
                                    contentContainerStyle={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                                    maximumZoomScale={3}
                                    minimumZoomScale={1}
                                    centerContent
                                >
                                    {/* Antes esto forzaba una caja cuadrada de lado = ancho de
                                        ventana (mismo valor en width Y height) — en pantallas más
                                        anchas que altas esa caja no cabía verticalmente y el visor
                                        se veía negro, con la foto recortada fuera de vista. */}
                                    <Image
                                        source={{ uri: currentPhoto.imageUrl }}
                                        style={{ width: windowWidth * 0.92, height: windowHeight * 0.62, resizeMode: 'contain' }}
                                    />
                                </ScrollView>

                                {viewerIndex! > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setViewerIndex(viewerIndex! - 1)}
                                        style={{
                                            position: 'absolute', left: spacing.s16, top: '50%', marginTop: -19,
                                            width: 38, height: 38, borderRadius: 19,
                                            backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                                    </TouchableOpacity>
                                )}
                                {viewerIndex! < photos.length - 1 && (
                                    <TouchableOpacity
                                        onPress={() => setViewerIndex(viewerIndex! + 1)}
                                        style={{
                                            position: 'absolute', right: spacing.s16, top: '50%', marginTop: -19,
                                            width: 38, height: 38, borderRadius: 19,
                                            backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center',
                                        }}
                                    >
                                        <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Tira de miniaturas */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: spacing.s8, paddingHorizontal: spacing.s16, paddingVertical: spacing.s10 }}
                            >
                                {photos.map((photo, idx) => (
                                    <TouchableOpacity key={photo.id} onPress={() => setViewerIndex(idx)}>
                                        <Image
                                            source={{ uri: photo.imageUrl }}
                                            style={{
                                                width: 38,
                                                height: 38,
                                                borderRadius: 8,
                                                opacity: idx === viewerIndex ? 1 : 0.5,
                                                borderWidth: idx === viewerIndex ? 2 : 0,
                                                borderColor: theme.primary,
                                            }}
                                        />
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            {/* Acciones */}
                            <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: spacing.s12 }}>
                                <TouchableOpacity onPress={() => Toast.show({ type: 'info', text1: 'Pellizca la imagen para hacer zoom' })}>
                                    <Ionicons name="search" size={23} color="#FFFFFF" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDownload(currentPhoto)} disabled={isDownloading}>
                                    {isDownloading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="download-outline" size={23} color="#FFFFFF" />}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleShare(currentPhoto)} disabled={isSharing}>
                                    {isSharing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="share-outline" size={23} color="#FFFFFF" />}
                                </TouchableOpacity>
                                {currentPhoto.authorId === user.uid && (
                                    <TouchableOpacity onPress={() => setDeletingPhoto(currentPhoto)}>
                                        <Ionicons name="trash-outline" size={23} color={theme.danger} />
                                    </TouchableOpacity>
                                )}
                            </SafeAreaView>
                        </>
                    )}
                </View>
            </Modal>

            <ConfirmDestructiveModal
                visible={!!deletingPhoto}
                title="Eliminar foto"
                message="Se borrará para los dos y no se puede deshacer."
                onConfirm={confirmDeletePhoto}
                onCancel={() => setDeletingPhoto(null)}
            />
        </SafeAreaView>
    );
};

export default AlbumScreen;
