import React from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { themes } from '../src/config/theme'; // Asegúrate que la ruta sea correcta
import { Ionicons } from '@expo/vector-icons';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.background,
    },
    container: {
        flex: 1,
        padding: 30,
        justifyContent: 'space-between',
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
    
    // --- ESTILOS CORREGIDOS ---
    
    // 1. Estilo para el botón Sólido (Iniciar Sesión)
    buttonSolid: {
        backgroundColor: theme.primary,
        paddingVertical: 18,
        borderRadius: 100,
        alignItems: 'center',
        borderWidth: 2, // Añadimos borde para mantener la misma altura
        borderColor: theme.primary,
    },
    buttonSolidText: {
        color: theme.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    // 2. Estilo para el botón Contorno (Crear Cuenta)
    buttonOutline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: theme.primary,
        paddingVertical: 18,
        borderRadius: 100,
        alignItems: 'center',
    },
    buttonOutlineText: {
        color: theme.primary,
        fontSize: 18,
        fontWeight: 'bold',
    },
});

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
                    {/* 3. AHORA PASAMOS UN ÚNICO OBJETO DE ESTILO */}
                    <Link href="/login" asChild>
                        <TouchableOpacity style={styles.buttonSolid}>
                            <Text style={styles.buttonSolidText}>Iniciar Sesión</Text>
                        </TouchableOpacity>
                    </Link>
                    {/* 4. AHORA PASAMOS UN ÚNICO OBJETO DE ESTILO */}
                    <Link href="/register" asChild>
                        <TouchableOpacity style={styles.buttonOutline}>
                            <Text style={styles.buttonOutlineText}>Crear Cuenta</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
};

export default LandingScreen;