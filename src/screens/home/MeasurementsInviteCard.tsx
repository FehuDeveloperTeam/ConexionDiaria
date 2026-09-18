// Invitación a declarar las propias tallas — Sprint 9.24, extraída en el 11.9.
//
// Deliberadamente discreta: una fila, sin color de acento, sin modal y con una
// X para posponerla dos semanas. Compite en la misma pantalla con el aviso de
// regalo, que sí es urgente; esto no lo es, y si grita se vuelve ruido.
// Desaparece sola cuando no queda ninguna talla por responder.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../../config/theme';
import { useTheme } from '../../contexts/themeContext';

export const MeasurementsInviteCard: React.FC<{
    visible: boolean;
    partnerName?: string;
    filled: number;
    total: number;
    onPress: () => void;
    onSnooze: () => void;
}> = ({ visible, partnerName, filled, total, onPress, onSnooze }) => {
    const { theme, fontFamilies } = useTheme();

    if (!visible) return null;

    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel="Responder mis tallas"
            style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.s12,
                backgroundColor: theme.surfaceAlt, borderRadius: radii.card,
                paddingVertical: spacing.s12, paddingHorizontal: spacing.s14,
                marginBottom: spacing.s16,
            }}
        >
            <Ionicons name="shirt-outline" size={18} color={theme.textMuted} />
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.text }}>
                    ¿{partnerName || 'Tu pareja'} sabe qué talla usas?
                </Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint, marginTop: 2 }}>
                    Déjaselas anotadas · {filled} de {total}
                </Text>
            </View>
            <TouchableOpacity
                onPress={onSnooze}
                accessibilityRole="button"
                accessibilityLabel="Recordármelo más adelante"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="close" size={16} color={theme.textFaint} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};
