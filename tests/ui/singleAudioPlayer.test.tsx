// El núcleo del reproductor — Sprint 11.8.
//
// Esta máquina de estados costó tres intentos arreglarla en el chat (Sprint
// 9.1) y los síntomas eran: dos audios sonando a la vez, el botón que no
// cambiaba de play a pausa, y no poder pausar. Las dos decisiones que la
// arreglaron son las que estas pruebas fijan:
//
//   1. El sonido activo vive en un ref, no en estado. Quien decide si pausar o
//      cargar otro necesita el valor de AHORA; con un useState a medio aplicar
//      terminaban sonando los dos.
//   2. Cada intento lleva un número. Si mientras uno carga se toca otro audio,
//      el que llega tarde ve que su número quedó obsoleto y no suena.
//
// La misma máquina está duplicada en src/screens/chat/hooks/useAudioPlayback.ts
// (ver el comentario de ambos archivos). Estas pruebas cubren la copia
// compartida, que es la que usan las Notas.
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useSingleAudioPlayer } from '../../src/hooks/useSingleAudioPlayer';

// Cada sonido simulado registra lo que le hicieron, para poder afirmar que se
// pausó de verdad y que el obsoleto se descargó.
const sonidos: any[] = [];

const crearSonido = () => {
    const sonido = {
        playAsync: jest.fn(() => Promise.resolve()),
        pauseAsync: jest.fn(() => Promise.resolve()),
        unloadAsync: jest.fn(() => Promise.resolve()),
        setOnPlaybackStatusUpdate: jest.fn(),
        getStatusAsync: jest.fn(() => Promise.resolve({ isLoaded: true, isPlaying: false })),
    };
    sonidos.push(sonido);
    return sonido;
};

jest.mock('expo-av', () => ({
    Audio: {
        setAudioModeAsync: jest.fn(() => Promise.resolve()),
        Sound: {
            createAsync: jest.fn(() => Promise.resolve({ sound: crearSonido() })),
        },
    },
}));

const Sonda = () => {
    const { playingId, loadingId, toggle } = useSingleAudioPlayer();
    return (
        <>
            <Text testID="sonando">{playingId ?? 'nada'}</Text>
            <Text testID="cargando">{loadingId ?? 'nada'}</Text>
            <TouchableOpacity accessibilityLabel="uno" onPress={() => toggle('a1', 'http://x/a1.m4a')}>
                <Text>uno</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="dos" onPress={() => toggle('a2', 'http://x/a2.m4a')}>
                <Text>dos</Text>
            </TouchableOpacity>
        </>
    );
};

describe('useSingleAudioPlayer', () => {
    beforeEach(() => {
        sonidos.length = 0;
        jest.clearAllMocks();
    });

    it('empieza sin nada sonando', () => {
        render(<Sonda />);
        expect(screen.getByTestId('sonando').props.children).toBe('nada');
    });

    it('al tocar un audio queda sonando', async () => {
        render(<Sonda />);
        fireEvent.press(screen.getByLabelText('uno'));
        await waitFor(() => expect(screen.getByTestId('sonando').props.children).toBe('a1'));
        expect(sonidos[0].playAsync).toHaveBeenCalled();
    });

    it('REGRESIÓN: volver a tocar el mismo audio lo PAUSA de verdad', async () => {
        render(<Sonda />);
        fireEvent.press(screen.getByLabelText('uno'));
        await waitFor(() => expect(screen.getByTestId('sonando').props.children).toBe('a1'));

        fireEvent.press(screen.getByLabelText('uno'));
        // No basta con que el botón cambie: el sonido tiene que pausarse.
        await waitFor(() => expect(sonidos[0].pauseAsync).toHaveBeenCalled());
        await waitFor(() => expect(screen.getByTestId('sonando').props.children).toBe('nada'));
    });

    it('REGRESIÓN: tocar otro audio no deja los dos sonando', async () => {
        render(<Sonda />);
        fireEvent.press(screen.getByLabelText('uno'));
        await waitFor(() => expect(screen.getByTestId('sonando').props.children).toBe('a1'));

        fireEvent.press(screen.getByLabelText('dos'));
        await waitFor(() => expect(screen.getByTestId('sonando').props.children).toBe('a2'));

        // El primero quedó descargado, no sonando en paralelo.
        expect(sonidos[0].unloadAsync).toHaveBeenCalled();
        expect(sonidos.length).toBe(2);
    });

    it('REGRESIÓN: una carga que quedó obsoleta no suena tarde', async () => {
        // El segundo toque ocurre mientras el primero todavía está cargando.
        const { Audio } = require('expo-av');
        let resolver: any;
        Audio.Sound.createAsync
            .mockImplementationOnce(() => new Promise((res) => { resolver = () => res({ sound: crearSonido() }); }))
            .mockImplementationOnce(() => Promise.resolve({ sound: crearSonido() }));

        render(<Sonda />);
        fireEvent.press(screen.getByLabelText('uno'));   // queda colgado cargando
        fireEvent.press(screen.getByLabelText('dos'));   // este gana

        await waitFor(() => expect(screen.getByTestId('sonando').props.children).toBe('a2'));

        // Ahora llega la carga vieja: su número quedó obsoleto, así que se
        // descarga en vez de arrancar encima del que ya suena.
        await act(async () => { resolver?.(); });

        expect(screen.getByTestId('sonando').props.children).toBe('a2');
    });
});
