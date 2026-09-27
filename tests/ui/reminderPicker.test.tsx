// Selector del recordatorio — Sprint 10.3c.
//
// Reemplazó a un interruptor sí/no. Lo que se prueba es lo que el interruptor
// no tenía: a quién avisa, con cuánta anticipación, y que no se pueda elegir
// una anticipación que ya pasó (el servidor la descartaría sin avisar).
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ReminderPicker } from '../../src/components/ReminderPicker';

jest.mock('../../src/contexts/themeContext', () => {
    const { themes } = require('../../src/config/theme');
    return {
        useTheme: () => ({
            theme: themes.light, isDarkMode: false, fontFamilies: {},
            borderStyle: { key: 'default' },
        }),
    };
});

// Evento a las 20:00 del 24; "ahora" es el mediodía del mismo día.
const evento = new Date('2026-12-24T23:00:00Z');
const ahora = new Date('2026-12-24T15:00:00Z');

const base = {
    choice: { notify: null, lead: 60 } as const,
    eventDate: evento,
    partnerName: 'Carol',
    locked: false,
    onChange: jest.fn(),
    onLockedPress: jest.fn(),
    now: ahora,
};

describe('ReminderPicker', () => {
    beforeEach(() => jest.clearAllMocks());

    it('ofrece las cuatro opciones y nombra a la pareja', () => {
        render(<ReminderPicker {...base} />);
        for (const label of ['Sin aviso', 'A mí', 'A Carol', 'A los dos']) {
            expect(screen.getByLabelText(label)).toBeTruthy();
        }
    });

    it('sin aviso no pregunta cuándo', () => {
        render(<ReminderPicker {...base} />);
        expect(screen.queryByText('¿Cuándo?')).toBeNull();
    });

    it('elegir "a los dos" conserva la anticipación elegida', () => {
        render(<ReminderPicker {...base} />);
        fireEvent.press(screen.getByLabelText('A los dos'));
        expect(base.onChange).toHaveBeenCalledWith({ notify: 'both', lead: 60 });
    });

    it('con aviso activado, pregunta cuándo y marca la elegida', () => {
        render(<ReminderPicker {...base} choice={{ notify: 'both', lead: 60 }} />);
        expect(screen.getByText('¿Cuándo?')).toBeTruthy();
        expect(screen.getByLabelText('1 hora antes').props.accessibilityState).toMatchObject({ selected: true });
    });

    it('REGRESIÓN: una anticipación que ya pasó se ve pero no se puede elegir', () => {
        // Para un evento de hoy en la noche, "1 día antes" fue ayer.
        render(<ReminderPicker {...base} choice={{ notify: 'both', lead: 60 }} />);
        const pasada = screen.getByLabelText('1 día antes, ya pasó');
        expect(pasada.props.accessibilityState).toMatchObject({ disabled: true });
        fireEvent.press(pasada);
        expect(base.onChange).not.toHaveBeenCalled();
    });

    it('una anticipación que todavía no pasa sí se puede elegir', () => {
        render(<ReminderPicker {...base} choice={{ notify: 'both', lead: 60 }} />);
        fireEvent.press(screen.getByLabelText('15 min antes'));
        expect(base.onChange).toHaveBeenCalledWith({ notify: 'both', lead: 15 });
    });

    it('en free se ve bloqueado y tocarlo abre el paywall', () => {
        render(<ReminderPicker {...base} locked />);
        expect(screen.queryByLabelText('A los dos')).toBeNull();
        fireEvent.press(screen.getByLabelText('Recordatorio, disponible en Conexión Total'));
        expect(base.onLockedPress).toHaveBeenCalled();
    });
});
