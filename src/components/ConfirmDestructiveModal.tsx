// Confirmación destructiva — Sprint 7.1 (componentes transversales).
// Reemplaza el uso suelto de Alert.alert() para acciones irreversibles
// (borrar mensaje, borrar nota/tarea/deseo, desconectar pareja). La
// migración de cada pantalla que hoy usa Alert.alert pasa a este
// componente en la sesión en que se re-skinea esa pantalla — acá solo se
// construye la pieza reutilizable.
import React from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/themeContext';
import { Button } from './Button';
import { radii, spacing } from '../config/theme';

export const ConfirmDestructiveModal: React.FC<{
    visible: boolean;
    icon?: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ visible, icon = 'trash', title, message, confirmLabel = 'Eliminar', cancelLabel = 'Cancelar', onConfirm, onCancel }) => {
    const { theme, fontFamilies } = useTheme();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.s20 }}>
                <View style={{ backgroundColor: theme.surface, borderRadius: radii.card, padding: spacing.s22, width: '100%', maxWidth: 380, gap: spacing.s12 }}>
                    <View
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: 14,
                            backgroundColor: theme.dangerBg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: spacing.s4,
                        }}
                    >
                        <Ionicons name={icon} size={22} color={theme.danger} />
                    </View>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, lineHeight: 27, color: theme.text }}>
                        {title}
                    </Text>
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 21, color: theme.textMuted }}>
                        {message}
                    </Text>
                    <View style={{ gap: spacing.s10, marginTop: spacing.s8 }}>
                        <TouchableOpacity
                            onPress={onConfirm}
                            style={{ backgroundColor: theme.danger, borderRadius: radii.field - 1, paddingVertical: spacing.s16 - 1, alignItems: 'center' }}
                        >
                            <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 15, color: theme.white }}>{confirmLabel}</Text>
                        </TouchableOpacity>
                        <Button title={cancelLabel} onPress={onCancel} variant="outline" />
                    </View>
                </View>
            </View>
        </Modal>
    );
};
