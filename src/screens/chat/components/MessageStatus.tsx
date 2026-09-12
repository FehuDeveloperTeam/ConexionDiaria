import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExtendedMessage } from '../types';

// Componente de palomas de estado - Mejorado estilo WhatsApp
export const MessageStatus: React.FC<{ message: ExtendedMessage; isOwn: boolean }> = ({ message, isOwn }) => {
    if (!isOwn || message.deleted) return null;

    const getStatusIcon = () => {
        if (message.read) {
            return (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginLeft: 2,
                    position: 'relative',
                    width: 16,
                    height: 14,
                }}>
                    <Ionicons
                        name="checkmark"
                        size={14}
                        color="#FF69B4"
                        style={{ position: 'absolute', left: 0 }}
                    />
                    <Ionicons
                        name="checkmark"
                        size={14}
                        color="#FF69B4"
                        style={{ position: 'absolute', left: 4 }}
                    />
                </View>
            );
        }
        if (message.delivered) {
            return (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginLeft: 2,
                    position: 'relative',
                    width: 16,
                    height: 14,
                }}>
                    <Ionicons
                        name="checkmark"
                        size={14}
                        color="#FFF"
                        style={{ position: 'absolute', left: 0 }}
                    />
                    <Ionicons
                        name="checkmark"
                        size={14}
                        color="#FFF"
                        style={{ position: 'absolute', left: 4 }}
                    />
                </View>
            );
        }
        return <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginLeft: 2 }} />;
    };

    return (
        <View style={{ marginLeft: 4 }}>
            {getStatusIcon()}
        </View>
    );
};
