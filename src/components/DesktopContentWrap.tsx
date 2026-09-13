// Sprint 7.10 — "Contenido central máx. 720px" del handoff (Responsive/
// Escritorio). Centra el contenido de una pantalla en una columna de
// hasta CONTENT_MAX_WIDTH en escritorio; en móvil es un simple flex:1
// transparente, sin efecto. No incluye el carril de contexto de 320px
// del handoff (últimas fotos, tareas pendientes, chat compacto) — es una
// pieza nueva por pantalla, no un contenedor genérico, y queda fuera de
// este sprint de re-skin.
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useResponsive, CONTENT_MAX_WIDTH } from '../hooks/useResponsive';

export const DesktopContentWrap: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({ children, style }) => {
    const { isDesktop } = useResponsive();

    if (!isDesktop) {
        return <View style={[{ flex: 1 }, style]}>{children}</View>;
    }

    return (
        <View style={[{ flex: 1, alignItems: 'center' }, style]}>
            <View style={{ flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
                {children}
            </View>
        </View>
    );
};
