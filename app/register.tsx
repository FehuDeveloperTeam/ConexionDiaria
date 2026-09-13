import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, User } from 'firebase/auth';
import { doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../src/config/firebaseConfig';
import { themes, fontFamilies, spacing } from '../src/config/theme';
import { useTheme } from '../src/contexts/themeContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generateUniqueInvitationCode, buildInvitationCodeDoc } from '../src/services/invitationCode';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    container: { flexGrow: 1, padding: spacing.s20, backgroundColor: theme.bg },
    backButton: { paddingVertical: spacing.s10, marginBottom: spacing.s10 },
    title: { fontFamily: fontFamilies.display, fontSize: 34, lineHeight: 36, color: theme.text, marginBottom: spacing.s26 },
    footer: { marginTop: spacing.s26, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.s4 },
    footerText: { fontFamily: fontFamilies.body, color: theme.textMuted, fontSize: 13.5 },
    link: { fontFamily: fontFamilies.bodyBold, color: theme.primary, fontSize: 13.5 },
});

const Register: React.FC = () => {
    const { theme } = useTheme();
    const styles = getStyles(theme);
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);

    // Validación en vivo: apenas hay algo escrito en "confirmar", si no
    // coincide se marca de inmediato (borde + mensaje + CTA bloqueado) en
    // vez de esperar al submit.
    const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;

    const handleRegister = async () => {
        if (password !== confirmPassword) return Toast.show({ type: 'error', text1: 'Error', text2: 'Las contraseñas no coinciden.' });
        if (!email || !password || !displayName) return Toast.show({ type: 'error', text1: 'Error', text2: 'Por favor, completa todos los campos.' });

        setLoading(true);
        // Se guarda apenas se crea la cuenta de Auth, para poder revertirla
        // en el catch si algo después falla (ver A-06 más abajo).
        let createdUser: User | null = null;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            createdUser = userCredential.user;

            const invitationCode = await generateUniqueInvitationCode();

            // El perfil y el código de invitación se crean en el mismo batch:
            // si uno fallara, no queda un código huérfano sin dueño ni un
            // perfil sin código para emparejar.
            const batch = writeBatch(db);
            batch.set(doc(db, "users", createdUser.uid), {
                email: createdUser.email,
                displayName: displayName.trim(),
                createdAt: serverTimestamp(),
                partnerId: null,
                relationshipStartDate: null,
                invitationCode,
                gender: null,
                currentMood: { emoji: '😊', name: 'Neutral', status: '' },
                isOnline: true,
                lastSeen: serverTimestamp(),
                plan: 'free',
                premiumSince: null
            });
            batch.set(doc(db, "invitationCodes", invitationCode), buildInvitationCodeDoc(createdUser.uid));
            await batch.commit();

            // A-02: mandar la verificación de correo. No bloquea el uso de
            // la app — si falla (red, límite de envíos de Firebase), la
            // persona igual entra y puede reenviarla después desde Inicio.
            try {
                await sendEmailVerification(createdUser);
            } catch (verificationError) {
                console.error('No se pudo enviar el correo de verificación:', verificationError);
            }

            router.replace('/(tabs)/home');
        } catch (error: any) {
            console.error(error);

            // A-06: si la cuenta de Auth llegó a crearse pero algo después
            // falló (generar el código, escribir el perfil), no dejarla a
            // medio camino. Antes, esa cuenta quedaba en un limbo: el
            // correo ya estaba tomado pero sin perfil, así que la persona
            // no podía ni entrar ni volver a registrarse.
            if (createdUser) {
                try {
                    await createdUser.delete();
                } catch (deleteError) {
                    console.error('No se pudo revertir la cuenta a medio crear:', deleteError);
                }
            }

            if (error.code === 'auth/email-already-in-use') Toast.show({ type: 'error', text1: 'Error', text2: 'Este correo ya está en uso.' });
            else if (error.code === 'auth/weak-password') Toast.show({ type: 'error', text1: 'Error', text2: 'La contraseña debe tener al menos 6 caracteres.' });
            else Toast.show({ type: 'error', text1: 'Error', text2: 'Ocurrió un problema al crear la cuenta.' });
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
            <ScrollView contentContainerStyle={styles.container}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={26} color={theme.text} />
                </TouchableOpacity>

                <Text style={styles.title}>Crea tu Cuenta</Text>

                <TextField label="Nombre" value={displayName} onChangeText={setDisplayName} placeholder="Tu nombre" returnKeyType="next" />
                <TextField
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="tu@correo.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                />
                <TextField
                    label="Contraseña"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Mín. 6 caracteres"
                    isPassword
                    returnKeyType="next"
                />
                <TextField
                    label="Confirmar contraseña"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repite tu contraseña"
                    isPassword
                    error={passwordsMismatch ? 'Las contraseñas no coinciden' : undefined}
                    returnKeyType="go"
                    onSubmitEditing={handleRegister}
                />

                <Button
                    title="Registrarme"
                    onPress={handleRegister}
                    loading={loading}
                    loadingText="Creando cuenta…"
                    disabled={passwordsMismatch}
                />

                <View style={styles.footer}>
                    <Text style={styles.footerText}>¿Ya tienes una cuenta?</Text>
                    <Link href="/login" style={styles.link}>
                        Inicia sesión
                    </Link>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default Register;
