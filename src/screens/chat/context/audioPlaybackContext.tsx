// Estado de reproducción de notas de voz, repartido por contexto — Sprint 9.1.
//
// Por qué contexto y no props: GiftedChat memoiza cada fila de la lista
// (`Message` está envuelto en React.memo) y su comparador solo mira
// currentMessage/previousMessage/nextMessage — ignora 'renderBubble'. Como el
// mensaje no cambia cuando alguien le da play, la fila se saltaba el render y
// la burbuja seguía dibujando el cierre viejo: el botón nunca pasaba de play a
// pausa aunque el audio sí estuviera sonando.
//
// Las actualizaciones de contexto no se detienen en un React.memo: React avisa
// directamente a los componentes suscritos. Así la burbuja de audio se entera
// del cambio aunque la fila que la contiene se haya saltado el render, y de
// paso solo se redibujan las burbujas de audio y no la conversación entera.
import React, { createContext, useContext } from 'react';
import { ExtendedMessage } from '../types';

export interface AudioPlaybackValue {
    currentlyPlayingId: string | null;
    audioProgress: { [key: string]: number };
    audioDurations: { [key: string]: number };
    isLoadingAudio: string | null;
    toggleAudioPlayback: (message: ExtendedMessage) => Promise<void>;
    formatAudioDuration: (milliseconds: number) => string;
}

const AudioPlaybackContext = createContext<AudioPlaybackValue | null>(null);

export const AudioPlaybackProvider: React.FC<{
    value: AudioPlaybackValue;
    children: React.ReactNode;
}> = ({ value, children }) => (
    <AudioPlaybackContext.Provider value={value}>
        {children}
    </AudioPlaybackContext.Provider>
);

export function useAudioPlaybackContext(): AudioPlaybackValue {
    const value = useContext(AudioPlaybackContext);
    if (!value) {
        throw new Error('useAudioPlaybackContext debe usarse dentro de AudioPlaybackProvider');
    }
    return value;
}
