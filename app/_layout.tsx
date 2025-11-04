import React, { useEffect } from 'react';
import { ActivityIndicator, View, useColorScheme } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// 1. Ya no necesitamos 'auth' ni 'onAuthStateChanged' aquí
import { themes } from '../src/config/theme';
// 2. Importamos AMBOS providers y el hook 'usePlan'
import { PlanProvider, usePlan } from '../src/contexts/planContext';
import { ThemeProvider } from '../src/contexts/themeContext'; // Importamos el nuevo ThemeProvider
import Purchases from 'react-native-purchases';

// 3. Este componente se encarga de la carga y la redirección
// Se ejecutará *después* de que PlanProvider esté disponible
function AuthRedirect() {
    // 4. Obtenemos el estado de usuario y carga desde nuestro hook
    const { user, isLoading } = usePlan();
    const router = useRouter();
    const segments = useSegments();
    
    // Obtenemos el tema para la pantalla de carga
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];

    useEffect(() => {
        if (isLoading) return; // Esperar a que el PlanProvider termine de cargar

        const inAppGroup = segments[0] === '(tabs)';

        if (user && !inAppGroup) {
            // Usuario logueado, pero fuera de la app (ej. en 'index' o 'login')
            // Lo forzamos a entrar
            router.replace('/(tabs)/home');
        } else if (!user && inAppGroup) {
            // Usuario no logueado, pero intentando acceder a una ruta protegida
            // Lo expulsamos al landing (raíz)
            router.replace('/');
        }
        // (Los otros casos son correctos y no se hace nada)

    }, [user, isLoading, segments, router]); // Depende del estado del PlanProvider

    // 5. Mostramos la pantalla de carga MIENTRAS el PlanProvider esté 'isLoading'
    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    // 6. Una vez cargado, no renderiza nada y deja que el <Stack> se muestre
    return null;
}

const RootLayout: React.FC = () => {
    // 7. El hook 'useAuth' se ha eliminado.
    // El 'colorScheme' y 'theme' se usarán para las pantallas del Stack (login/register)
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme]; 

    // Configuración de RevenueCat (esto está perfecto)
    useEffect(() => {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: "test_yfFeKwhFksqSJrdAoTzTKOmxkKX" });
    }, []);

    // 8. El 'if (loading)' se ha movido a 'AuthRedirect'

    // 9. Renderizamos los providers y el Stack
    return (
        <PlanProvider>
            <ThemeProvider> {/* <-- Añadimos el ThemeProvider aquí */}
                <SafeAreaProvider>
                    
                    {/* Este Stack SÍEMPRE se renderiza */}
                    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
                        <Stack.Screen name="index" />
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
                        <Stack.Screen name="(tabs)" />
                    </Stack>
                    
                    {/* Este componente decide si mostrar la carga o redirigir */}
                    <AuthRedirect />

                    <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
                    <Toast />
                </SafeAreaProvider>
            </ThemeProvider>
        </PlanProvider>
    );
}

export default RootLayout;