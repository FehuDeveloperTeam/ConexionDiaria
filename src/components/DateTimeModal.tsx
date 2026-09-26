// Selector de fecha y hora que también funciona en web — Sprint 9.25.
//
// react-native-modal-datetime-picker envuelve a
// @react-native-community/datetimepicker, que no trae implementación web: en
// node_modules hay .android.js, .ios.js y .windows.js, y ningún .web.js. En el
// navegador el modal no dibuja nada, así que hasta ahora, desde el computador,
// no se podía elegir la fecha del aniversario en Inicio ni la fecha y hora de
// un evento en Calendario. No fallaba con un error: simplemente no pasaba
// nada al tocar, que es peor.
//
// Mantiene la misma forma de props que DateTimePickerModal para poder
// reemplazarlo en el sitio, sin tocar la lógica de las pantallas.
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '../contexts/themeContext';
import { radii, spacing } from '../config/theme';
import {
    fromDateInputValue, toDateInputValue, toTimeInputValue, withTimeFromInput,
} from '../services/dateInput';

export const DateTimeModal: React.FC<{
    isVisible: boolean;
    mode: 'date' | 'time';
    date?: Date;
    maximumDate?: Date;
    minimumDate?: Date;
    onConfirm: (date: Date) => void;
    onCancel: () => void;
}> = ({ isVisible, mode, date, maximumDate, minimumDate, onConfirm, onCancel }) => {
    const { theme, fontFamilies, isDarkMode } = useTheme();
    const base = date ?? new Date();
    const [draft, setDraft] = useState<Date>(base);

    // Al abrirlo hay que partir de lo que la pantalla tiene hoy, no de lo que
    // quedó de la vez anterior.
    useEffect(() => {
        if (isVisible) setDraft(date ?? new Date());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVisible, date?.getTime()]);

    if (Platform.OS !== 'web') {
        return (
            <DateTimePickerModal
                isVisible={isVisible}
                mode={mode}
                date={base}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                onConfirm={onConfirm}
                onCancel={onCancel}
                locale="es_ES"
                confirmTextIOS="Confirmar"
                cancelTextIOS="Cancelar"
                minuteInterval={5}
            />
        );
    }

    // El input del navegador va visible y no como capa transparente encima de
    // otra cosa: Chrome solo abre el calendario desde el ícono del propio
    // input, así que un input invisible es un input que no se puede abrir.
    const input = React.createElement('input', {
        type: mode === 'date' ? 'date' : 'time',
        value: mode === 'date' ? toDateInputValue(draft) : toTimeInputValue(draft),
        max: mode === 'date' && maximumDate ? toDateInputValue(maximumDate) : undefined,
        min: mode === 'date' && minimumDate ? toDateInputValue(minimumDate) : undefined,
        onChange: (event: { target: { value: string } }) => {
            const picked = mode === 'date'
                ? fromDateInputValue(event.target.value)
                // Solo se reemplaza la hora: el día ya elegido se conserva.
                : withTimeFromInput(draft, event.target.value);
            if (picked) setDraft(picked);
        },
        style: {
            width: '100%',
            height: 50,
            boxSizing: 'border-box',
            padding: `0 ${spacing.s16 - 1}px`,
            borderRadius: radii.field,
            border: `1px solid ${theme.borderSoft}`,
            background: theme.inputBackground,
            color: theme.text,
            fontFamily: fontFamilies.body,
            fontSize: 16,
            // Para que el calendario propio del navegador siga el tema de la
            // app en vez de salir siempre en claro.
            colorScheme: isDarkMode ? 'dark' : 'light',
        },
    });

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(24,22,46,0.5)' }}>
                <TouchableOpacity style={{ position: 'absolute', width: '100%', height: '100%' }} activeOpacity={1} onPress={onCancel} accessibilityElementsHidden importantForAccessibility="no" />
                <View style={{
                    width: 320, maxWidth: '90%',
                    backgroundColor: theme.surface, borderRadius: radii.card,
                    padding: spacing.s20, gap: spacing.s16,
                }}>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 19, color: theme.text }}>
                        {mode === 'date' ? 'Elige la fecha' : 'Elige la hora'}
                    </Text>

                    {input}

                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.s12 }}>
                        <TouchableOpacity onPress={onCancel} style={{ paddingVertical: spacing.s10, paddingHorizontal: spacing.s12 }}>
                            <Text style={{ fontFamily: fontFamilies.action, fontSize: 14.5, color: theme.textMuted }}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onConfirm(draft)}
                            style={{
                                backgroundColor: theme.primary, borderRadius: radii.field,
                                paddingVertical: spacing.s10, paddingHorizontal: spacing.s20,
                            }}
                        >
                            <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 14.5, color: theme.white }}>Confirmar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
