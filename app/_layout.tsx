import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../src/config/firebaseConfig'; // Asegúrate que la ruta sea correcta
import { themes } from '../src/config/theme'; // Asegúrate que la ruta sea correcta
import { PlanProvider } from '../src/contexts/planContext';
import Purchases from 'react-native-purchases';
// Hook personalizado para gestionar el estado de autenticación
function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { user, loading };
}



const RootLayout: React.FC = () => {
    const { user, loading } = useAuth();
    const router = useRouter();
    const segments = useSegments();
    const colorScheme = useColorScheme() || 'light';
    
    // Usamos 'dark' o 'light' para seleccionar el tema, no el ThemeProvider de React Navigation por ahora
    const theme = themes[colorScheme]; 

    useEffect(() => {
        if (loading) return; // Esperar a que termine la comprobación de auth

        // --- ¡LÓGICA CORREGIDA! ---
        const inAppGroup = segments[0] === '(tabs)';

        if (user && !inAppGroup) {
            // Usuario está logueado, pero NO está en el grupo (tabs).
            // (Ej. está en 'index', 'login' o 'register').
            // Lo forzamos a entrar a la app.
            router.replace('/(tabs)/home');
        } else if (!user && inAppGroup) {
            // Usuario NO está logueado, pero está intentando acceder a una ruta protegida en (tabs).
            // Lo expulsamos al landing page (la raíz).
            router.replace('/');
        }
        // Si user && inAppGroup -> No hacer nada (está donde debe)
        // Si !user && !inAppGroup -> No hacer nada (está en login, register o index, que es donde debe)

    }, [user, loading, segments, router]);

    useEffect(() => {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG); // O INFO en prod
        // ¡Recuerda poner tu clave pública de Apple o Google aquí si no usas la extensión de Expo!
        Purchases.configure({ apiKey: "TU_API_KEY_PUBLICA_DE_REVENUECAT" });
    }, []);

    // Pantalla de carga mientras se verifica la sesión
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    // Renderizamos el Stack principal
    return (
        <PlanProvider>
        <SafeAreaProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
                {/* La pantalla raíz (Landing) */}
                <Stack.Screen name="index" />
                {/* Las pantallas de Login/Register */}
                <Stack.Screen name="login" options={{ 
                    title: 'Iniciar Sesión', 
                    headerShown: true,
                    headerStyle: { backgroundColor: theme.background },
                    headerTintColor: theme.text,
                }} />
                <Stack.Screen name="register" options={{ 
                    title: 'Crear Cuenta', 
                    headerShown: true,
                    headerStyle: { backgroundColor: theme.background },
                    headerTintColor: theme.text,
                }} />
                {/* El grupo de pestañas (la app protegida) */}
                <Stack.Screen name="(tabs)" />
                {/* <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} /> */}
            </Stack>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Toast />
        </SafeAreaProvider>
    </PlanProvider>
    );
}

export default RootLayout;