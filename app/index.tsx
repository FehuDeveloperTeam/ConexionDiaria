import React from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { themes } from '../src/config/theme';
import { Ionicons } from '@expo/vector-icons';

const LandingScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Ionicons name="heart-circle" size={100} color={theme.primary} />
                    <Text style={styles.title}>Conexión Diaria</Text>
                    <Text style={styles.subtitle}>
                        Tu espacio privado para conectar, compartir y crecer juntos.
                    </Text>
                </View>
                
                <View style={styles.footer}>
                    <Link href="/login" asChild>
                        <TouchableOpacity style={styles.button}>
                            <Text style={styles.buttonText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                    </Link>
                    <Link href="/register" asChild>
                        <TouchableOpacity style={[styles.button, styles.buttonOutline]}>
                            <Text style={[styles.buttonText, styles.buttonOutlineText]}>Crear Cuenta</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.background,
    },
    container: {
        flex: 1,
        padding: 30,
        justifyContent: 'space-between', // Empuja el header arriba y el footer abajo
        alignItems: 'center',
    },
    header: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20,
    },
    title: {
        fontSize: 40,
        fontWeight: 'bold',
        color: theme.text,
    },
    subtitle: {
        fontSize: 18,
        color: theme.placeholder,
        textAlign: 'center',
        paddingHorizontal: 20,
    },
    footer: {
        width: '100%',
        gap: 15,
    },
    button: {
        backgroundColor: theme.primary,
        paddingVertical: 18,
        borderRadius: 100,
        alignItems: 'center',
    },
    buttonText: {
        color: theme.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    buttonOutline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: theme.primary,
    },
    buttonOutlineText: {
        color: theme.primary,
    },
});

export default LandingScreen;