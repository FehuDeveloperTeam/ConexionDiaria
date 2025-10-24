import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import { themes } from '../../src/config/theme'; // Asegúrate que la ruta sea correcta

const TabLayout: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.placeholder,
                tabBarStyle: {
                    backgroundColor: theme.background,
                    borderTopColor: theme.borderColor,
                },
                headerStyle: {
                    backgroundColor: theme.background,
                },
                headerTintColor: theme.text,
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: 'Inicio',
                    tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={24} color={color} />,
                    headerShown: false, // Para usar nuestro header personalizado
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: 'Notas',
                    tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={24} color={color} />,
                    headerShown: false,
                }}
            />
            
            {/* --- ¡NUEVA PESTAÑA DE TAREAS AÑADIDA AQUÍ! --- */}
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tareas',
                    tabBarIcon: ({ color }) => <Ionicons name="checkmark-done-outline" size={24} color={color} />,
                    headerShown: false,
                }}
            />

            <Tabs.Screen
                name="album"
                options={{
                    title: 'Álbum',
                    tabBarIcon: ({ color }) => <Ionicons name="images-outline" size={24} color={color} />,
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="config"
                options={{
                    title: 'Ajustes',
                    tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
                    headerShown: false,
                }}
            />
            
            {/* Ocultamos las pantallas que no son pestañas (como login, register, etc.) */}
            {/* Expo Router lo maneja automáticamente si no están en esta lista */}
            
        </Tabs>
    );
};

export default TabLayout;