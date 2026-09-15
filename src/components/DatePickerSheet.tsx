// Selector de fecha que también funciona en web.
//
// El problema: react-native-modal-datetime-picker envuelve a
// @react-native-community/datetimepicker, que NO trae implementación web —
// en node_modules hay .android.js, .ios.js y .windows.js, pero ningún
// .web.js. En el navegador el modal no dibuja nada, así que tocar el campo
// parecía no hacer absolutamente nada. Eso dejaba la fecha de nacimiento
// imposible de fijar desde el navegador y, como en el registro es
// obligatoria, tampoco se podía crear una cuenta desde ahí.
//
// La salida no es otra librería: en web la app corre sobre React DOM, así
// que se puede usar un <input type="date"> de verdad y aprovechar el
// selector del navegador. Va transparente ENCIMA del campo en vez de
// oculto, porque los navegadores solo abren el selector ante un gesto sobre
// un elemento real: un input escondido no se abre solo. Para quien usa la
// app el gesto sigue siendo "toqué el campo y se abrió el selector".
//
// En móvil se sigue usando el modal de siempre, que ahí sí funciona.
import React from 'react';
import { Platform } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

// Formato que exige <input type="date">: siempre aaaa-mm-dd, sin importar el
// idioma del equipo. Lo que ve la persona lo decide el navegador; esto es
// solo el valor interno.
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

/**
 * En web se dibuja como una capa transparente que cubre a su contenedor, así
 * que hay que ponerlo DENTRO del elemento que hace de campo. En nativo no
 * ocupa espacio: es el modal, gobernado por 'isVisible'.
 */
export const DatePickerSheet: React.FC<{
    isVisible: boolean;
    date: Date;
    maximumDate?: Date;
    onConfirm: (date: Date) => void;
    onCancel: () => void;
}> = ({ isVisible, date, maximumDate, onConfirm, onCancel }) => {
    if (Platform.OS === 'web') {
        return React.createElement('input', {
            type: 'date',
            value: toInputValue(date),
            max: maximumDate ? toInputValue(maximumDate) : undefined,
            'aria-label': 'Fecha',
            onChange: (event: { target: { value: string } }) => {
                const picked = fromInputValue(event.target.value);
                if (picked) onConfirm(picked);
            },
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                border: 'none',
                padding: 0,
                margin: 0,
                background: 'transparent',
            },
        });
    }

    return (
        <DateTimePickerModal
            isVisible={isVisible}
            mode="date"
            date={date}
            maximumDate={maximumDate}
            onConfirm={onConfirm}
            onCancel={onCancel}
            locale="es_ES"
            confirmTextIOS="Confirmar"
            cancelTextIOS="Cancelar"
        />
    );
};
