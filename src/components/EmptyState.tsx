// Estado vacío reutilizable — Sprint 7.1 (componentes transversales).
//
// Para cada tab dependiente de tener pareja vinculada (Chat, Notas, Tareas,
// Deseos, Álbum, Calendario): debe verse intencional, nunca una pantalla en
// blanco. La migración de cada pantalla a este componente ocurre en la
// sesión en que se re-skinea esa pantalla — acá solo se construye la
// pieza reutilizable, parametrizada por ícono/título/copy de cada tab.
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/themeContext';
import { Button } from './Button';
import { fontFamilies, radii, spacing } from '../config/theme';

export const EmptyState: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    message: string;
    invitationCode?: string | null;
    onConnectPress: () => void;
}> = ({ icon, title, message, invitationCode, onConnectPress }) => {
    const { theme } = useTheme();

    const handleCopyCode = async () => {
        if (!invitationCode) return;
        await Clipboard.setStringAsync(invitationCode);
        Toast.show({ type: 'success', text1: 'Código copiado' });
    };

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.s22, gap: spacing.s16, backgroundColor: theme.bg }}>
            <View
                style={{
                    width: 96,
                    height: 96,
                    borderRadius: 32,
                    backgroundColor: theme.primaryTint,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Ionicons name={icon} size={44} color={theme.primary} />
            </View>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: 24, lineHeight: 29, color: theme.text, textAlign: 'center' }}>
                {title}
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 22, color: theme.textMuted, textAlign: 'center', maxWidth: 280 }}>
                {message}
            </Text>

            {!!invitationCode && (
                <TouchableOpacity
                    onPress={handleCopyCode}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s8,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: theme.primarySoft,
                        borderRadius: radii.field,
                        paddingVertical: spacing.s10,
                        paddingHorizontal: spacing.s16,
                    }}
                >
                    <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 19, letterSpacing: 4, color: theme.primary }}>
                        {invitationCode}
                    </Text>
                    <Ionicons name="copy-outline" size={18} color={theme.primary} />
                </TouchableOpacity>
            )}

            <Button title="Vincular a mi pareja" onPress={onConnectPress} style={{ marginTop: spacing.s8, width: '100%' }} />
        </View>
    );
};
