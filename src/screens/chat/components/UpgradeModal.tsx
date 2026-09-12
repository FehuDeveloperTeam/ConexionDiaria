import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

// Modal de Upgrade Premium
export const UpgradeModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    usedStorage: number;
    maxStorage: number;
}> = ({ visible, onClose, usedStorage, maxStorage }) => {
    const usedMB = (usedStorage / (1024 * 1024)).toFixed(2);
    const maxMB = (maxStorage / (1024 * 1024)).toFixed(0);

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
            }}>
                <View style={{
                    backgroundColor: '#FFF',
                    borderRadius: 20,
                    padding: 24,
                    width: '90%',
                    maxWidth: 400,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}>
                    {/* Icono */}
                    <View style={{
                        alignItems: 'center',
                        marginBottom: 20,
                    }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: '#FFE5F0',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Ionicons name="cloud-upload" size={40} color="#FF69B4" />
                        </View>
                    </View>

                    {/* Título */}
                    <Text style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: '#1a1a1a',
                        textAlign: 'center',
                        marginBottom: 12,
                    }}>
                        Almacenamiento Lleno
                    </Text>

                    {/* Descripción */}
                    <Text style={{
                        fontSize: 16,
                        color: '#666',
                        textAlign: 'center',
                        marginBottom: 20,
                        lineHeight: 24,
                    }}>
                        Has utilizado {usedMB} MB de {maxMB} MB disponibles
                    </Text>

                    {/* Beneficios Premium */}
                    <View style={{
                        backgroundColor: '#F8F8F8',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                    }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: '#1a1a1a',
                            marginBottom: 12,
                        }}>
                            Con Premium obtendrás:
                        </Text>

                        <View style={{ }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    25 GB de almacenamiento
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    Envío ilimitado de multimedia
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    Calidad original sin compresión
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#333' }}>
                                    Respaldo de conversaciones
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Botones */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#FF69B4',
                            borderRadius: 12,
                            paddingVertical: 14,
                            marginBottom: 12,
                            shadowColor: '#FF69B4',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                        onPress={() => {
                            // TODO: Navegar a pantalla de compra Premium
                            Toast.show({
                                type: 'info',
                                text1: 'Próximamente',
                                text2: 'La pantalla de upgrade estará disponible pronto',
                            });
                            onClose();
                        }}
                    >
                        <Text style={{
                            color: '#FFF',
                            fontSize: 16,
                            fontWeight: '600',
                            textAlign: 'center',
                        }}>
                            Actualizar a Premium
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            paddingVertical: 12,
                        }}
                        onPress={onClose}
                    >
                        <Text style={{
                            color: '#666',
                            fontSize: 14,
                            textAlign: 'center',
                        }}>
                            Cerrar
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
