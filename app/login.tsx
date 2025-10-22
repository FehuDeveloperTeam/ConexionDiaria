import { Link, useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Button, TextInput as RNTextInput, Alert, useColorScheme, TouchableOpacity, ActivityIndicator } from 'react-native';
import { auth } from '../src/config/firebaseConfig'; // Ruta corregida
import { signInWithEmailAndPassword } from 'firebase/auth';
import { themes } from '../src/config/theme'; // Ruta corregida
import { Feather } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: theme.background },
    title: { fontSize: 28, color: theme.text, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, marginBottom: 20, backgroundColor: theme.inputBackground },
    input: { flex: 1, height: 50, paddingHorizontal: 15, fontSize: 16, color: theme.text },
    icon: { padding: 10 },
    footer: { marginTop: 30, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
    footerText: { color: theme.text },
    link: { color: theme.link, fontWeight: 'bold' },
});

const Login: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const passwordInputRef = useRef<RNTextInput>(null);

    const handleLogin = async () => {
        if (!email || !password) {
            return Toast.show({ type: 'error', text1: 'Error', text2: 'Por favor, completa ambos campos.' });
        }
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email.trim(), password);
            // ¡CORRECCIÓN CLAVE! Redirigir a la ruta de pestañas
            router.replace('/(tabs)/home');
        } catch (error: any) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Correo o contraseña incorrectos.' });
            console.error(error);
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={{flex: 1, backgroundColor: theme.background}}>
            <View style={styles.container}>
                <Text style={styles.title}>Iniciar Sesión</Text>
                <View style={styles.inputContainer}>
                    <RNTextInput style={styles.input} placeholder="Correo Electrónico" placeholderTextColor={theme.placeholder} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => passwordInputRef.current?.focus()} />
                </View>
                <View style={styles.inputContainer}>
                    <RNTextInput ref={passwordInputRef} style={styles.input} placeholder="Contraseña" placeholderTextColor={theme.placeholder} value={password} onChangeText={setPassword} secureTextEntry={!isPasswordVisible} returnKeyType="go" onSubmitEditing={handleLogin} />
                    <TouchableOpacity style={styles.icon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
                        <Feather name={isPasswordVisible ? "eye-off" : "eye"} size={22} color={theme.placeholder} />
                    </TouchableOpacity>
                </View>
                
                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} />
                ) : (
                    <Button title="Iniciar Sesión" onPress={handleLogin} color={theme.primary} />
                )}

                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿No tienes una cuenta?</Text>
                    {/* Link corregido (ya no está dentro de tabs) */}
                    <Link href="/register" style={styles.link}>
                        Regístrate aquí
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};
export default Login;