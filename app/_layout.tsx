import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
    Newsreader_400Regular,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Newsreader_700Bold,
    Newsreader_800ExtraBold,
} from '@expo-google-fonts/newsreader';
import {
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
// 1. Ya no necesitamos 'auth' ni 'onAuthStateChanged' aquí
import { toastConfig } from '../src/components/toastConfig';
// 2. Importamos AMBOS providers y el hook 'usePlan'
import { PlanProvider, usePlan } from '../src/contexts/planContext';
import { ThemeProvider, useTheme } from '../src/contexts/themeContext'; // Importamos el nuevo ThemeProvider
import Purchases from 'react-native-purchases';

// Sprint 7.0: mantener la splash nativa visible hasta que las tres
// familias tipográficas del sistema de diseño terminen de cargar — evita
// un parpadeo inicial con la fuente del sistema antes de que aparezca
// Newsreader/Manrope/Poppins.
SplashScreen.preventAutoHideAsync();

// 3. Este componente se encarga de la carga y la redirección
// Se ejecutará *después* de que PlanProvider esté disponible
function AuthRedirect() {
    // 4. Obtenemos el estado de usuario y carga desde nuestro hook
    const { user, isLoading } = usePlan();
    const router = useRouter();
    const segments = useSegments();

    // Obtenemos el tema para la pantalla de carga (Sprint 7.8b: vía
    // useTheme(), para heredar el override de modo oscuro de Ajustes).
    const { theme } = useTheme();

    useEffect(() => {
        if (isLoading) return; // Esperar a que el PlanProvider termine de cargar

        // Antes esto miraba si la ruta estaba dentro del grupo '(tabs)' y
        // mandaba a Inicio cualquier otra. El efecto era que TODA pantalla
        // fuera de las pestañas quedaba inalcanzable estando con sesión
        // iniciada: al abrirla, el guardia la devolvía al instante. Eso dejaba
        // muertas la ficha de la pareja (9.12) y, desde el Sprint 7.8b sin que
        // se notara, también el editor de tema.
        //
        // Lo que de verdad hay que distinguir no es "pestañas o no", sino
        // pública o privada: el landing, login y registro son las tres
        // pantallas donde alguien con sesión no tiene nada que hacer. En la
        // raíz 'segments' viene vacío, así que ese caso se cubre aparte.
        const root = segments[0];
        const onPublicRoute = root === undefined || root === 'login' || root === 'register';

        if (user && onPublicRoute) {
            // Con sesión iniciada no tiene sentido quedarse en el landing.
            router.replace('/(tabs)/home');
        } else if (!user && !onPublicRoute) {
            // Sin sesión, cualquier pantalla privada queda fuera de alcance.
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

// Sprint 7.8b: envoltorio interno al Stack/StatusBar/Toast, para poder
// llamar useTheme() (necesita estar DENTRO de ThemeProvider) y así el
// fondo del Stack y el estilo de la barra de estado también respeten el
// override de modo oscuro y la personalización premium.
function AppShell() {
    const { theme, isDarkMode } = useTheme();

    return (
        <SafeAreaProvider>
            {/* Este Stack SÍEMPRE se renderiza */}
            {/* Sprint 7.2: login y register ya traen su propio back
                arrow y título (Newsreader) dentro del contenido, per
                el sistema de diseño — el header nativo se apaga para
                no duplicar el botón de volver. */}
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="theme-editor" />
                {/* Panel del equipo — Sprint 10.1. Fuera del grupo de
                    pestañas: no le corresponde el riel de la app. */}
                <Stack.Screen name="admin" />
            </Stack>

            {/* Este componente decide si mostrar la carga o redirigir */}
            <AuthRedirect />

            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
            <Toast config={toastConfig} />
        </SafeAreaProvider>
    );
}

const RootLayout: React.FC = () => {
    // Configuración de RevenueCat (ver .env.example para la variable requerida)
    useEffect(() => {
        Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY! });
    }, []);

    // Sprint 7.0: fuentes del sistema de diseño. 'fontError' también libera
    // la splash — mejor una app con la fuente del sistema que una pantalla
    // de carga que nunca termina si algo falla al descargar/registrar una
    // fuente.
    const [fontsLoaded, fontError] = useFonts({
        Newsreader_400Regular,
        // Sprint 8.5: pesos adicionales de Newsreader — antes solo se
        // cargaba el regular (uso exclusivo en títulos/momentos
        // emotivos); el probador de tema ahora puede elegir Newsreader
        // como tipografía de cuerpo, y para eso necesita también semibold/
        // bold/extrabold (las mismas variantes de peso que ya usa Manrope).
        Newsreader_500Medium,
        Newsreader_600SemiBold,
        Newsreader_700Bold,
        Newsreader_800ExtraBold,
        Manrope_500Medium,
        Manrope_600SemiBold,
        Manrope_700Bold,
        Manrope_800ExtraBold,
        Poppins_600SemiBold,
        Poppins_700Bold,
    });

    useEffect(() => {
        if (fontsLoaded || fontError) {
            if (fontError) console.error('Error cargando fuentes del sistema de diseño:', fontError);
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded, fontError]);

    if (!fontsLoaded && !fontError) {
        return null;
    }

    // 8. El 'if (loading)' se ha movido a 'AuthRedirect'

    // 9. Renderizamos los providers y el Stack
    return (
        <PlanProvider>
            <ThemeProvider> {/* <-- Añadimos el ThemeProvider aquí */}
                <AppShell />
            </ThemeProvider>
        </PlanProvider>
    );
}

export default RootLayout;