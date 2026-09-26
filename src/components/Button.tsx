// Botón compartido — Sprint 7.1 (componentes transversales).
//
// Punto único donde vive Poppins como "la voz de la interacción": todo
// botón/CTA de la app pasa por acá. Newsreader queda para los momentos
// emotivos y Manrope para el contenido — Poppins es deliberadamente
// exclusivo de esto y de las etiquetas de la tab bar, para no diluir a
// Manrope como fuente de UI general.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/themeContext';
import { radii, shadows, spacing } from '../config/theme';

type ButtonVariant = 'primary' | 'outline' | 'ghost';

export const Button: React.FC<{
    title: string;
    onPress: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    loadingText?: string;
    style?: ViewStyle;
}> = ({ title, onPress, variant = 'primary', disabled = false, loading = false, loadingText, style }) => {
    const { theme, isDarkMode, fontFamilies } = useTheme();
    const isDisabled = disabled || loading;
    // Sprint 8.9: hover sutil en escritorio (handoff, "Detalles de PC" —
    // "hover en tarjetas y filas"). onHoverIn/onHoverOut de Pressable solo
    // disparan en react-native-web; en nativo (iOS/Android) nunca se llaman,
    // así que 'isHovered' se queda en false y no cambia nada ahí.
    const [isHovered, setIsHovered] = useState(false);

    const backgroundColor =
        variant === 'primary' ? (isDisabled ? theme.borderSoft : theme.primary) : 'transparent';
    const borderColor = variant === 'outline' ? theme.primary : 'transparent';
    const textColor =
        variant === 'primary'
            ? theme.white
            : isDisabled
                ? theme.textFaint
                : theme.primary;

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            onHoverIn={() => setIsHovered(true)}
            onHoverOut={() => setIsHovered(false)}
            style={({ pressed }) => [
                {
                    backgroundColor,
                    borderRadius: radii.field + 1, // 17px, entre 'field' (16) y 'card'
                    borderWidth: variant === 'outline' ? 1.5 : 0,
                    borderColor,
                    paddingVertical: spacing.s16 + 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: spacing.s8,
                },
                // Handoff: en oscuro las sombras se sustituyen por un borde
                // 1px 'border' — no hay sombra cálida visible sobre fondos
                // oscuros.
                variant === 'primary' && !isDisabled
                    ? (isDarkMode ? { borderWidth: 1, borderColor: theme.border } : shadows.ctaCard)
                    : null,
                !isDisabled && isHovered ? { opacity: 0.9 } : null,
                !isDisabled && pressed ? { opacity: 0.8 } : null,
                style,
            ]}
        >
            {loading && <ActivityIndicator size="small" color={textColor} />}
            <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 16, color: textColor }}>
                {loading && loadingText ? loadingText : title}
            </Text>
        </Pressable>
    );
};
