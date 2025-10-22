import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, FlatList, Button,
    ActivityIndicator, Image, TouchableOpacity, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../src/config/firebaseConfig'; // Importamos storage
import { themes } from '../../src/config/theme';
import { doc, DocumentData, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { v4 as uuidv4 } from 'uuid'; // Para nombres de archivo únicos
import Toast from 'react-native-toast-message';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    // Estilos para la galería
    photoItem: {
        flex: 1,
        maxWidth: '50%', // 2 columnas
        aspectRatio: 1, // Cuadrado
        padding: 3,
    },
    photo: {
        flex: 1,
        borderRadius: 8,
    }
});

// --- Función Helper MEJORADA para convertir URI en Blob ---
// (Usa XMLHttpRequest para ser compatible con iOS y Android)
const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
            resolve(xhr.response); // Resuelve con el blob
        };
        xhr.onerror = function (e) {
            console.error("uriToBlob falló:", e);
            reject(new TypeError("Network request failed"));
        };
        xhr.responseType = 'blob'; // Pide la respuesta como un blob
        xhr.open('GET', uri, true); // Abre la conexión a la URI local
        xhr.send(null); // Envía la petición
    });
};

const AlbumScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [photos, setPhotos] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false); // Estado para el loader de subida

    // 1. useEffect: Maneja estado de autenticación
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

    // 2. useEffect: Carga perfil Y fotos
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

    // --- 3. NUEVA LÓGICA PARA SUBIR FOTOS ---
    const handleAddPhoto = async () => {
        if (!user || !userData || !userData.partnerId) return;

        // 1. Pedir permisos
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Necesitamos permiso para acceder a tus fotos.");
            return;
        }

        // 2. Abrir galería
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Forzar fotos cuadradas
            quality: 0.8, // Calidad inicial
        });

        if (result.canceled || !result.assets) {
            return; // El usuario canceló
        }

        setIsUploading(true);
        const uri = result.assets[0].uri;

        try {
            // 3. Comprimir y redimensionar la imagen
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 800 } }], // Redimensionar a un ancho máximo de 800px
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            // 4. Preparar subida
            const blob = await uriToBlob(manipResult.uri);
            const chatId = [user.uid, userData.partnerId].sort().join('_');
            const fileName = `${uuidv4()}.jpg`;
            const storageRef = ref(storage, `albums/${chatId}/${fileName}`);
            
            // 5. Subir a Firebase Storage
            const uploadTask = uploadBytesResumable(storageRef, blob);
            
            uploadTask.on('state_changed', 
                (snapshot) => { /* Opcional: manejar progreso de subida */ },
                (error) => {
                    console.error("Error al subir imagen:", error);
                    Toast.show({ type: 'error', text1: 'Error al subir la imagen' });
                    setIsUploading(false);
                },
                async () => {
                    // 6. Subida completa, obtener URL
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // 7. Guardar URL en Firestore
                    const photosCollectionRef = collection(db, 'relationships', chatId, 'photos');
                    await addDoc(photosCollectionRef, {
                        imageUrl: downloadURL,
                        createdAt: serverTimestamp(),
                        authorId: user.uid,
                        title: "", // Dejamos título/descripción para más adelante
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
    };

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

                <Button title="Añadir Foto" onPress={handleAddPhoto} color={theme.primary} disabled={isUploading} />
                {isUploading && <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 10 }} />}

                {/* --- Galería de Fotos --- */}
                <FlatList
                    data={photos}
                    keyExtractor={(item) => item.id}
                    numColumns={2} // Muestra en cuadrícula de 2 columnas
                    style={{marginTop: 20}}
                    renderItem={({ item }) => (
                        <View style={styles.photoItem}>
                            <Image source={{ uri: item.imageUrl }} style={styles.photo} />
                            {/* Aquí añadiremos títulos, etc. más adelante */}
                        </View>
                    )}
                    ListEmptyComponent={
                        <Text style={styles.placeholderText}>Aún no han añadido fotos a su álbum.</Text>
                    }
                />
            </View>
        </SafeAreaView>
    );
};

export default AlbumScreen;