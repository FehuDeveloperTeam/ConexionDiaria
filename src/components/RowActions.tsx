// Acciones de fila para escritorio — Sprint 9.3.
//
// Editar y eliminar existían desde siempre en Notas, Tareas y Deseos, pero
// solo se alcanzaban manteniendo presionada la fila. En teléfono ese gesto es
// natural; con un mouse no hay nada que lo insinúe y la función quedaba
// invisible — de hecho se reportó como "no se pueden editar ni eliminar".
//
// Se muestran SIEMPRE (atenuadas) en vez de aparecer solo al pasar el cursor:
// el problema a resolver era la descubribilidad, y un botón que únicamente
// existe mientras el cursor está encima se sigue descubriendo por casualidad.
// Al pasar el cursor toman color y fondo para confirmar que son accionables.
//
// En teléfono no se renderiza nada: ahí manda el mantener presionado, que ya
// funciona y no ensucia la fila.
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/themeContext';
import { useResponsive } from '../hooks/useResponsive';

const ActionIcon: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    tint: string;
    onPress: () => void;
}> = ({ icon, label, tint, onPress }) => {
    const { theme } = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Pressable
            onPress={onPress}
            onHoverIn={() => setIsHovered(true)}
            onHoverOut={() => setIsHovered(false)}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isHovered ? theme.surfaceAlt : 'transparent',
            }}
        >
            <Ionicons name={icon} size={16} color={isHovered ? tint : theme.textFaint} />
        </Pressable>
    );
};

export const RowActions: React.FC<{
    onEdit: () => void;
    // Sin 'onDelete' solo se ofrece editar — las tres pantallas reservan
    // eliminar para quien creó el ítem.
    onDelete?: () => void;
}> = ({ onEdit, onDelete }) => {
    const { theme } = useTheme();
    const { isDesktop } = useResponsive();

    if (!isDesktop) return null;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <ActionIcon icon="create-outline" label="Editar" tint={theme.text} onPress={onEdit} />
            {onDelete && (
                <ActionIcon icon="trash-outline" label="Eliminar" tint={theme.danger} onPress={onDelete} />
            )}
        </View>
    );
};
