// El límite de error es la red de seguridad de toda la app: si ÉL falla, la
// pantalla blanca vuelve. Es lo primero que conviene tener cubierto.
import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

// El límite reporta el error, y el reporte sale a la red: se silencia.
jest.mock('../../src/services/errorReporter', () => ({
    captureError: jest.fn(),
}));

const Explota = () => {
    throw new Error('se rompió a propósito');
};

describe('ErrorBoundary', () => {
    // React escribe el error en consola aunque el límite lo atrape; se calla
    // para que la salida de las pruebas sea legible.
    let spy: jest.SpyInstance;
    beforeEach(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
    afterEach(() => { spy.mockRestore(); });

    it('deja pasar a los hijos cuando nada falla', () => {
        render(
            <ErrorBoundary>
                <Text>contenido normal</Text>
            </ErrorBoundary>
        );
        expect(screen.getByText('contenido normal')).toBeTruthy();
    });

    it('muestra la pantalla de disculpa en vez de quedar en blanco', () => {
        render(
            <ErrorBoundary>
                <Explota />
            </ErrorBoundary>
        );
        expect(screen.getByText('Algo se rompió de nuestro lado')).toBeTruthy();
    });

    it('ofrece una salida, no solo un mensaje', () => {
        render(
            <ErrorBoundary>
                <Explota />
            </ErrorBoundary>
        );
        expect(screen.getByLabelText('Volver a intentar')).toBeTruthy();
    });

    it('tranquiliza sobre los datos: lo guardado sigue ahí', () => {
        render(
            <ErrorBoundary>
                <Explota />
            </ErrorBoundary>
        );
        expect(screen.getByText(/No perdiste nada/)).toBeTruthy();
    });

    it('reporta el error para que no pase inadvertido', () => {
        const { captureError } = require('../../src/services/errorReporter');
        render(
            <ErrorBoundary>
                <Explota />
            </ErrorBoundary>
        );
        expect(captureError).toHaveBeenCalled();
        expect(captureError.mock.calls[0][1]).toMatchObject({ origin: 'render', fatal: true });
    });
});
