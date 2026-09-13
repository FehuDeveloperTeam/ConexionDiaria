// Loader a pantalla completa — Sprint 7.1 (componentes transversales).
// Se usa al abrir la app mientras se cargan perfil y relación (reemplaza
// el ActivityIndicator suelto de AuthRedirect en app/_layout.tsx cuando esa
// pantalla se migre al nuevo sistema).
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/themeContext';
import { fontFamilies } from '../config/theme';

export const FullScreenLoader: React.FC<{
    title?: string;
    subtitle?: string;
}> = ({ title = 'Preparando su espacio', subtitle = 'Sincronizando la relación…' }) => {
    const { theme } = useTheme();
    const pulse = useRef(new Animated.Value(1)).current;
    const spin = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.09, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ])
        );
        const spinLoop = Animated.loop(
            Animated.timing(spin, { toValue: 1, duration: 850, easing: Easing.linear, useNativeDriver: true })
        );
        pulseLoop.start();
        spinLoop.start();
        return () => {
            pulseLoop.stop();
            spinLoop.stop();
        };
    }, [pulse, spin]);

    const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
                <Ionicons name="heart" size={54} color={theme.affection} />
            </Animated.View>
            <Animated.View
                style={[
                    styles.spinner,
                    { borderColor: theme.borderSoft, borderTopColor: theme.primary, transform: [{ rotate }] },
                ]}
            />
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    spinner: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
    title: { fontFamily: fontFamilies.display, fontSize: 20 },
    subtitle: { fontFamily: fontFamilies.body, fontSize: 13 },
});
