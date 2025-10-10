import { Stack } from 'expo-router';
import React from 'react';
import Toast from 'react-native-toast-message'; // <-- 1. Importa Toast

const RootLayout: React.FC = () => {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} /> 
        <Stack.Screen name="login" options={{ title: 'Iniciar Sesión' }} />
        <Stack.Screen name="register" options={{ title: 'Crear Cuenta' }} />
        <Stack.Screen name="home" options={{ title: 'Mi Conexión Diaria', headerShown: false }} />
      </Stack>
      <Toast /> {/* <-- 2. Añade el componente Toast aquí al final */}
    </>
  );
}

export default RootLayout;