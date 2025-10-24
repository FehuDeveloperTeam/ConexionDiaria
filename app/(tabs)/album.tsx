import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, FlatList, Button,
    ActivityIndicator, Image, TouchableOpacity, Alert,
    Modal // 1. Importamos Modal
} from 'react-native';
// 2. Importamos useSafeAreaInsets
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { doc, DocumentData, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons'; // 3. Importamos Ionicons

// --- Función Helper para Blob (Asumo que la tienes o la necesitas) ---
// (Esta función es necesaria para que la subida funcione en iOS/Android)
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

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    photoItem: {
        flex: 1,
        maxWidth: '50%',
        aspectRatio: 1,
        padding: 3,
    },
    photo: {
        flex: 1,
        borderRadius: 8,
        backgroundColor: theme.placeholder,
    },
    // --- 4. NUEVOS ESTILOS PARA EL MODAL ---
    modalFullScreen: {
        flex: 1,
        backgroundColor: '#000', // Fondo negro
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain', // Asegura que se vea la foto completa
    },
    closeButton: {
        position: 'absolute',
        zIndex: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Fondo semi-transparente
        borderRadius: 20,
        padding: 5,
    }
});

const AlbumScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();
    const insets = useSafeAreaInsets(); // 5. Hook para los márgenes seguros

    // --- 6. NUEVOS ESTADOS PARA EL MODAL ---
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

    // (El resto de tus estados permanecen igual)
    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [photos, setPhotos] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // --- Lógica de Listeners (Sin Cambios) ---
    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null); setPhotos([]); setLoading(false);
                router.replace('/login');
            }
        });
        return () => unsubscribeAuth();
    }, [router]);

    useEffect(() => {
        if (!user) return;
        let unsubscribeUser: () => void = () => {};
        let unsubscribePhotos: () => void = () => {};
        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            unsubscribePhotos();
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                if (data.partnerId) {
                    const chatId = [user.uid, data.partnerId].sort().join('_');
                    const photosCollectionRef = collection(db, 'relationships', chatId, 'photos');
                    const q = query(photosCollectionRef, orderBy('createdAt', 'desc'));
                    unsubscribePhotos = onSnapshot(q, (snapshot) => {
                        setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        setLoading(false);
                    }, (error) => { console.error("Error fetching photos:", error); setLoading(false); });
                } else {
                    setPhotos([]); setLoading(false);
                }
            } else {
                auth.signOut(); setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });
        return () => { unsubscribeUser(); unsubscribePhotos(); };
    }, [user]);

    // --- Lógica de Subida (Sin Cambios) ---
    const handleAddPhoto = useCallback(async () => {
        if (!user || !userData || !userData.partnerId) return;
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Necesitamos permiso para acceder a tus fotos.");
            return;
        }
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled || !result.assets) return;
        setIsUploading(true);
        const uri = result.assets[0].uri;
        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );
            const blob = await uriToBlob(manipResult.uri); // Usa la función helper
            const chatId = [user.uid, userData.partnerId].sort().join('_');
            const fileName = `${Crypto.randomUUID()}.jpg`;
            const storageRef = ref(storage, `albums/${chatId}/${fileName}`);
            const uploadTask = uploadBytesResumable(storageRef, blob);
            uploadTask.on('state_changed',
                (snapshot) => { /* Progress */ },
                (error) => {
                    console.error("Error al subir imagen:", error);
                    Toast.show({ type: 'error', text1: 'Error al subir la imagen' });
                    setIsUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const photosCollectionRef = collection(db, 'relationships', chatId, 'photos');
                    await addDoc(photosCollectionRef, {
                        imageUrl: downloadURL,
                        createdAt: serverTimestamp(),
                        authorId: user.uid,
                        title: "", // Placeholder
                        description: "",
                    });
                    setIsUploading(false);
                    Toast.show({ type: 'success', text1: '¡Foto añadida!' });
                }
            );
        } catch (error) {
            console.error("Error procesando imagen:", error);
            Toast.show({ type: 'error', text1: 'Error al procesar la imagen' });
            setIsUploading(false);
        }
    }, [user, userData]);

    // --- 7. NUEVAS FUNCIONES PARA EL MODAL ---
    const openPhotoModal = (imageUrl: string) => {
        setSelectedPhotoUrl(imageUrl);
        setIsModalVisible(true);
    };

    const closePhotoModal = () => {
        setIsModalVisible(false);
        setSelectedPhotoUrl(null); // Limpiar la URL al cerrar
    };

    // --- Renderizado (con estados de carga y no conectado) ---
    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }
    if (userData && !userData.partnerId) {
        return (
             <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                     <Text style={styles.title}>Álbum de Recuerdos</Text>
                     <Text style={styles.placeholderText}>Conéctate con tu pareja para crear su álbum compartido.</Text>
                </View>
             </SafeAreaView>
        );
    }
     if (!user || !userData) {
         return <View style={styles.loadingContainer}><Text style={{color: theme.placeholder}}>Cargando...</Text></View>;
     }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Álbum de Recuerdos</Text>
                <Button 
                    title={isUploading ? "Subiendo..." : "Añadir Foto"} 
                    onPress={handleAddPhoto} 
                    color={theme.primary} 
                    disabled={isUploading} 
                />
                {isUploading && (
                    <ActivityIndicator 
                        size="small" 
                        color={theme.primary} 
                        style={{ marginVertical: 10 }} 
                    />
                )}
                <FlatList
                    data={photos}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    style={{marginTop: 20}}
                    renderItem={({ item }) => (
                        // --- 8. IMAGEN AHORA CLICKEABLE ---
                        <TouchableOpacity
                            style={styles.photoItem}
                            onPress={() => openPhotoModal(item.imageUrl)}
                        >
                            <Image 
                                source={{ uri: item.imageUrl }} 
                                style={styles.photo}
                                resizeMode="cover"
                            />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.placeholderText}>
                            Aún no han añadido fotos a su álbum.
                        </Text>
                    }
                />
            </View>
            
            {/* --- 9. MODAL PARA VER LA FOTO --- */}
            <Modal
                animationType="fade"
                transparent={false}
                visible={isModalVisible}
                onRequestClose={closePhotoModal}
            >
                <View style={styles.modalFullScreen}>
                    {/* Botón de cierre posicionado con 'insets' */}
                    <TouchableOpacity
                        // Posiciona respetando el notch/barra de estado y bordes
                        style={[styles.closeButton, { top: insets.top + 10, left: insets.left + 15 }]}
                        onPress={closePhotoModal}
                    >
                        <Ionicons name="arrow-back-outline" size={30} color="#fff" />
                    </TouchableOpacity>
                    
                    <Image 
                        source={{ uri: selectedPhotoUrl || undefined }} 
                        style={styles.modalImage} 
                    />
                </View>
            </Modal>
            
            {/* Eliminamos el <Toast /> duplicado de aquí, ya está en el _layout.tsx raíz */}
        </SafeAreaView>
    );
};

export default AlbumScreen;