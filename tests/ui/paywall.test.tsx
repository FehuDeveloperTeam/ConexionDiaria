// El paywall — Sprint 11.6.
//
// Este cartel tenía los precios escritos a mano como valores por defecto:
// decía "-70% HOY" los 365 días del año y prometía US$2,99 aunque ya no
// quedaran cupos de fundador. Un cartel que miente sobre el precio no es un
// detalle de diseño: es lo que va a reclamar quien pague otra cosa.
//
// Estas pruebas fijan la regla que lo reemplazó: lo que se muestra sale del
// paquete que se va a cobrar, y si no hay paquete no se inventa ningún precio.
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaywallSheet } from '../../src/components/PaywallSheet';

import type { PricingOffer } from '../../src/services/pricing';

const mockPricing: {
    offer: PricingOffer;
    monthly: any;
    annual: any;
    listMonthlyPrice: string | null;
    isLoading: boolean;
    purchase: jest.Mock;
} = {
    offer: { tier: 'list', offeringId: 'default', discountLabel: '', reason: null, foundersLeft: 0 },
    monthly: null,
    annual: null,
    listMonthlyPrice: null,
    isLoading: false,
    purchase: jest.fn(),
};

jest.mock('../../src/hooks/usePricing', () => ({
    usePricing: () => mockPricing,
}));

jest.mock('../../src/hooks/useResponsive', () => ({
    useResponsive: () => ({ isDesktop: false }),
    SIDEBAR_WIDTH: 240,
}));

jest.mock('../../src/contexts/themeContext', () => {
    const { themes } = require('../../src/config/theme');
    return {
        useTheme: () => ({
            theme: themes.light,
            isDarkMode: false,
            fontFamilies: {},
            borderStyle: { key: 'default' },
        }),
    };
});

const props = {
    visible: true,
    onClose: jest.fn(),
    onUpgradePress: jest.fn(),
    icon: 'gift' as const,
    title: 'Desbloquea la ficha',
    description: 'Tallas y notas privadas.',
    benefits: ['Ficha de la pareja', 'Aviso de regalo'],
};

describe('PaywallSheet', () => {
    beforeEach(() => {
        mockPricing.monthly = null;
        mockPricing.annual = null;
        mockPricing.listMonthlyPrice = null;
        mockPricing.offer = { tier: 'list', offeringId: 'default', discountLabel: '', reason: null, foundersLeft: 0 };
    });

    it('REGRESIÓN: sin paquete cargado no inventa ningún precio', () => {
        render(<PaywallSheet {...props} />);
        // Ni el precio viejo escrito a mano, ni un cero, ni un guion.
        expect(screen.queryByText(/US\$/)).toBeNull();
        expect(screen.queryByText('/ mes')).toBeNull();
        // Pero el botón sigue estando: mejor un cartel sin precio que ninguno.
        expect(screen.getByText('Actualizar a Conexión Total')).toBeTruthy();
    });

    it('muestra el precio que de verdad se va a cobrar', () => {
        mockPricing.monthly = { product: { priceString: 'US$7,99' } };
        render(<PaywallSheet {...props} />);
        expect(screen.getByText('US$7,99')).toBeTruthy();
        expect(screen.getByText('/ mes')).toBeTruthy();
    });

    it('REGRESIÓN: sin descuento vigente no hay sello ni precio tachado', () => {
        mockPricing.monthly = { product: { priceString: 'US$7,99' } };
        render(<PaywallSheet {...props} />);
        expect(screen.queryByText(/%/)).toBeNull();
    });

    it('con descuento vigente muestra el sello y explica por qué', () => {
        mockPricing.monthly = { product: { priceString: 'US$2,99' } };
        mockPricing.listMonthlyPrice = 'US$7,99';
        mockPricing.offer = {
            tier: 'founder', offeringId: 'founders', discountLabel: '-70%',
            reason: 'Quedan 340 cupos de fundador', foundersLeft: 340,
        };
        render(<PaywallSheet {...props} />);

        expect(screen.getByText('US$2,99')).toBeTruthy();
        expect(screen.getByText('US$7,99')).toBeTruthy();   // el tachado
        expect(screen.getByText('-70%')).toBeTruthy();
        // La otra mitad del trabajo: un descuento sin motivo se lee como
        // precio inflado el resto del año.
        expect(screen.getByText('Quedan 340 cupos de fundador')).toBeTruthy();
    });

    it('no dibuja nada cuando está cerrado', () => {
        render(<PaywallSheet {...props} visible={false} />);
        expect(screen.queryByText('Desbloquea la ficha')).toBeNull();
    });
});
