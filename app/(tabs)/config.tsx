import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    Alert, Image, TouchableOpacity, TextInput, Button, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
// Importamos 'User' desde 'firebase/auth' para el tipo, pero 'onAuthStateChanged' ya no es necesario aquí
import { User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, DocumentData, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
// Importamos el hook de usePlan y Purchases
import { usePlan } from '../../src/contexts/planContext'; // Asegúrate que la ruta sea correcta
import Purchases from 'react-native-purchases';

// --- Función Helper para Blob ---
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
    },

    // --- Estilos para la sección del Plan (Añadidos) ---
    planSection: {
        width: '100%',
        marginTop: 20,
        backgroundColor: theme.inputBackground,
        borderColor: theme.borderColor,
        borderWidth: 1,
        borderRadius: 10,
        padding: 15,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 15,
    },
    planText: {
        fontSize: 16,
        color: theme.text,
        marginBottom: 15,
        textAlign: 'center',
    },
    planFeatures: {
        fontSize: 12,
        color: theme.placeholder,
        textAlign: 'center',
        marginTop: 10,
    },
    premiumLock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        opacity: 0.7,
    },
    premiumLockText: {
        fontSize: 16,
        color: theme.placeholder,
    }
});

const ConfigScreen: React.FC = () => {
    
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    // --- ESTADOS CORREGIDOS ---
    // 1. Obtenemos 'user', 'userData', 'plan' y 'isLoading' del contexto
    const { plan, user, userData, isLoading } = usePlan();

    // 2. Mantenemos solo los estados locales para esta pantalla
    const [displayName, setDisplayName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // --- Carga de Autenticación y Perfil ---
    // 3. Este useEffect actualiza 'displayName' cuando 'userData' cambia (del hook)
    useEffect(() => {
        if (userData) {
            setDisplayName(userData.displayName || '');
        }
    }, [userData]); // Depende de 'userData' del hook

    // 4. Los 'useEffect' de onAuthStateChanged y onSnapshot(userDocRef) se ELIMINAN
    // porque 'usePlan()' ya maneja esa lógica.

    // --- Función para actualizar a Premium ---
    const handleUpgrade = async () => {
        if (!user) return;
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current && offerings.current.availablePackages.length > 0) {
                const packageToPurchase = offerings.current.availablePackages[0];
                const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
                
                // Reemplaza "premium_entitlement" con el ID de tu Entitlement en RevenueCat
                if (customerInfo.entitlements.active["premium_entitlement"]) { 
                    await updateDoc(doc(db, 'users', user.uid), { plan: 'premium' });
                    Toast.show({ type: 'success', text1: '¡Bienvenido a Premium!' });
                }
            }
        } catch (e: any) { // 5. CORRECCIÓN de sintaxis: (e: any) {
            if (!e.userCancelled) {
                console.error(e);
                Toast.show({ type: 'error', text1: 'Error al procesar el pago' });
            }
        }
    };
    
    // --- Función para cambiar el Avatar ---
    const handlePickAvatar = useCallback(async () => {
        if (!user) return; // 'user' viene del hook

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Se necesita acceso a la galería.");
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (result.canceled || !result.assets) return;
        
        setIsUploading(true);
        const uri = result.assets[0].uri;

        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 400 } }],
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
    }, [user]); // 'user' del hook

    // --- Función para guardar el Nombre ---
    const handleSaveDisplayName = useCallback(async () => {
        if (!user || !displayName.trim()) { // 'user' del hook
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
    }, [user, displayName]); // 'user' del hook

    // --- Función para Desconectar de la Pareja ---
    const handleDisconnect = useCallback(async () => {
        if (!user || !userData || !userData.partnerId) return; // 'user' y 'userData' del hook

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

                            batch.update(userDocRef, { partnerId: null });
                            batch.update(partnerDocRef, { partnerId: null });
                            
                            await batch.commit();
                            Toast.show({ type: 'success', text1: 'Desconectado correctamente' });
                        } catch (error) {
                            console.error("Error al desconectar:", error);
                            Toast.show({ type: 'error', text1: 'Error al desconectar' });
                        }
                    }
                }
            ]
        );
    }, [user, userData]); // 'user' y 'userData' del hook

    // --- Función para Cerrar Sesión ---
    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
            // El listener en PlanContext se encargará de redirigir
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            Toast.show({ type: 'error', text1: 'Error al cerrar sesión' });
        }
    }, []);

    // --- Renderizado ---
    // Usamos 'isLoading' del hook
    if (isLoading || !userData) { 
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

                    {/* --- Sección de Plan (Añadida) --- */}
                    <View style={styles.planSection}>
                        <Text style={styles.sectionTitle}>Tu Plan</Text>
                        {plan === 'free' ? (
                            <>
                                <Text style={styles.planText}>Actual: Conexión Esencial (Gratis)</Text>
                                <Button 
                                    title="✨ Actualizar a Conexión Total ✨" 
                                    onPress={handleUpgrade} 
                                    color={theme.primary} 
                                />
                                <Text style={styles.planFeatures}>
                                    Tareas, notas y almacenamiento ilimitados, recordatorios y más.
                                </Text>
                            </>
                        ) : (
                            <Text style={styles.planText}>Actual: ¡Conexión Total! ❤️</Text>
                        )}
                    </View>

                    {/* --- Bloquear Personalización (Añadido) --- */}
                    <View style={styles.planSection}>
                        <Text style={styles.sectionTitle}>Personalización</Text>
                        {plan === 'free' ? (
                            <View style={styles.premiumLock}>
                                <Ionicons name="lock-closed" size={16} color={theme.placeholder} />
                                <Text style={styles.premiumLockText}>
                                    Temas de color (Función Premium)
                                </Text>
                            </View>
                        ) : (
                            <Button 
                                title="Elegir Tema (Próximamente)" 
                                onPress={() => Toast.show({type: 'info', text1: '¡Próximamente!'})} 
                                color={theme.primary}
                                disabled={true}
                            />
                        )}
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