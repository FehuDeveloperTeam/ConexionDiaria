import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    Alert, Image, TouchableOpacity, TextInput, Button, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, DocumentData, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

// --- Función Helper para Blob (La misma de album.tsx y chat.tsx) ---
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

// --- Estilos ---
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 20, alignItems: 'center' },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 30 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    
    // Avatar
    avatarContainer: {
        marginBottom: 20,
        alignItems: 'center',
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: theme.placeholder,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.primary,
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: theme.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: theme.primary,
    },
    avatarPlaceholderText: {
        color: theme.primary,
        fontSize: 48,
        fontWeight: 'bold',
    },
    avatarLoadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 60,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEditText: {
        color: theme.link,
        marginTop: 10,
        fontSize: 14,
    },
    
    // Input de Nombre
    inputGroup: {
        width: '100%',
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 16,
        color: theme.placeholder,
        marginBottom: 8,
        marginLeft: 5,
    },
    input: {
        height: 50,
        width: '100%',
        borderColor: theme.borderColor,
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 15,
        fontSize: 16,
        color: theme.text,
        backgroundColor: theme.inputBackground,
    },
    buttonSpacer: {
        height: 10,
    },

    // Sección de Peligro
    dangerZone: {
        width: '100%',
        marginTop: 40,
        borderColor: '#FF453A', // Rojo peligro
        borderWidth: 1,
        borderRadius: 10,
        padding: 15,
    },
    dangerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FF453A',
        textAlign: 'center',
        marginBottom: 15,
    },
    
    // Logout
    logoutButton: {
        width: '100%',
        marginTop: 'auto', // Empuja al fondo
        paddingTop: 20,
    }
});

const ConfigScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [loading, setLoading] = useState(true);

    // Estados para edición
    const [displayName, setDisplayName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // --- Carga de Autenticación y Perfil ---
    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null); setLoading(false);
                router.replace('/login');
            }
        });
        return () => unsubscribeAuth();
    }, [router]);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                setDisplayName(data.displayName || ''); // Cargar nombre
                setLoading(false);
            } else {
                auth.signOut(); setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });
        return () => unsubscribeUser();
    }, [user]);

    // --- Función para cambiar el Avatar ---
    const handlePickAvatar = useCallback(async () => {
        if (!user) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Se necesita acceso a la galería.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1], // Foto de perfil cuadrada
            quality: 0.7,
        });

        if (result.canceled || !result.assets) return;
        
        setIsUploading(true);
        const uri = result.assets[0].uri;

        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 400 } }], // Redimensionar a 400x400
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );

            const blob = await uriToBlob(manipResult.uri);
            const fileName = `${user.uid}_${Crypto.randomUUID()}.jpg`;
            const storageRef = ref(storage, `avatars/${user.uid}/${fileName}`);
            
            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on('state_changed', null, 
                (error) => {
                    console.error("Error al subir avatar:", error);
                    setIsUploading(false);
                    Toast.show({ type: 'error', text1: 'Error al subir la imagen' });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    
                    // Guardar URL en el perfil del usuario
                    const userDocRef = doc(db, 'users', user.uid);
                    await updateDoc(userDocRef, {
                        photoURL: downloadURL
                    });
                    
                    setIsUploading(false);
                    Toast.show({ type: 'success', text1: '¡Foto de perfil actualizada!' });
                }
            );

        } catch (error) {
            console.error("Error procesando imagen:", error);
            setIsUploading(false);
            Toast.show({ type: 'error', text1: 'Error al procesar la imagen' });
        }
    }, [user]);

    // --- Función para guardar el Nombre ---
    const handleSaveDisplayName = useCallback(async () => {
        if (!user || !displayName.trim()) {
            Toast.show({ type: 'error', text1: 'El nombre no puede estar vacío' });
            return;
        }

        setIsSaving(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, {
                displayName: displayName.trim()
            });
            Toast.show({ type: 'success', text1: 'Nombre actualizado' });
        } catch (error) {
            console.error("Error al guardar nombre:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar' });
        }
        setIsSaving(false);
    }, [user, displayName]);

    // --- Función para Desconectar de la Pareja ---
    const handleDisconnect = useCallback(async () => {
        if (!user || !userData || !userData.partnerId) return;

        Alert.alert(
            "¿Desconectar?",
            "¿Estás seguro de que quieres desconectarte de tu pareja? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Sí, desconectar", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const batch = writeBatch(db);
                            const userDocRef = doc(db, 'users', user.uid);
                            const partnerDocRef = doc(db, 'users', userData.partnerId);

                            // Borrar el ID de ambos
                            batch.update(userDocRef, { partnerId: null });
                            batch.update(partnerDocRef, { partnerId: null });
                            // Opcional: Podrías borrar también el doc de 'relationships'
                            
                            await batch.commit();
                            Toast.show({ type: 'success', text1: 'Desconectado correctamente' });
                            // La app reaccionará sola gracias al listener de 'userData'
                        } catch (error) {
                            console.error("Error al desconectar:", error);
                            Toast.show({ type: 'error', text1: 'Error al desconectar' });
                        }
                    }
                }
            ]
        );
    }, [user, userData]);

    // --- Función para Cerrar Sesión ---
    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
            // El listener de onAuthStateChanged se encargará de redirigir
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            Toast.show({ type: 'error', text1: 'Error al cerrar sesión' });
        }
    }, []);

    // --- Renderizado ---
    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>Ajustes</Text>

                    {/* --- Sección de Avatar --- */}
                    <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} disabled={isUploading}>
                        {userData?.photoURL ? (
                            <Image source={{ uri: userData.photoURL }} style={styles.avatar} />
                        ) : (
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarPlaceholderText}>
                                    {userData?.displayName?.[0]?.toUpperCase() || 'U'}
                                </Text>
                            </View>
                        )}
                        
                        {isUploading && (
                            <View style={styles.avatarLoadingOverlay}>
                                <ActivityIndicator size="large" color="#fff" />
                            </View>
                        )}
                        <Text style={styles.avatarEditText}>Toca para cambiar</Text>
                    </TouchableOpacity>

                    {/* --- Sección de Nombre --- */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Tu nombre</Text>
                        <TextInput
                            style={styles.input}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Tu nombre de pila"
                            placeholderTextColor={theme.placeholder}
                            maxLength={20}
                        />
                        <View style={styles.buttonSpacer} />
                        <Button
                            title={isSaving ? "Guardando..." : "Guardar Nombre"}
                            onPress={handleSaveDisplayName}
                            color={theme.primary}
                            disabled={isSaving || displayName === userData?.displayName}
                        />
                    </View>
                    
                    {/* --- Zona de Peligro --- */}
                    {userData?.partnerId && (
                        <View style={styles.dangerZone}>
                            <Text style={styles.dangerTitle}>Zona de Peligro</Text>
                            <Button
                                title="Desconectar de mi pareja"
                                onPress={handleDisconnect}
                                color="#FF453A" // Rojo
                            />
                        </View>
                    )}

                    {/* --- Cerrar Sesión --- */}
                    <View style={styles.logoutButton}>
                        <Button
                            title="Cerrar Sesión"
                            onPress={handleLogout}
                            color="grey"
                        />
                    </View>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ConfigScreen;