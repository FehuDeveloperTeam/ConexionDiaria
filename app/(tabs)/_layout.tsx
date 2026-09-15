import React, { useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Pressable, TouchableOpacity } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { radii, spacing } from '../../src/config/theme';
import { useTheme } from '../../src/contexts/themeContext';
import { usePlan } from '../../src/contexts/planContext';
import { useResponsive, SIDEBAR_WIDTH } from '../../src/hooks/useResponsive';

// Sprint 8.9: hover sutil en escritorio para cada fila del riel (handoff,
// "Detalles de PC"). onHoverIn/onHoverOut de Pressable solo disparan en
// react-native-web; en nativo nunca se llaman.
function RailRow({
    icon, label, isFocused, activeBg, onPress,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    isFocused: boolean;
    activeBg: string;
    onPress: () => void;
}) {
    const { theme, fontFamilies } = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Pressable
            onPress={onPress}
            onHoverIn={() => setIsHovered(true)}
            onHoverOut={() => setIsHovered(false)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s14,
                borderRadius: radii.field,
                backgroundColor: isFocused ? activeBg : (isHovered ? theme.surfaceAlt : 'transparent'),
            }}
        >
            <Ionicons name={icon} size={21} color={isFocused ? theme.primary : theme.textFaint} />
            <Text style={{
                fontFamily: fontFamilies.action,
                fontSize: 16,
                color: isFocused ? theme.primary : theme.textMuted,
            }}>
                {label}
            </Text>
        </Pressable>
    );
}

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

// Mismos íconos que 'makeTabIcon' de arriba, indexados por nombre de ruta
// — el riel de escritorio (Sprint 7.10) los necesita sueltos porque arma
// sus propias filas en vez de usar tabBarIcon.
const RAIL_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
    home: 'home-outline',
    chat: 'chatbubbles-outline',
    notes: 'document-text-outline',
    tasks: 'checkmark-done-outline',
    wishlist: 'star-outline',
    album: 'images-outline',
    calendar: 'calendar-outline',
    config: 'settings-outline',
};

// Riel lateral de escritorio — Sprint 7.10 (Responsive/Escritorio). Solo
// reemplaza el CONTENIDO de la tab bar (qué se dibuja); el layout en fila
// (riel a la izquierda, pantallas a la derecha) lo da 'tabBarPosition:
// left' de @react-navigation/bottom-tabs en <Tabs> más abajo.
//
// Queda fuera de este sprint el badge de mensajes no leídos del handoff:
// no existe hoy un contador agregado de no-leídos en ningún lado del
// código (los mensajes solo guardan 'read'/'delivered' por mensaje) —
// añadirlo es una función nueva, no un re-skin, y se deja para otra sesión.
function DesktopTabRail({ state, descriptors, navigation }: BottomTabBarProps) {
    const { theme, borderStyle, fontFamilies } = useTheme();
    const { userData, partnerData, plan } = usePlan();
    const router = useRouter();
    const railBorderColor = borderStyle.key !== 'default' ? borderStyle.borderColor : theme.borderSoft;
    const activeBg = borderStyle.key !== 'default' ? borderStyle.background : theme.primaryTint;

    return (
        <View style={{
            width: SIDEBAR_WIDTH,
            backgroundColor: theme.surface,
            borderRightWidth: 1,
            borderRightColor: railBorderColor,
            paddingVertical: spacing.s22,
            paddingHorizontal: spacing.s12,
        }}>
            <View style={{ gap: spacing.s4 }}>
                {state.routes
                    // Solo las ocho pestañas reales. La ficha de la pareja
                    // vive en este grupo para conservar el riel, pero no es
                    // una pestaña: se llega a ella desde la tarjeta de abajo.
                    .filter(route => RAIL_ICONS[route.name])
                    .map((route) => {
                    const { options } = descriptors[route.key];
                    // Por clave y no por posición: al filtrar rutas, el índice
                    // de esta lista ya no coincide con el del navegador.
                    const isFocused = state.routes[state.index]?.key === route.key;
                    const label = typeof options.title === 'string' ? options.title : route.name;

                    return (
                        <RailRow
                            key={route.key}
                            icon={RAIL_ICONS[route.name] || 'ellipse-outline'}
                            label={label}
                            isFocused={isFocused}
                            activeBg={activeBg}
                            onPress={() => {
                                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                                if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
                            }}
                        />
                    );
                })}
            </View>

            <View style={{ flex: 1 }} />

            {/* Tarjeta de pareja — al tocarla se abre su ficha (Sprint 9.12) */}
            {userData?.partnerId && partnerData && (
                <TouchableOpacity
                    onPress={() => router.push('/partner')}
                    accessibilityRole="button"
                    accessibilityLabel={`Ver la ficha de ${partnerData.displayName ?? 'tu pareja'}`}
                    style={{
                        flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                        padding: spacing.s12, borderRadius: radii.field,
                        backgroundColor: theme.surfaceAlt, marginBottom: spacing.s10,
                    }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: theme.white, fontFamily: fontFamilies.bodyBold, fontSize: 13 }}>
                            {partnerData.displayName?.charAt(0).toUpperCase() || '?'}
                        </Text>
                    </View>
                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13, color: theme.text, flexShrink: 1 }} numberOfLines={1}>
                        {partnerData.displayName}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={theme.textFaint} />
                </TouchableOpacity>
            )}

            {/* Tarjeta de plan */}
            <View style={{
                flexDirection: 'row', alignItems: 'center', gap: spacing.s8,
                padding: spacing.s12, borderRadius: radii.field,
                backgroundColor: plan === 'premium' ? theme.primaryTint : theme.surfaceAlt,
            }}>
                <Ionicons name={plan === 'premium' ? 'ribbon' : 'lock-closed-outline'} size={16} color={plan === 'premium' ? theme.premium : theme.textFaint} />
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.textMuted, flex: 1 }}>
                    {plan === 'premium' ? 'Conexión Total' : 'Plan Free'}
                </Text>
            </View>
        </View>
    );
}

const TabLayout: React.FC = () => {
    const { theme, borderStyle, fontFamilies } = useTheme();
    const { isDesktop } = useResponsive();
    // Sprint 7.8b: la tab bar hereda el estilo de borde de la pareja
    // (probador de tema) — mismo criterio que el hero de Inicio.
    const activePillColor = borderStyle.key !== 'default' ? borderStyle.background : theme.primarySoft;

    return (
        <Tabs
            // Sprint 7.10: <760px sigue siendo la tab bar inferior de siempre;
            // >=760px pasa a riel lateral (ver DesktopTabRail arriba).
            tabBar={isDesktop ? (props) => <DesktopTabRail {...props} /> : undefined}
            screenOptions={{
                tabBarPosition: isDesktop ? 'left' : 'bottom',
                tabBarActiveTintColor: theme.primary,
                tabBarInactiveTintColor: theme.textFaint,
                tabBarLabelStyle: { fontFamily: fontFamilies.action, fontSize: 8.5 },
                tabBarStyle: {
                    backgroundColor: theme.surface,
                    borderTopColor: borderStyle.key !== 'default' ? borderStyle.borderColor : theme.borderSoft,
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
                    tabBarIcon: makeTabIcon('home-outline', activePillColor),
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: makeTabIcon('chatbubbles-outline', activePillColor),
                    headerShown: false, // Para usar nuestro header personalizado
                }}
            />
            <Tabs.Screen
                name="notes"
                options={{
                    title: 'Notas',
                    tabBarIcon: makeTabIcon('document-text-outline', activePillColor),
                    headerShown: false,
                }}
            />

            {/* --- ¡NUEVA PESTAÑA DE TAREAS AÑADIDA AQUÍ! --- */}
            <Tabs.Screen
                name="tasks"
                options={{
                    title: 'Tareas',
                    tabBarIcon: makeTabIcon('checkmark-done-outline', activePillColor),
                    headerShown: false,
                }}
            />

            <Tabs.Screen
                name="wishlist"
                options={{
                    title: 'Deseos',
                    tabBarIcon: makeTabIcon('star-outline', activePillColor),
                    headerShown: false,
                }}
            />

            <Tabs.Screen
                name="album"
                options={{
                    title: 'Álbum',
                    tabBarIcon: makeTabIcon('images-outline', activePillColor),
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="calendar"
                options={{
                    title: 'Calendario',
                    tabBarIcon: makeTabIcon('calendar-outline', activePillColor),
                    headerShown: false,
                }}
            />
            <Tabs.Screen
                name="config"
                options={{
                    title: 'Ajustes',
                    tabBarIcon: makeTabIcon('settings-outline', activePillColor),
                    headerShown: false,
                }}
            />

            {/* Ficha de la pareja — Sprint 9.12. Vive dentro de este grupo para
                conservar el riel lateral: como ruta suelta perdía la
                navegación entera y el borde del contenido quedaba justo donde
                antes estaba la barra, cortando la pantalla. 'href: null' la
                deja fuera de la barra de pestañas. */}
            <Tabs.Screen name="partner" options={{ href: null, headerShown: false }} />

            {/* "Mis tallas" — Sprint 9.24. Mismo criterio que la ficha: dentro
                del grupo para conservar el riel, fuera de la barra. */}
            <Tabs.Screen name="measurements" options={{ href: null, headerShown: false }} />

            {/* Archivo de la pregunta del día — Sprint 9.21. */}
            <Tabs.Screen name="questions" options={{ href: null, headerShown: false }} />

            {/* Ocultamos las pantallas que no son pestañas (como login, register, etc.) */}
            {/* Expo Router lo maneja automáticamente si no están en esta lista */}

        </Tabs>
    );
};

export default TabLayout;
