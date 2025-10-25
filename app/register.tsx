import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput as RNTextInput, Button, Alert, useColorScheme, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import { themes } from '../src/config/theme';
import { Feather } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: theme.background,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 40,
        color: theme.text,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderColor: theme.borderColor,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: 20,
        backgroundColor: theme.inputBackground,
    },
    input: {
        flex: 1,
        height: 50,
        paddingHorizontal: 15,
        fontSize: 16,
        color: theme.text,
    },
    icon: {
        padding: 10,
    },
    footer: {
        marginTop: 30,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
    },
    footerText: {
        color: theme.text,
    },
    link: {
        color: theme.link,
        fontWeight: 'bold',
    },
    loadingContainer: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    }
});

const Register: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (password !== confirmPassword) return Toast.show({ type: 'error', text1: 'Error', text2: 'Las contraseñas no coinciden.' });
        if (!email || !password || !displayName) return Toast.show({ type: 'error', text1: 'Error', text2: 'Por favor, completa todos los campos.' });
        
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const user = userCredential.user;
            
            // ⭐ ACTUALIZADO: Incluye isOnline y lastSeen
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                displayName: displayName.trim(),
                createdAt: serverTimestamp(),
                partnerId: null,
                relationshipStartDate: null,
                currentMood: { emoji: '😊', name: 'Neutral', status: '' },
                // ⭐ CAMPOS NUEVOS PARA ESTADO ONLINE ⭐
                isOnline: true,              // Usuario online al registrarse
                lastSeen: serverTimestamp()  // Timestamp actual
            });
            
            router.replace('/(tabs)/home');
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') Toast.show({ type: 'error', text1: 'Error', text2: 'Este correo ya está en uso.' });
            else if (error.code === 'auth/weak-password') Toast.show({ type: 'error', text1: 'Error', text2: 'La contraseña debe tener al menos 6 caracteres.' });
            else Toast.show({ type: 'error', text1: 'Error', text2: 'Ocurrió un problema al crear la cuenta.' });
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: theme.background}}>
            <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.title}>Crea tu Cuenta</Text>

                <View style={styles.inputContainer}>
                    <RNTextInput
                        style={styles.input}
                        placeholder="Tu Nombre"
                        placeholderTextColor={theme.placeholder}
                        value={displayName}
                        onChangeText={setDisplayName}
                        returnKeyType="next"
                    />
                </View>
                <View style={styles.inputContainer}>
                    <RNTextInput
                        style={styles.input}
                        placeholder="Correo Electrónico"
                        placeholderTextColor={theme.placeholder}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        returnKeyType="next"
                    />
                </View>
                
                <View style={styles.inputContainer}>
                    <RNTextInput
                        style={styles.input}
                        placeholder="Contraseña (mín. 6 caracteres)"
                        placeholderTextColor={theme.placeholder}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!isPasswordVisible}
                        returnKeyType="next"
                    />
                    <TouchableOpacity style={styles.icon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                        <Feather name={isPasswordVisible ? "eye-off" : "eye"} size={22} color={theme.placeholder} />
                    </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                    <RNTextInput
                        style={styles.input}
                        placeholder="Confirmar Contraseña"
                        placeholderTextColor={theme.placeholder}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!isConfirmPasswordVisible}
                        returnKeyType="go"
                        onSubmitEditing={handleRegister}
                    />
                    <TouchableOpacity style={styles.icon} onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}>
                        <Feather name={isConfirmPasswordVisible ? "eye-off" : "eye"} size={22} color={theme.placeholder} />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : (
                    <Button title="Registrarme" onPress={handleRegister} color={theme.primary} />
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿Ya tienes una cuenta?</Text>
                    <Link href="/login" style={styles.link}>
                        Inicia sesión aquí
                    </Link>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Register;