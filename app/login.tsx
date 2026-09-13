import { useRouter, Link } from 'expo-router';
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput as RNTextInput, TouchableOpacity } from 'react-native';
import { auth } from '../src/config/firebaseConfig'; // Ruta corregida
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { themes, spacing, FontFamilies } from '../src/config/theme'; // Ruta corregida
import { useTheme } from '../src/contexts/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';

const getStyles = (theme: typeof themes.light, fontFamilies: FontFamilies) => StyleSheet.create({
    container: { flex: 1, padding: spacing.s20, backgroundColor: theme.bg },
    backButton: { paddingVertical: spacing.s10, marginBottom: spacing.s10 },
    title: { fontFamily: fontFamilies.display, fontSize: 34, lineHeight: 36, color: theme.text, marginBottom: spacing.s6 },
    subcopy: { fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, marginBottom: spacing.s26 },
    forgotPassword: { alignSelf: 'flex-end', marginBottom: spacing.s20, marginTop: -spacing.s10 },
    forgotPasswordText: { fontFamily: fontFamilies.bodySemiBold, fontSize: 13, color: theme.primary },
    footer: { marginTop: spacing.s26, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.s4 },
    footerText: { fontFamily: fontFamilies.body, color: theme.textMuted, fontSize: 13.5 },
    link: { fontFamily: fontFamilies.bodyBold, color: theme.primary, fontSize: 13.5 },
});

const Login: React.FC = () => {
    const { theme, fontFamilies } = useTheme();
    const styles = getStyles(theme, fontFamilies);
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSendingReset, setIsSendingReset] = useState(false);
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

    // A-01: recuperar contraseña. El mensaje es SIEMPRE el mismo, exista o
    // no esa cuenta — confirmar que existe sería filtrar justo lo que la
    // protección de enumeración de correos intenta esconder (ver 'Correo o
    // contraseña incorrectos' arriba, mismo criterio).
    const handleForgotPassword = async () => {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            return Toast.show({ type: 'error', text1: 'Error', text2: 'Escribe tu correo para poder enviarte el enlace.' });
        }
        setIsSendingReset(true);
        try {
            await sendPasswordResetEmail(auth, trimmedEmail);
        } catch (error) {
            console.error(error);
        }
        setIsSendingReset(false);
        Toast.show({ type: 'success', text1: 'Revisa tu correo', text2: 'Si esa cuenta existe, te enviamos un enlace para restablecer tu contraseña.' });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={26} color={theme.text} />
                </TouchableOpacity>

                <Text style={styles.title}>Hola de nuevo</Text>
                <Text style={styles.subcopy}>Tu pareja te está esperando.</Text>

                <TextField
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
                <TextField
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    isPassword
                    inputRef={passwordInputRef}
                    returnKeyType="go"
                    onSubmitEditing={handleLogin}
                />

                <TouchableOpacity style={styles.forgotPassword} onPress={handleForgotPassword} disabled={isSendingReset}>
                    <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>

                <Button
                    title="Iniciar Sesión"
                    onPress={handleLogin}
                    loading={loading}
                    loadingText="Entrando…"
                />

                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿No tienes una cuenta?</Text>
                    <Link href="/register" style={styles.link}>
                        Crear cuenta
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};
export default Login;
