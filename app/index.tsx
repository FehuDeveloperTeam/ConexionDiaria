import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { themes, fontFamilies, spacing } from '../src/config/theme';
import { useTheme } from '../src/contexts/themeContext';
import { Button } from '../src/components/Button';

const getStyles = (theme: typeof themes.light, isLight: boolean) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.bg },
    container: { flex: 1, paddingHorizontal: 34, justifyContent: 'space-between', alignItems: 'center' },
    header: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.s20 },
    iconBox: {
        width: 112,
        height: 112,
        borderRadius: 36,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: isLight ? '#E4E4F0' : theme.borderSoft,
        alignItems: 'center',
        justifyContent: 'center',
        ...(isLight
            ? { shadowColor: theme.primary, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.14, shadowRadius: 30, elevation: 8 }
            : {}),
    },
    title: { fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 40, color: theme.text },
    subtitle: {
        fontFamily: fontFamilies.body,
        fontSize: 16,
        lineHeight: 24,
        color: isLight ? '#5C5C68' : theme.textMuted,
        textAlign: 'center',
        maxWidth: 280,
    },
    footer: { width: '100%', paddingBottom: 48, gap: spacing.s12 },
    footNote: { fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint, textAlign: 'center', marginTop: spacing.s10 },
});

const LandingScreen: React.FC = () => {
    const { theme, isDarkMode } = useTheme();
    const styles = getStyles(theme, !isDarkMode);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.iconBox}>
                        <Ionicons name="heart" size={58} color={theme.affection} />
                    </View>
                    <Text style={styles.title}>Conexión Diaria</Text>
                    <Text style={styles.subtitle}>
                        Tu espacio privado para conectar, compartir y crecer juntos.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Link href="/login" asChild>
                        <Button title="Iniciar Sesión" onPress={() => {}} />
                    </Link>
                    <Link href="/register" asChild>
                        <Button title="Crear Cuenta" onPress={() => {}} variant="outline" />
                    </Link>
                    <Text style={styles.footNote}>Una cuenta por persona · una relación compartida</Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default LandingScreen;
