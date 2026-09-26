// La fila de tallas — Sprint 11.6.
//
// Acá hubo dos errores reportados en la revisión: el tick que no distinguía lo
// guardado de lo que se está escribiendo, y la precedencia al revés (lo que
// anotaba uno pesaba más que lo que la propia persona declaraba de sí misma).
// La regla quedó: lo que ella declara manda y no se edita acá.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MeasurementRow } from '../../src/components/MeasurementRow';

jest.mock('../../src/contexts/themeContext', () => {
    const { themes } = require('../../src/config/theme');
    return {
        useTheme: () => ({
            theme: themes.light, isDarkMode: false, fontFamilies: {},
            borderStyle: { key: 'default' },
        }),
    };
});

const base = {
    label: 'Polera',
    value: '',
    placeholder: 'M',
    saved: false,
    onChangeText: jest.fn(),
};

describe('MeasurementRow', () => {
    beforeEach(() => jest.clearAllMocks());

    it('un dato sin guardar se marca como pendiente', () => {
        render(<MeasurementRow {...base} />);
        expect(screen.getByLabelText('Sin ingresar')).toBeTruthy();
    });

    it('un dato guardado se marca como ingresado', () => {
        render(<MeasurementRow {...base} value="M" saved />);
        expect(screen.getByLabelText('Dato ingresado')).toBeTruthy();
    });

    it('REGRESIÓN: el tick sigue gris mientras se escribe, si aún no se guardó', () => {
        // Es el caso que importa: hay texto en el campo pero 'saved' es false.
        render(<MeasurementRow {...base} value="M" saved={false} />);
        expect(screen.getByLabelText('Sin ingresar')).toBeTruthy();
        expect(screen.queryByLabelText('Dato ingresado')).toBeNull();
    });

    it('lo que uno anota sí se puede editar', () => {
        render(<MeasurementRow {...base} />);
        fireEvent.changeText(screen.getByLabelText('Polera'), 'L');
        expect(base.onChangeText).toHaveBeenCalledWith('L');
    });

    it('REGRESIÓN: lo que declaró la pareja NO se puede editar acá', () => {
        // Un campo escribible cuyo contenido se ignora es peor que no tener el
        // campo: escribir ahí se sentiría como corregir algo y no corregiría
        // nada.
        render(
            <MeasurementRow
                {...base}
                value="M"
                saved
                readOnly
                sourceNote="Lo puso Mila"
            />
        );
        expect(screen.queryByLabelText('Polera')).toBeNull();
        expect(screen.getByText('M')).toBeTruthy();
        expect(screen.getByText('Lo puso Mila')).toBeTruthy();
    });

    it('la procedencia le gana a la ayuda de formato', () => {
        render(
            <MeasurementRow
                {...base}
                hint="En centímetros"
                sourceNote="Lo puso Mila"
                value="39"
                saved
                readOnly
            />
        );
        expect(screen.getByText('Lo puso Mila')).toBeTruthy();
        expect(screen.queryByText('En centímetros')).toBeNull();
    });

    it('sin valor en modo lectura muestra un guion, no un campo vacío', () => {
        render(<MeasurementRow {...base} readOnly />);
        expect(screen.getByText('—')).toBeTruthy();
    });
});
