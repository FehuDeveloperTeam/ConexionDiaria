// Diálogo de herencia de tema al emparejar — Sprint 7.1 (componentes
// transversales). Debe mostrarse ANTES de confirmar el emparejamiento
// cuando ambos ya tienen un tema premium guardado (ver README del bundle
// de diseño, sección "F"). La regla real de herencia (género / antigüedad
// como pagador) y su conexión con pairWithCode se resuelven recién en la
// sesión 7.8b, junto con el probador de tema — acá solo se construye la
// pieza visual, con los dos temas recibidos por props.
import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/themeContext';
import { Button } from './Button';
import { radii, spacing } from '../config/theme';

interface ThemePreview {
    name: string;
    background: string;
    text: string;
}

const ThemeCard: React.FC<{ theme: ThemePreview }> = ({ theme }) => {
    const { fontFamilies } = useTheme();
    return (
        <View style={{ flex: 1, backgroundColor: theme.background, borderRadius: radii.field, padding: spacing.s12, alignItems: 'center', gap: spacing.s4 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: theme.text, opacity: 0.15 }} />
            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.text }}>{theme.name}</Text>
        </View>
    );
};

export const ThemeInheritanceDialog: React.FC<{
    visible: boolean;
    partnerName: string;
    losingTheme: ThemePreview;
    keepingTheme: ThemePreview;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ visible, partnerName, losingTheme, keepingTheme, onConfirm, onCancel }) => {
    const { theme, fontFamilies } = useTheme();
    if (!visible) return null;

    return (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(24,22,46,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing.s20 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: radii.card, padding: spacing.s22, width: '100%', maxWidth: 380, gap: spacing.s12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="color-palette" size={22} color={theme.primary} />
                </View>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, lineHeight: 27, color: theme.text }}>
                    Al vincularse, el tema de {partnerName} prevalece
                </Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 21, color: theme.textMuted }}>
                    Vas a perder <Text style={{ fontFamily: fontFamilies.bodyBold, color: theme.text }}>{losingTheme.name}</Text> y
                    pasarás a usar <Text style={{ fontFamily: fontFamilies.bodyBold, color: theme.text }}>{keepingTheme.name}</Text>.
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginVertical: spacing.s4 }}>
                    <ThemeCard theme={losingTheme} />
                    <Ionicons name="arrow-forward" size={18} color={theme.textFaint} />
                    <ThemeCard theme={keepingTheme} />
                </View>
                <View style={{ gap: spacing.s10, marginTop: spacing.s8 }}>
                    <Button title="Entiendo, vincular" onPress={onConfirm} />
                    <Button title="Cancelar" onPress={onCancel} variant="outline" />
                </View>
            </View>
        </View>
    );
};
