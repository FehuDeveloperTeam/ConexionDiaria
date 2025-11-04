// En: src/contexts/ThemeContext.tsx

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { themes, ThemeColors } from '../config/theme'; // Asumo que 'themes' exporta tus colores base
import { usePlan } from './planContext'; // Usamos el hook que ya creamos

// Define la estructura de los settings guardados en Firestore
// (Asumimos que los guardas en 'relationshipData.settings')
interface PremiumSettings {
    backgroundColor?: string;
    fontFamily?: string;
    fontColor?: string;
    borderColor?: string;
    borderStyle?: string; // (Ej. 'heartBorder1')
}

// Define lo que proveerá nuestro hook 'useTheme'
interface ThemeContextType {
    theme: ThemeColors; // Los colores finales
    fontFamily: string | undefined; // La fuente final
    borderStyle: any; // El estilo de borde final
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// --- Los 10 Diseños de Borde (Premium) ---
// (Definidos aquí para que el Context los pueda proveer)
const PREMIUM_BORDERS = {
    heartBorder1: { borderWidth: 2, borderColor: '#FFB6C1', borderRadius: 20 },
    heartBorder2: { borderWidth: 3, borderColor: '#FF69B4', borderRadius: 15, borderStyle: 'dotted' },
    heartBorder3: { borderWidth: 1, borderColor: '#FFC0CB', borderRadius: 50 }, // Círculo
    heartBorder4: { borderWidth: 2, borderColor: '#DB7093', borderRadius: 10, shadowColor: '#DB7093', shadowOpacity: 0.5, shadowRadius: 5, elevation: 5 }, // Sombra
    heartBorder5: { borderWidth: 2, borderColor: '#E6E6FA', borderRadius: 15 }, // Pastel Lavanda
    heartBorder6: { borderWidth: 2, borderColor: '#B0E0E6', borderRadius: 15 }, // Pastel Azul
    heartBorder7: { borderWidth: 2, borderColor: '#98FB98', borderRadius: 15 }, // Pastel Menta
    heartBorder8: { borderWidth: 2, borderColor: '#FFFACD', borderRadius: 15 }, // Pastel Limón
    heartBorder9: { borderWidth: 2, borderColor: '#FFDAB9', borderRadius: 15 }, // Pastel Durazno
    heartBorder10: { borderWidth: 2, borderColor: '#F08080', borderRadius: 15 }, // Pastel Coral
    default: (baseBorderColor: string) => ({ borderWidth: 1, borderColor: baseBorderColor, borderRadius: 10 }),
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const colorScheme = useColorScheme() || 'light';
    const { plan, relationshipData } = usePlan(); // Obtenemos el plan y los datos de la relación

    // 1. Obtenemos los settings premium guardados en Firestore
    const settings: PremiumSettings = relationshipData?.settings || {};

    // 2. Determinamos los estilos finales basados en el plan
    const theme = useMemo(() => {
        const baseTheme = themes[colorScheme];
        if (plan === 'premium') {
            return {
                ...baseTheme,
                background: settings.backgroundColor || baseTheme.background,
                text: settings.fontColor || baseTheme.text,
            };
        }
        return baseTheme; // Plan gratuito usa el tema estándar
    }, [plan, settings, colorScheme]);

    const fontFamily = useMemo(() => {
        if (plan === 'premium' && settings.fontFamily) {
            return settings.fontFamily; // (Ej. 'Roboto', 'Lato', etc.)
        }
        return undefined; // Fuente por defecto
    }, [plan, settings]);

    const borderStyle = useMemo(() => {
        const baseTheme = themes[colorScheme];
        if (plan === 'premium' && settings.borderStyle && PREMIUM_BORDERS[settings.borderStyle]) {
            return PREMIUM_BORDERS[settings.borderStyle];
        }
        // Color de borde personalizado (si no hay estilo 'heart')
        if (plan === 'premium' && settings.borderColor) {
            return { borderWidth: 2, borderColor: settings.borderColor, borderRadius: 10 };
        }
        // Borde por defecto
        return PREMIUM_BORDERS.default(baseTheme.borderColor);
    }, [plan, settings, colorScheme]);

    return (
        <ThemeContext.Provider value={{ theme, fontFamily, borderStyle }}>
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