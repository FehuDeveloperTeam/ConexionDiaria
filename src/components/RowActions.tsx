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

// Cada acción es opcional porque el permiso cambia según la pantalla y según
// quién creó el ítem: en Notas las reglas de Firestore dejan actualizar solo
// al autor, mientras que en Tareas y Deseos cualquiera de los dos puede.
export const RowActions: React.FC<{
    onEdit?: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
    // Invierte el ícono de archivar, para devolver el ítem a la lista activa.
    isArchived?: boolean;
}> = ({ onEdit, onArchive, onDelete, isArchived }) => {
    const { theme } = useTheme();
    const { isDesktop } = useResponsive();

    if (!isDesktop) return null;
    if (!onEdit && !onArchive && !onDelete) return null;

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {onEdit && (
                <ActionIcon icon="create-outline" label="Editar" tint={theme.text} onPress={onEdit} />
            )}
            {onArchive && (
                <ActionIcon
                    icon={isArchived ? 'arrow-undo-outline' : 'archive-outline'}
                    label={isArchived ? 'Devolver a la lista' : 'Archivar'}
                    tint={theme.text}
                    onPress={onArchive}
                />
            )}
            {onDelete && (
                <ActionIcon icon="trash-outline" label="Eliminar" tint={theme.danger} onPress={onDelete} />
            )}
        </View>
    );
};
