import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, useColorScheme, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, DocumentData, writeBatch, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: theme.background,
        gap: 15,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: theme.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    missYouContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.inputBackground,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 50,
        borderWidth: 1,
        borderColor: theme.borderColor,
        gap: 10,
        marginVertical: 20,
    },
    missYouText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.primary,
    },
    codeBox: {
        backgroundColor: theme.inputBackground,
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.borderColor,
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    codeText: {
        fontSize: 16,
        color: theme.primary,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    input: {
        height: 50,
        width: '100%',
        borderColor: theme.borderColor,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        fontSize: 16,
        color: theme.text,
        backgroundColor: theme.inputBackground,
        textAlign: 'center',
    },
    infoText: {
        fontSize: 16,
        color: theme.text,
    },
});

const Home: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    // El estado del usuario de Auth se mantiene separado
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [relationshipData, setRelationshipData] = useState<DocumentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [partnerCode, setPartnerCode] = useState('');

    // --- LÓGICA CORREGIDA Y UNIFICADA ---
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userDocRef = doc(db, 'users', currentUser.uid);
                
                // Escuchamos el perfil del usuario en tiempo real
                const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
                    if (docSnap.exists()) {
                        setUserData(docSnap.data());
                    } else {
                        // Si el perfil no existe, algo falló en el registro, lo deslogueamos
                        signOut(auth);
                    }
                    setLoading(false);
                });
                return unsubscribeUser; // Limpiamos este listener cuando el usuario cambia
            } else {
                setUser(null);
                setUserData(null);
                router.replace('/login');
            }
        });
        return unsubscribeAuth; // Limpiamos el listener de auth
    }, []);

    useEffect(() => {
        // Este efecto se activa cuando tenemos el perfil del usuario y su pareja
        if (userData && userData.partnerId) {
            const currentUserUid = auth.currentUser!.uid;
            const partnerUid = userData.partnerId;
            const chatId = [currentUserUid, partnerUid].sort().join('_');
            const relationshipDocRef = doc(db, 'relationships', chatId);

            // Escuchamos el documento de la relación en tiempo real
            const unsubscribeRelationship = onSnapshot(relationshipDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setRelationshipData(docSnap.data());
                } else {
                    setRelationshipData({ missYouCount: 0 }); // Valor inicial si aún no existe
                }
            });
            return unsubscribeRelationship; // Limpiamos el listener de la relación
        }
    }, [userData]); // Depende de userData

    // --- Las funciones de manejo de eventos no cambian ---
    const handleLogout = async () => { /* ... */ };
    const handleCopyCode = async () => { /* ... */ };
    const handleConnectPartner = async () => { /* ... */ };

    if (loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    // --- RENDERIZADO CON EL EXTRAÑÓMETRO ---
    if (userData && !userData.partnerId) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>¡Hola, {userData.displayName}!</Text>
                <Text style={styles.subtitle}>Para empezar, conecta con tu pareja.</Text>
                <Text style={styles.infoText}>Tu código de conexión:</Text>
                <View style={styles.codeBox}>
                    <Text style={styles.codeText}>{user?.uid}</Text>
                    <TouchableOpacity onPress={handleCopyCode}>
                        <Feather name="copy" size={24} color={theme.primary} />
                    </TouchableOpacity>
                </View>
                <TextInput
                    style={styles.input}
                    placeholder="Introduce el código de tu pareja"
                    placeholderTextColor={theme.placeholder}
                    value={partnerCode}
                    onChangeText={setPartnerCode}
                />
                <Button title="Conectar" onPress={handleConnectPartner} color={theme.primary} />
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }
    
    if (userData && userData.partnerId) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>¡Hola, {userData.displayName}!</Text>
                
                <View style={styles.missYouContainer}>
                    <Ionicons name="heart" size={24} color={theme.primary} />
                    <Text style={styles.missYouText}>
                        {relationshipData?.missYouCount || 0}
                    </Text>
                </View>
                
                <Link href="/chat" asChild>
                    <Button title="Ir al Chat" color={theme.primary} />
                </Link>
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Cargando perfil...</Text>
        </View>
    );
};

export default Home;