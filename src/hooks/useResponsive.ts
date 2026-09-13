// Sprint 7.10 — breakpoints de escritorio (ver README del bundle de
// diseño, sección "Responsive / Escritorio"): <760px layout móvil (tab
// bar inferior), >=760px riel lateral, >=1080px además el carril de
// contexto (no implementado en este sprint — ver nota en el commit).
import { useWindowDimensions } from 'react-native';

export const DESKTOP_BREAKPOINT = 760;
export const WIDE_BREAKPOINT = 1080;
export const CONTENT_MAX_WIDTH = 720;
export const SIDEBAR_WIDTH = 248;

export function useResponsive() {
    const { width } = useWindowDimensions();
    return {
        width,
        isDesktop: width >= DESKTOP_BREAKPOINT,
        isWide: width >= WIDE_BREAKPOINT,
    };
}
