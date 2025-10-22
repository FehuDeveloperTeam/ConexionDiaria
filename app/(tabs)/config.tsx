import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { themes } from '../../src/config/theme';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.background,
    },
    container: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    placeholderText: {
        fontSize: 16,
        color: theme.placeholder,
        textAlign: 'center',
        marginTop: 50,
    },
});

const ConfigScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Configuración</Text>
                <Text style={styles.placeholderText}>
                    Próximamente: ajustes de perfil, temas, notificaciones y más.
                </Text>
            </View>
        </SafeAreaView>
    );
};

export default ConfigScreen;