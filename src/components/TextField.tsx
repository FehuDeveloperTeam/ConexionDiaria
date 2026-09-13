// Campo de texto compartido — Sprint 7.2 (auth). Etiqueta opcional en
// mayúsculas arriba, alterna a contraseña con ícono de ojo, y estado de
// error (borde + mensaje) para validaciones en vivo como la de Registro.
import React, { useState } from 'react';
import {
    NativeSyntheticEvent,
    Text,
    TextInput,
    TextInputProps,
    TextInputSubmitEditingEventData,
    TouchableOpacity,
    View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../contexts/themeContext';
import { fontFamilies, radii, spacing } from '../config/theme';

export const TextField: React.FC<{
    label?: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder?: string;
    isPassword?: boolean;
    error?: string;
    inputRef?: React.RefObject<TextInput | null>;
    keyboardType?: TextInputProps['keyboardType'];
    autoCapitalize?: TextInputProps['autoCapitalize'];
    returnKeyType?: TextInputProps['returnKeyType'];
    onSubmitEditing?: (e: NativeSyntheticEvent<TextInputSubmitEditingEventData>) => void;
}> = ({
    label,
    value,
    onChangeText,
    placeholder,
    isPassword = false,
    error,
    inputRef,
    keyboardType,
    autoCapitalize,
    returnKeyType,
    onSubmitEditing,
}) => {
    const { theme } = useTheme();
    const [isVisible, setIsVisible] = useState(false);
    const hasError = !!error;

    return (
        <View style={{ marginBottom: spacing.s20, width: '100%' }}>
            {!!label && (
                <Text
                    style={{
                        fontFamily: fontFamilies.bodyBold,
                        fontSize: 11,
                        letterSpacing: 0.9,
                        textTransform: 'uppercase',
                        color: theme.textMuted,
                        marginBottom: spacing.s8,
                    }}
                >
                    {label}
                </Text>
            )}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: '100%',
                    borderWidth: 1,
                    borderColor: hasError ? theme.danger : theme.borderSoft,
                    borderRadius: radii.field,
                    backgroundColor: theme.inputBackground,
                }}
            >
                <TextInput
                    ref={inputRef}
                    style={{
                        flex: 1,
                        height: 50,
                        paddingHorizontal: spacing.s16 - 1,
                        fontFamily: fontFamilies.body,
                        fontSize: 16,
                        color: theme.text,
                        letterSpacing: isPassword && !isVisible ? 3 : 0,
                    }}
                    placeholder={placeholder}
                    placeholderTextColor={theme.placeholder}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={isPassword && !isVisible}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                />
                {isPassword && (
                    <TouchableOpacity style={{ padding: spacing.s10 }} onPress={() => setIsVisible((v) => !v)}>
                        <Feather name={isVisible ? 'eye-off' : 'eye'} size={21} color={theme.primary} />
                    </TouchableOpacity>
                )}
            </View>
            {hasError && (
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.danger, marginTop: spacing.s6 }}>
                    {error}
                </Text>
            )}
        </View>
    );
};
