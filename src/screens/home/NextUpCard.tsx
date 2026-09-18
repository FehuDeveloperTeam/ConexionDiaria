// Tarjeta "Lo próximo" de Inicio — Sprint 9.5, extraída en el 11.9.
//
// Lleva sus propios estilos, y eso es el punto de la extracción: si recibiera
// el objeto de estilos de la pantalla, seguiría atada a ella y no habría
// ganado nada más que mover líneas de archivo.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, themes, FontFamilies } from '../../config/theme';
import { useTheme } from '../../contexts/themeContext';
import { daysBetween } from '../../services/milestones';

export interface NextUpItem {
    title: string;
    date: Date;
    icon: keyof typeof Ionicons.glyphMap;
}

const getStyles = (theme: typeof themes.light, fontFamilies: FontFamilies) => StyleSheet.create({
    card: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.s12, width: '100%',
        backgroundColor: theme.surface, borderRadius: radii.card - 2,
        borderWidth: 1, borderColor: theme.borderSoft,
        padding: spacing.s14, marginTop: spacing.s12,
    },
    icon: {
        width: 34, height: 34, borderRadius: 11, backgroundColor: theme.primaryTint,
        alignItems: 'center', justifyContent: 'center',
    },
    label: { fontFamily: fontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.9, color: theme.textFaint },
    title: { fontFamily: fontFamilies.bodySemiBold, fontSize: 14.5, color: theme.text, marginTop: 2 },
    when: { fontFamily: fontFamilies.bodyBold, fontSize: 12.5, color: theme.primary },
});

export const NextUpCard: React.FC<{
    next: NextUpItem | null;
    onPress: () => void;
}> = ({ next, onPress }) => {
    const { theme, fontFamilies } = useTheme();
    const styles = getStyles(theme, fontFamilies);

    // Sin nada próximo no se dibuja un hueco vacío.
    if (!next) return null;

    // daysBetween cuenta días de calendario y no de 24 horas: el día en que
    // empieza el horario de verano dura 23, y truncando milisegundos la cuenta
    // se adelanta un día.
    const days = daysBetween(new Date(), next.date);
    const whenLabel = days <= 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`;

    return (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
            <View style={styles.icon}>
                <Ionicons name={next.icon} size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.label}>LO PRÓXIMO</Text>
                <Text style={styles.title} numberOfLines={1}>{next.title}</Text>
            </View>
            <Text style={styles.when}>{whenLabel}</Text>
        </TouchableOpacity>
    );
};
