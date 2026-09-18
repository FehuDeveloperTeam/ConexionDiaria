// La bienvenida — Sprint 11.6.
//
// Esta pantalla ya tuvo el peor error de todo el proyecto: rebotaba en bucle
// entre ella misma y el inicio, sin forma de salir. La causa fue usar
// serverTimestamp() para una decisión inmediata: Firestore entrega el snapshot
// local al instante con ese campo en null, el guardia leía ese null como
// "todavía no la ha visto" y devolvía acá.
//
// Las dos primeras pruebas de abajo son la regresión de ese error, y son el
// motivo por el que esta suite existe.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { setDoc, Timestamp } from 'firebase/firestore';
import WelcomeScreen from '../../app/welcome';
import { wasOnboardingDismissed } from '../../src/services/onboardingSession';

// El prefijo 'mock' no es estilo: jest iza las llamadas a jest.mock() por
// encima de las declaraciones, y solo permite referenciar variables cuyo
// nombre empiece así.
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

jest.mock('../../src/contexts/planContext', () => ({
    usePlan: () => ({
        user: { uid: 'uid-de-prueba' },
        userData: { partnerId: 'uid-pareja' },
        partnerData: { displayName: 'Mila' },
        plan: 'free',
        isLoading: false,
    }),
}));

jest.mock('../../src/contexts/themeContext', () => {
    const { themes } = require('../../src/config/theme');
    return {
        useTheme: () => ({
            theme: themes.light,
            isDarkMode: false,
            fontFamilies: {
                display: undefined, body: undefined, bodySemiBold: undefined,
                bodyBold: undefined, bodyExtraBold: undefined,
                action: undefined, actionBold: undefined,
            },
            borderStyle: { key: 'default' },
        }),
    };
});

describe('Bienvenida', () => {
    beforeEach(() => jest.clearAllMocks());

    it('habla de la pareja por su nombre, no en abstracto', () => {
        render(<WelcomeScreen />);
        // El nombre aparece en el título y en el cuerpo del primer paso: la
        // bienvenida no dice "tu pareja", dice cómo se llama.
        expect(screen.getByText('Ya están conectados con Mila')).toBeTruthy();
        expect(screen.getAllByText(/Mila/).length).toBeGreaterThan(1);
    });

    it('REGRESIÓN: al saltar marca la bienvenida con una hora del cliente, no del servidor', async () => {
        render(<WelcomeScreen />);
        fireEvent.press(screen.getByLabelText('Saltar la bienvenida'));

        await waitFor(() => expect(setDoc).toHaveBeenCalled());

        // Lo que importa: que el valor exista de inmediato. serverTimestamp()
        // llega en null al snapshot local y eso era el bucle.
        expect(Timestamp.now).toHaveBeenCalled();
        const escrito = (setDoc as jest.Mock).mock.calls[0][1];
        expect(escrito.onboardedAt).toBeDefined();
        expect(escrito.onboardedAt).not.toBeNull();
    });

    it('REGRESIÓN: la salida de emergencia queda marcada aunque la escritura falle', async () => {
        (setDoc as jest.Mock).mockRejectedValueOnce(new Error('sin red'));

        render(<WelcomeScreen />);
        fireEvent.press(screen.getByLabelText('Saltar la bienvenida'));

        // Sin esto, una escritura fallida dejaba a la persona encerrada entre
        // la bienvenida y el inicio para siempre.
        await waitFor(() => expect(wasOnboardingDismissed('uid-de-prueba')).toBe(true));
        await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home'));
    });

    it('avanza paso a paso y llega al de notificaciones', () => {
        render(<WelcomeScreen />);

        // Cuatro "Siguiente" para llegar al quinto y último paso.
        for (let i = 0; i < 4; i++) {
            fireEvent.press(screen.getByText('Siguiente'));
        }
        expect(screen.getByText('Activar avisos y empezar')).toBeTruthy();
        // Y en el último paso hay que poder decir que no.
        expect(screen.getByText('Ahora no')).toBeTruthy();
    });

    it('se puede volver atrás en los pasos intermedios', () => {
        render(<WelcomeScreen />);
        fireEvent.press(screen.getByText('Siguiente'));
        expect(screen.getByText('Atrás')).toBeTruthy();
        fireEvent.press(screen.getByText('Atrás'));
        expect(screen.queryByText('Atrás')).toBeNull();
    });
});
