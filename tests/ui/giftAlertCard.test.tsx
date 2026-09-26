// Aviso de regalo — Sprint 11.9.
//
// Estas pruebas cumplen dos funciones: comprueban la separación de planes de
// esta tarjeta (que es de las que más importa, porque es la función estrella)
// y sirven de red para la extracción — si al sacarla de home.tsx se hubiera
// cambiado el comportamiento sin notarlo, acá se vería.
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { GiftAlertCard } from '../../src/screens/home/GiftAlertCard';

jest.mock('../../src/contexts/themeContext', () => {
    const { themes } = require('../../src/config/theme');
    return {
        useTheme: () => ({
            theme: themes.light, isDarkMode: false, fontFamilies: {},
            borderStyle: { key: 'default' },
        }),
    };
});

const ocasion = { label: 'el cumpleaños de Mila', date: new Date(2026, 8, 25), days: 7 };
const intel = {
    wishes: ['Unas zapatillas', 'Un libro'],
    sizes: [{ label: 'Polera', value: 'M' }, { label: 'Calzado', value: '38' }],
};

const props = {
    occasion: ocasion,
    intel: null as any,
    plan: 'free' as 'free' | 'premium',
    onOpenPartnerSheet: jest.fn(),
    onNeedUpgrade: jest.fn(),
};

describe('GiftAlertCard', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sin fecha cerca no se dibuja', () => {
        render(<GiftAlertCard {...props} occasion={null} />);
        expect(screen.queryByText(/Se acerca/)).toBeNull();
    });

    it('anuncia la ocasión y cuántos días faltan', () => {
        render(<GiftAlertCard {...props} />);
        expect(screen.getByText('Se acerca el cumpleaños de Mila')).toBeTruthy();
        expect(screen.getByText('En 7 días')).toBeTruthy();
    });

    it('el mismo día dice "Hoy", no "En 0 días"', () => {
        render(<GiftAlertCard {...props} occasion={{ ...ocasion, days: 0 }} />);
        expect(screen.getByText('Hoy')).toBeTruthy();
    });

    it('en free se muestra la fecha pero no la ayuda', () => {
        // Su cumpleaños no es un secreto que haya que cobrar. Lo que se
        // reserva es qué pidió y qué talla usa.
        render(<GiftAlertCard {...props} plan="free" intel={intel} />);
        expect(screen.getByText('Se acerca el cumpleaños de Mila')).toBeTruthy();
        expect(screen.queryByText('Unas zapatillas')).toBeNull();
        expect(screen.queryByText('Polera M')).toBeNull();
    });

    it('en free el candado lleva al paywall, no a la ficha', () => {
        render(<GiftAlertCard {...props} plan="free" intel={intel} />);
        fireEvent.press(screen.getByText('Ver'));
        expect(props.onNeedUpgrade).toHaveBeenCalled();
        expect(props.onOpenPartnerSheet).not.toHaveBeenCalled();
    });

    it('en premium muestra qué pidió y las tallas', () => {
        render(<GiftAlertCard {...props} plan="premium" intel={intel} />);
        expect(screen.getByText('Unas zapatillas')).toBeTruthy();
        expect(screen.getByText('Polera M')).toBeTruthy();
        expect(screen.getByText('Calzado 38')).toBeTruthy();
    });

    it('en premium sin tallas anotadas invita a la ficha', () => {
        render(<GiftAlertCard {...props} plan="premium" intel={{ wishes: [], sizes: [] }} />);
        expect(screen.getByText('Anota sus tallas para tenerlas a mano')).toBeTruthy();
        fireEvent.press(screen.getByText('Abrir ficha'));
        expect(props.onOpenPartnerSheet).toHaveBeenCalled();
    });

    it('en premium sin deseos lo dice sin dramatizar', () => {
        render(<GiftAlertCard {...props} plan="premium" intel={{ wishes: [], sizes: [] }} />);
        expect(screen.getByText(/No tiene deseos anotados/)).toBeTruthy();
    });
});
