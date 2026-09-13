// Configuración visual de los toasts — Sprint 7.1 (componentes
// transversales). El pill es oscuro a propósito en los dos temas (spec del
// handoff de diseño): se usa en app/_layout.tsx vía <Toast config={toastConfig} />.
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ToastConfigParams } from 'react-native-toast-message';
import { fontFamilies } from '../config/theme';
import { useTheme } from '../contexts/themeContext';

const PillToast: React.FC<
    ToastConfigParams<unknown> & { icon: keyof typeof Ionicons.glyphMap; iconColor: string }
> = ({ text1, text2, icon, iconColor }) => {
    const { theme, isDarkMode } = useTheme();
    return (
    <View
        style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: '#1E1E28',
            borderRadius: 16,
            paddingVertical: 13,
            paddingHorizontal: 15,
            marginHorizontal: 20,
            maxWidth: '100%',
            // Handoff: en oscuro la sombra se sustituye por un borde 1px
            // 'border' — el pill ya es oscuro de por sí, así que la sombra
            // apenas se distingue sobre un fondo de página también oscuro.
            ...(isDarkMode
                ? { borderWidth: 1, borderColor: theme.border }
                : { shadowColor: '#0A0A19', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.3, shadowRadius: 30, elevation: 14 }),
        }}
    >
        <Ionicons name={icon} size={19} color={iconColor} />
        <View style={{ flexShrink: 1 }}>
            {!!text1 && (
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13, color: '#FFFFFF' }}>
                    {text1}
                </Text>
            )}
            {!!text2 && (
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: '#C8C8D4', marginTop: 2 }}>
                    {text2}
                </Text>
            )}
        </View>
    </View>
    );
};

export const toastConfig = {
    success: (props: ToastConfigParams<unknown>) => (
        <PillToast {...props} icon="checkmark-circle" iconColor="#7FE0A8" />
    ),
    error: (props: ToastConfigParams<unknown>) => (
        <PillToast {...props} icon="close-circle" iconColor="#FF93A8" />
    ),
    info: (props: ToastConfigParams<unknown>) => (
        <PillToast {...props} icon="information-circle" iconColor="#9AB6FF" />
    ),
};
