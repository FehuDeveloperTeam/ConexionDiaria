// Estados de entrega — Sprint 7.4a. Solo en mensajes propios: enviado
// (un check), entregado (done_all gris) y leído (done_all en acento).
// No hay un estado "enviando" propio: el modelo de datos no distingue
// "escribiendo en Firestore" de "ya escrito" en el mensaje optimista.
import React from 'react';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExtendedMessage } from '../types';

export const MessageStatus: React.FC<{ message: ExtendedMessage; isOwn: boolean }> = ({ message, isOwn }) => {
    const colorScheme = useColorScheme() || 'light';
    if (!isOwn || message.deleted) return null;

    if (message.read) {
        // Acento sobre fondo violeta (spec): #B9F0FF en claro, el propio
        // primary lavanda en oscuro.
        const color = colorScheme === 'dark' ? '#BB86FC' : '#B9F0FF';
        return <Ionicons name="checkmark-done" size={15} color={color} style={{ marginLeft: 4 }} />;
    }

    if (message.delivered) {
        const color = colorScheme === 'dark' ? '#87878F' : 'rgba(255,255,255,0.75)';
        return <Ionicons name="checkmark-done" size={15} color={color} style={{ marginLeft: 4 }} />;
    }

    return <Ionicons name="checkmark" size={15} color="rgba(255,255,255,0.75)" style={{ marginLeft: 4 }} />;
};
