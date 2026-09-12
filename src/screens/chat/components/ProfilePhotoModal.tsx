import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image, useColorScheme, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { themes } from '../../../config/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Modal para ver foto de perfil de la pareja
export const ProfilePhotoModal: React.FC<{
    visible: boolean;
    photoURL?: string;
    name: string;
    size: 'medium' | 'full';
    onClose: () => void;
    onExpand: () => void;
}> = ({ visible, photoURL, name, size, onClose, onExpand }) => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}
            >
                {/* Botón Cerrar */}
                <TouchableOpacity
                    style={{
                        position: 'absolute',
                        top: 50,
                        right: 20,
                        zIndex: 10,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: 20,
                        padding: 8,
                    }}
                    onPress={onClose}
                >
                    <Ionicons name="close" size={28} color="#FFF" />
                </TouchableOpacity>

                {/* Foto de perfil */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={size === 'medium' ? onExpand : undefined}
                    style={{
                        alignItems: 'center',
                    }}
                >
                    {photoURL ? (
                        <Image
                            source={{ uri: photoURL }}
                            style={{
                                width: size === 'medium' ? 200 : SCREEN_WIDTH,
                                height: size === 'medium' ? 200 : SCREEN_HEIGHT * 0.8,
                                borderRadius: size === 'medium' ? 100 : 0,
                                resizeMode: size === 'medium' ? 'cover' : 'contain',
                            }}
                        />
                    ) : (
                        <View style={{
                            width: size === 'medium' ? 200 : 300,
                            height: size === 'medium' ? 200 : 300,
                            borderRadius: size === 'medium' ? 100 : 150,
                            backgroundColor: theme.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Text style={{
                                color: theme.white,
                                fontSize: size === 'medium' ? 80 : 120,
                                fontWeight: '600',
                            }}>
                                {name?.charAt(0).toUpperCase() || '❤️'}
                            </Text>
                        </View>
                    )}

                    {size === 'medium' && (
                        <Text style={{
                            color: '#FFF',
                            fontSize: 24,
                            fontWeight: '600',
                            marginTop: 20,
                        }}>
                            {name}
                        </Text>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};
