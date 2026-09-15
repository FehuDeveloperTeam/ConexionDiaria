// Campo de fecha que funciona en web y en móvil.
//
// react-native-modal-datetime-picker envuelve a
// @react-native-community/datetimepicker, que no trae implementación web —
// en node_modules hay .android.js, .ios.js y .windows.js, pero ningún
// .web.js. En el navegador el modal no dibuja nada.
//
// Un primer intento puso un <input type="date"> transparente ENCIMA del
// campo, pero Chrome no abre el calendario al hacer clic en cualquier parte
// de un input de fecha: solo lo abre desde su propio ícono. Invisible, ese
// ícono no existe. Así que en web el campo ES el input, con el selector que
// el navegador ya trae; en móvil se usa el modal de siempre, que ahí sí
// funciona.
import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useTheme } from '../contexts/themeContext';
import { radii, spacing } from '../config/theme';
import { formatDate } from '../services/dateFormat';

// Formato que exige <input type="date">: siempre aaaa-mm-dd, sin importar el
// idioma del equipo. Lo que ve la persona lo decide el navegador.
const toInputValue = (date: Date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

// Se construye a mano y no con new Date('aaaa-mm-dd'): esa forma se
// interpreta como medianoche UTC y en Chile devuelve el día anterior.
const fromInputValue = (value: string): Date | null => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

export const DateField: React.FC<{
    value: Date | null;
    onChange: (date: Date) => void;
    maximumDate?: Date;
    placeholder?: string;
}> = ({ value, onChange, maximumDate, placeholder = 'dd/mm/aaaa' }) => {
    const { theme, fontFamilies, isDarkMode } = useTheme();
    const [isPickerVisible, setIsPickerVisible] = useState(false);

    if (Platform.OS === 'web') {
        return React.createElement('input', {
            type: 'date',
            value: value ? toInputValue(value) : '',
            max: maximumDate ? toInputValue(maximumDate) : undefined,
            onChange: (event: { target: { value: string } }) => {
                const picked = fromInputValue(event.target.value);
                if (picked) onChange(picked);
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
                // Hace que el calendario propio del navegador siga el tema de
                // la app en vez de salir siempre en claro.
                colorScheme: isDarkMode ? 'dark' : 'light',
            },
        });
    }

    return (
        <>
            <TouchableOpacity
                onPress={() => setIsPickerVisible(true)}
                style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', height: 50, paddingHorizontal: spacing.s16 - 1,
                    borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                    backgroundColor: theme.inputBackground,
                }}
            >
                <Text style={{
                    fontFamily: fontFamilies.body,
                    fontSize: 16,
                    color: value ? theme.text : theme.placeholder,
                }}>
                    {value ? formatDate(value) : placeholder}
                </Text>
                <Ionicons name="calendar-outline" size={20} color={theme.textFaint} />
            </TouchableOpacity>

            <DateTimePickerModal
                isVisible={isPickerVisible}
                mode="date"
                date={value ?? new Date(1995, 0, 1)}
                maximumDate={maximumDate}
                onConfirm={(date) => { onChange(date); setIsPickerVisible(false); }}
                onCancel={() => setIsPickerVisible(false)}
                locale="es_ES"
                confirmTextIOS="Confirmar"
                cancelTextIOS="Cancelar"
            />
        </>
    );
};
