// Fila de talla — Sprint 9.24. La comparten la ficha de la pareja y "Mis
// tallas" para que las dos pantallas se vean y se comporten igual.
//
// El tick refleja lo GUARDADO, no lo que se está escribiendo: mientras se
// teclea sigue gris y se pone verde al guardar. Es la señal de "esto ya quedó
// registrado", y si cambiara con cada letra no diría nada.
import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../config/theme';
import { useTheme } from '../contexts/themeContext';

export const StatusTick: React.FC<{ filled: boolean }> = ({ filled }) => {
    const { theme } = useTheme();
    return (
        <Ionicons
            name={filled ? 'checkmark-circle' : 'ellipse-outline'}
            size={20}
            color={filled ? theme.success : theme.textFaint}
            // Sin esto, alguien que no distinga el verde del gris no tiene
            // cómo saber qué falta por llenar.
            accessibilityLabel={filled ? 'Dato ingresado' : 'Sin ingresar'}
        />
    );
};

export const MeasurementRow: React.FC<{
    label: string;
    hint?: string;
    // Texto de procedencia cuando el valor lo declaró la otra persona.
    sourceNote?: string;
    value: string;
    placeholder: string;
    saved: boolean;
    isLast?: boolean;
    onChangeText: (value: string) => void;
}> = ({ label, hint, sourceNote, value, placeholder, saved, isLast, onChangeText }) => {
    const { theme, fontFamilies } = useTheme();

    return (
        <View style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
            paddingVertical: spacing.s10, paddingHorizontal: spacing.s14,
            borderBottomWidth: isLast ? 0 : 1, borderBottomColor: theme.divider,
        }}>
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.text }}>
                    {label}
                </Text>
                {!!(sourceNote || hint) && (
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 11, color: theme.textFaint, marginTop: 2 }}>
                        {sourceNote || hint}
                    </Text>
                )}
            </View>

            <TextInput
                style={{
                    width: 92, height: 40, textAlign: 'right',
                    paddingHorizontal: spacing.s10,
                    borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                    backgroundColor: theme.inputBackground,
                    color: theme.text, fontFamily: fontFamilies.body, fontSize: 15,
                }}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={theme.textFaint}
                accessibilityLabel={label}
                maxLength={14}
            />

            <StatusTick filled={saved} />
        </View>
    );
};
