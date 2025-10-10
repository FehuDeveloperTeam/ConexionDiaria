import { Stack } from 'expo-router';
import React from 'react';

const RootLayout: React.FC = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Bienvenida' }} />
      <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
      <Stack.Screen name="register" options={{ title: 'Crear Cuenta' }} />
      <Stack.Screen name="home" options={{ title: 'Mi Conexión Diaria' }} />
    </Stack>
  );
}

export default RootLayout;