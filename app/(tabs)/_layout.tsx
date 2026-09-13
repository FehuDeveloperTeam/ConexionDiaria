import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, useColorScheme } from 'react-native';
import { themes, fontFamilies } from '../../src/config/theme'; // Asegúrate que la ruta sea correcta

// Sprint 7.1: ícono con el pill de fondo detrás cuando el tab está activo
// (ver README del bundle de diseño, sección "Navegación"). Un solo
// renderer parametrizado por nombre en vez de repetirlo en las 8 pestañas.
const makeTabIcon = (name: keyof typeof Ionicons.glyphMap, pillColor: string) => {
    function TabIcon({ focused, color }: { focused: boolean; color: string }) {
        return (
            <View
                style={{
                    paddingHorizontal: 13,
                    paddingVertical: 4,
                    borderRadius: 11,
                    backgroundColor: focused ? pillColor : 'transparent',
                }}
            >
                <Ionicons name={name} size={21} color={color} />
            </View>
        );
    }
    return TabIcon;
};

const TabLayout: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textFaint,
                tabBarLabelStyle: { fontFamily: fontFamilies.action, fontSize: 8.5 },
                tabBarStyle: {
                    backgroundColor: theme.surface,
                    borderTopColor: theme.borderSoft,
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
                    tabBarIcon: makeTabIcon('home-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: makeTabIcon('chatbubbles-outline', theme.primarySoft),
                    headerShown: false, // Para usar nuestro header personalizado
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: 'Notas',
                    tabBarIcon: makeTabIcon('document-text-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />

            {/* --- ¡NUEVA PESTAÑA DE TAREAS AÑADIDA AQUÍ! --- */}
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tareas',
                    tabBarIcon: makeTabIcon('checkmark-done-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />

            <Tabs.Screen
                name="wishlist"
                options={{
                    title: 'Deseos',
                    tabBarIcon: makeTabIcon('star-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />

            <Tabs.Screen
                name="album"
                options={{
                    title: 'Álbum',
                    tabBarIcon: makeTabIcon('images-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: 'Calendario',
                    tabBarIcon: makeTabIcon('calendar-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="config"
                options={{
                    title: 'Ajustes',
                    tabBarIcon: makeTabIcon('settings-outline', theme.primarySoft),
                    headerShown: false,
                }}
            />

            {/* Ocultamos las pantallas que no son pestañas (como login, register, etc.) */}
            {/* Expo Router lo maneja automáticamente si no están en esta lista */}

        </Tabs>
    );
};

export default TabLayout;
