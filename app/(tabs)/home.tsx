import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, useColorScheme, ActivityIndicator, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, DocumentData, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message'; // Importamos Toast

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
    // Estilo para el texto simple
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

    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [partnerCode, setPartnerCode] = useState('');

    const fetchUserData = async (currentUser: User) => {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            setUserData(userDocSnap.data());
        } else {
            console.log("No se encontró el documento del usuario");
        }
    };
    
    // Tu código de useEffect y handleLogout no necesita cambios
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                await fetchUserData(currentUser);
            } else {
                router.replace('/login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);
    const handleLogout = async () => {
        await signOut(auth);
    };

    // Actualizado para usar Toast
    const handleCopyCode = async () => {
        if (user?.uid) {
            await Clipboard.setStringAsync(user.uid);
            Toast.show({ type: 'success', text1: '¡Código Copiado!' });
        }
    };

    // ¡ACTUALIZADO! Toda la función usa Toast para los mensajes
    const handleConnectPartner = async () => {
        const code = partnerCode.trim();
        if (!code) {
            return Toast.show({ type: 'error', text1: 'Error', text2: 'Por favor, introduce un código.' });
        }
        if (code === user?.uid) {
            return Toast.show({ type: 'error', text1: '¡Oops!', text2: 'No puedes conectarte contigo mismo.' });
        }

        const partnerDocRef = doc(db, 'users', code);
        const partnerDocSnap = await getDoc(partnerDocRef);

        if (!partnerDocSnap.exists()) {
            return Toast.show({ type: 'error', text1: 'Código Inválido', text2: 'No se encontró un usuario con ese código.' });
        }
        if (partnerDocSnap.data().partnerId) {
            return Toast.show({ type: 'info', text1: 'Lo sentimos', text2: 'Esa persona ya está conectada.' });
        }

        try {
            const batch = writeBatch(db);
            const currentUserRef = doc(db, 'users', user!.uid);
            batch.update(currentUserRef, { partnerId: code });
            batch.update(partnerDocRef, { partnerId: user!.uid });
            await batch.commit();

            Toast.show({ type: 'success', text1: '¡Conexión Exitosa!' });
            await fetchUserData(user!);
        } catch (error) {
            console.error("Error al conectar:", error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Ocurrió un problema al conectar.' });
        }
    };
    
    if (loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

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
                <Text style={styles.title}>¡Estás conectado!</Text>
                <Text style={styles.subtitle}>¡Hola, {userData.displayName}!</Text>
                <Button title="Cerrar Sesión" onPress={handleLogout} color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ocurrió un error</Text>
            <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
        </View>
    );
};

export default Home;