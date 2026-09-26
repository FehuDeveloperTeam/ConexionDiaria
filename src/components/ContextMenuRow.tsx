// Fila de menú contextual flotante compartida — Sprint 8.9 (hover en
// escritorio). Antes cada pantalla (Notas/Tareas/Deseos) repetía el mismo
// TouchableOpacity de "Editar"/"Eliminar" sin feedback de hover; esto lo
// unifica y le agrega el hover sutil que pide el handoff ("Detalles de
// PC: hover en tarjetas y filas"). onHoverIn/onHoverOut solo disparan en
// react-native-web — en nativo no cambia nada.
import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/themeContext';
import { spacing } from '../config/theme';

export const ContextMenuRow: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color?: string;
    onPress: () => void;
}> = ({ icon, label, color, onPress }) => {
    const { theme, fontFamilies } = useTheme();
    const [isHovered, setIsHovered] = useState(false);
    const tint = color || theme.text;

    return (
        <Pressable
            onPress={onPress}
            onHoverIn={() => setIsHovered(true)}
            onHoverOut={() => setIsHovered(false)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s10,
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s16,
                backgroundColor: isHovered ? theme.surfaceAlt : 'transparent',
            }}
        >
            <Ionicons name={icon} size={18} color={tint} />
            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: tint }}>{label}</Text>
        </Pressable>
    );
};
