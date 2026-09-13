// En: src/contexts/ThemeContext.tsx

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { themes, ThemeColors } from '../config/theme'; // Asumo que 'themes' exporta tus colores base
import { usePlan } from './planContext'; // Usamos el hook que ya creamos

// Preferencia local de "modo oscuro" — Sprint 7.8a (Ajustes). El sistema
// operativo ya decide un modo por defecto (useColorScheme), pero el switch
// de Ajustes permite forzarlo, guardado en el dispositivo (no en Firestore:
// es una preferencia de aparato, no de la relación).
const DARK_MODE_OVERRIDE_KEY = 'colorSchemeOverride';

// Define la estructura de los settings guardados en Firestore, en
// 'relationships/{id}.settings' — es de la pareja, no de un usuario
// individual (ver probador de tema, sesión 7.8b).
interface PremiumSettings {
    backgroundColor?: string;
    fontFamily?: 'Newsreader_400Regular' | 'Manrope_500Medium' | 'monospace';
    fontColor?: string;
    borderStyle?: string; // key de PREMIUM_BORDER_OPTIONS (ej. 'heartBorder1')
}

export interface PremiumBorderOption {
    key: string;
    name: string;
    background: string;
    borderColor: string;
    borderWidth: number;
    borderRadius: number;
    dashed?: boolean;
    textColor: string;
    icon?: 'heart' | 'none';
    iconColor?: string;
    shadow?: boolean;
}

// --- Los 10 estilos de borde premium (ver README del bundle de diseño,
// sección "13. Probador de tema") — cada uno agrupa fondo/borde/radio/
// texto por defecto; los swatches de FONDO y TEXTO del probador permiten
// pisar el fondo/texto de estos valores sin cambiar la forma del borde.
export const PREMIUM_BORDER_OPTIONS: PremiumBorderOption[] = [
    { key: 'heartBorder1', name: 'Corazón rosado', background: '#FFF4F7', borderColor: '#F5A6C0', borderWidth: 2, borderRadius: 18, textColor: '#7A2E48', icon: 'heart', iconColor: '#E0628D' },
    { key: 'heartBorder2', name: 'Corazón fucsia punteado', background: '#FFF0FA', borderColor: '#E85BC0', borderWidth: 2, borderRadius: 16, dashed: true, textColor: '#7A1660', icon: 'heart', iconColor: '#D22FA0' },
    { key: 'heartBorder3', name: 'Circular', background: '#FFFFFF', borderColor: '#D3D3D3', borderWidth: 2, borderRadius: 999, textColor: '#3A3A44' },
    { key: 'heartBorder4', name: 'Sombra rosa', background: '#FFFFFF', borderColor: '#F3D7E0', borderWidth: 1, borderRadius: 18, textColor: '#3A3A44', shadow: true },
    { key: 'heartBorder5', name: 'Lavanda pastel', background: '#F3EFFF', borderColor: '#C9B8F0', borderWidth: 2, borderRadius: 18, textColor: '#453076' },
    { key: 'heartBorder6', name: 'Azul pastel', background: '#ECF3FF', borderColor: '#A8C6F0', borderWidth: 2, borderRadius: 18, textColor: '#22467A' },
    { key: 'heartBorder7', name: 'Menta pastel', background: '#EAF7F0', borderColor: '#A0D8BC', borderWidth: 2, borderRadius: 18, textColor: '#1E5138' },
    { key: 'heartBorder8', name: 'Limón pastel', background: '#FBF8E0', borderColor: '#DDD180', borderWidth: 2, borderRadius: 18, textColor: '#5C5210' },
    { key: 'heartBorder9', name: 'Durazno pastel', background: '#FFF1E6', borderColor: '#F0BE96', borderWidth: 2, borderRadius: 18, textColor: '#7A4315' },
    { key: 'heartBorder10', name: 'Coral pastel', background: '#FFEFEC', borderColor: '#F5A99A', borderWidth: 2, borderRadius: 18, textColor: '#7C2E1D' },
];

const DEFAULT_BORDER_OPTION = (baseBorderColor: string): PremiumBorderOption => ({
    key: 'default',
    name: 'Predeterminado',
    background: 'transparent',
    borderColor: baseBorderColor,
    borderWidth: 1,
    borderRadius: 10,
    textColor: '',
});

// Define lo que proveerá nuestro hook 'useTheme'
interface ThemeContextType {
    theme: ThemeColors; // Los colores finales (fondo/texto de página con la personalización aplicada)
    fontFamily: string | undefined; // Tipografía de cuerpo elegida (premium), o undefined = la del sistema
    borderStyle: PremiumBorderOption; // El estilo de tarjeta elegido (premium), o el neutro por defecto
    isDarkMode: boolean; // Modo oscuro efectivo (override manual o del sistema)
    setDarkMode: (value: boolean) => void; // Forzar el modo desde Ajustes
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const systemColorScheme = useColorScheme() || 'light';
    const [darkModeOverride, setDarkModeOverride] = useState<'light' | 'dark' | null>(null);
    const { plan, relationshipData } = usePlan(); // Obtenemos el plan y los datos de la relación

    useEffect(() => {
        AsyncStorage.getItem(DARK_MODE_OVERRIDE_KEY).then((value) => {
            if (value === 'light' || value === 'dark') setDarkModeOverride(value);
        });
    }, []);

    const setDarkMode = useCallback((value: boolean) => {
        const next = value ? 'dark' : 'light';
        setDarkModeOverride(next);
        AsyncStorage.setItem(DARK_MODE_OVERRIDE_KEY, next).catch(() => {});
    }, []);

    const colorScheme = darkModeOverride ?? systemColorScheme;

    // 1. Obtenemos los settings premium guardados en Firestore
    const settings: PremiumSettings = useMemo(() => relationshipData?.settings || {}, [relationshipData]);

    const borderStyle = useMemo(() => {
        const baseTheme = themes[colorScheme];
        if (plan !== 'premium') return DEFAULT_BORDER_OPTION(baseTheme.border);
        const option = settings.borderStyle ? PREMIUM_BORDER_OPTIONS.find(o => o.key === settings.borderStyle) : undefined;
        return option || DEFAULT_BORDER_OPTION(baseTheme.border);
    }, [plan, settings, colorScheme]);

    // 2. Determinamos los estilos finales basados en el plan. El fondo/texto
    // de página ('bg'/'background', el token viejo y el nuevo — hay
    // pantallas que todavía leen uno u otro) heredan primero el swatch
    // explícito de la pareja y, si no hay, el del estilo de borde elegido.
    const theme = useMemo(() => {
        const baseTheme = themes[colorScheme];
        if (plan !== 'premium') return baseTheme;

        const bg = settings.backgroundColor || (borderStyle.key !== 'default' ? borderStyle.background : undefined) || baseTheme.bg;
        const text = settings.fontColor || (borderStyle.key !== 'default' ? borderStyle.textColor : undefined) || baseTheme.text;

        return { ...baseTheme, bg, background: bg, text };
    }, [plan, settings, colorScheme, borderStyle]);

    const fontFamily = useMemo(() => {
        if (plan === 'premium' && settings.fontFamily) {
            return settings.fontFamily;
        }
        return undefined;
    }, [plan, settings]);

    return (
        <ThemeContext.Provider value={{ theme, fontFamily, borderStyle, isDarkMode: colorScheme === 'dark', setDarkMode }}>
            {children}
        </ThemeContext.Provider>
    );
};

// 3. Hook personalizado para consumir el tema
export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
    }
    return context;
};
