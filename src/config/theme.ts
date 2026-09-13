// src/config/theme.ts
//
// Sprint 7.0 — Fundamentos del sistema de diseño (tokens): paleta completa,
// tipografía, espaciado, radios y sombras, tal como los define el handoff
// de diseño (Claude Design). Fuente de verdad para todo el Sprint 7.
//
// IMPORTANTE: los ocho tokens originales (background, primary, text,
// inputBackground, placeholder, borderColor, link, white) se mantienen
// intactos — los sigue usando toda la app hoy. Todo lo nuevo es aditivo:
// nada se renombra ni se borra en esta sesión. Las pantallas se migran al
// nuevo sistema una por una en las sesiones siguientes del Sprint 7.

const lightColors = {
  // --- Tokens originales (no tocar: en uso en toda la app) ---
  background: '#F7F7FF',
  primary: '#6A5ACD',
  text: '#1E1E1E',
  inputBackground: '#FFFFFF',
  placeholder: '#A9A9A9',
  borderColor: '#D3D3D3',
  link: '#007BFF',
  white: '#FFFFFF',

  // --- Sistema de diseño nuevo (Sprint 7) ---
  bg: '#F7F7FF',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F9',
  primarySoft: '#EDEAFC',
  primaryTint: '#F2F0FE',
  textMuted: '#6E6E7A',
  textFaint: '#8A8A96',
  border: '#D3D3D3',
  borderSoft: '#E3E3EE',
  // El handoff solo define 'borderStrong' para oscuro (casillas, bordes
  // punteados premium); en claro no hay un tono más fuerte que 'border',
  // así que se reutiliza el mismo valor para no dejar el token vacío.
  borderStrong: '#D3D3D3',
  divider: '#F0F0F6',

  affection: '#FF7A9C',
  affectionInk: '#E0628D',
  premium: '#D9A84E',
  premiumTextOnFill: '#2E2103',
  premiumGradient: ['#E8C578', '#C08C2E'] as [string, string],
  premiumPanelGradient: ['#2B2340', '#4A3C6E'] as [string, string],
  // Hero de aniversario (Inicio, sesión 7.3a) — gradiente propio, distinto
  // del panel premium. En claro no lleva borde, solo el gradiente.
  heroGradient: ['#6A5ACD', '#8B7BE0'] as [string, string],
  heroBorder: 'transparent',
  success: '#3F9E7C',
  danger: '#C2374F',
  dangerBg: '#FDECEF',
  warnBg: '#FDF3E4',
  warnBorder: '#EBD5AC',
  warnText: '#6B4B0A',
};

const darkColors = {
  // --- Tokens originales ---
  background: '#121212',
  primary: '#BB86FC',
  text: '#E1E1E1',
  inputBackground: '#1E1E1E',
  placeholder: '#888888',
  borderColor: '#333333',
  link: '#BB86FC',
  white: '#FFFFFF',

  // --- Sistema de diseño nuevo ---
  bg: '#121212',
  surface: '#1C1C1E',
  surfaceAlt: '#242428',
  primarySoft: '#2C2436',
  primaryTint: '#2A2436',
  textMuted: '#9A9AA3',
  textFaint: '#87878F',
  border: '#333333',
  // El handoff no da un 'borderSoft' propio para oscuro (solo distingue
  // 'border' de 'borderStrong'); se reutiliza 'border' para no dejar el
  // token vacío — mismo criterio que 'borderStrong' en claro.
  borderSoft: '#333333',
  borderStrong: '#4A4458',
  // El handoff no define un 'divider' propio para oscuro (solo lo hace
  // para claro); se reutiliza 'border', que cumple el mismo rol visual.
  divider: '#333333',

  affection: '#FF7A9C',
  affectionInk: '#B23A5A',
  premium: '#D9A84E',
  premiumTextOnFill: '#2E2103',
  premiumGradient: ['#E8C578', '#C08C2E'] as [string, string],
  premiumPanelGradient: ['#2B2340', '#4A3C6E'] as [string, string],
  heroGradient: ['#3A2D55', '#241C33'] as [string, string],
  heroBorder: '#3D3352',
  success: '#7FE0A8',
  danger: '#E27D93',
  dangerBg: '#2A1D24',
  // El handoff solo define 'warnBg' para claro. Este tono oscuro es una
  // extrapolación con el mismo criterio que 'dangerBg'/'primaryTint'
  // (fondo saturado oscuro + texto claro); revisar contra el diseño real
  // cuando se construya el aviso de almacenamiento en oscuro (sesión 7.4b).
  warnBg: '#2C2414',
  warnBorder: '#4A3C22',
  warnText: '#E0B876',
};

export const themes = {
  light: lightColors,
  dark: darkColors,
};

export type ThemeColors = typeof lightColors;

// --- Tipografía ---
//
// Tres familias, cada una con un rol fijo (ver README del bundle de
// diseño y la decisión de producto sobre Poppins):
// - Newsreader (serif): momentos emotivos — nombre de la app, aniversario,
//   títulos de pantalla, números grandes.
// - Manrope: todo el contenido — body, inputs, listas, metadatos.
// - Poppins: la voz de la interacción — botones/CTA y las etiquetas de la
//   tab bar (y del riel de escritorio en la sesión 7.10). Elección personal
//   del Product Owner, con un rol propio para no diluir a Manrope.
//
// Manrope no tiene variante itálica publicada en Google Fonts (el propio
// tipo no la define) — donde el handoff pide itálica (autor de nota),
// se usa 'fontStyle: italic' sobre el peso regular; React Native sintetiza
// la inclinación cuando la fuente no trae un archivo itálico dedicado.
export const fontFamilies = {
  display: 'Newsreader_400Regular',
  body: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtraBold: 'Manrope_800ExtraBold',
  action: 'Poppins_600SemiBold',
  actionBold: 'Poppins_700Bold',
};

// Los pesos en sí se cargan con useFonts() en app/_layout.tsx, importando
// los exports nombrados de cada paquete @expo-google-fonts/* directamente
// (es el mecanismo que ya resuelve los .ttf internos) — mantener esa lista
// sincronizada con los nombres usados arriba.

// Escala de tipografía (móvil 1×) — valores del handoff traducidos a
// estilos de React Native. Cada pantalla, al migrarse, debería consumir
// estos tokens en vez de tamaños sueltos.
export const typography = {
  displayXL: { fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 40 },
  displayL: { fontFamily: fontFamilies.display, fontSize: 32, lineHeight: 36 },
  screenTitle: { fontFamily: fontFamilies.display, fontSize: 30, lineHeight: 34 },
  modalTitle: { fontFamily: fontFamilies.display, fontSize: 23, lineHeight: 27 },
  heroNumber: { fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 40 },
  body: { fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 21 },
  bodySmall: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  sectionLabel: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 11,
    letterSpacing: 0.9, // ~.08em a 11px
    textTransform: 'uppercase' as const,
  },
  button: { fontFamily: fontFamilies.actionBold, fontSize: 16 },
  listRow: { fontFamily: fontFamilies.bodySemiBold, fontSize: 15 },
  metaText: { fontFamily: fontFamilies.body, fontSize: 12 },
  noteAuthor: { fontFamily: fontFamilies.body, fontSize: 11.5, fontStyle: 'italic' as const },
  tabLabel: { fontFamily: fontFamilies.actionBold, fontSize: 8.5 },
  badge: { fontFamily: fontFamilies.bodyExtraBold, fontSize: 10 },
};

// --- Espaciado y radios ---
// Escala de espaciado del handoff (4/6/8/10/12/14/16/18/20/22/26px).
export const spacing = {
  s4: 4,
  s6: 6,
  s8: 8,
  s10: 10,
  s12: 12,
  s14: 14,
  s16: 16,
  s18: 18,
  s20: 20,
  s22: 22,
  s26: 26,
};

export const radii = {
  chip: 8,
  checkbox: 9,
  field: 16, // input y fila (handoff: 15–18px)
  card: 22, // tarjeta (handoff: 20–26px)
  cardLg: 26,
  sheetTop: 32,
  sheetBottom: 36,
  pill: 999,
};

// --- Sombras ---
// React Native no acepta box-shadow CSS: cada preset del handoff se separa
// en shadowColor + shadowOpacity (iOS) y elevation (Android, aproximado).
// En modo oscuro el handoff reemplaza la sombra por un borde de 1px
// 'border' — eso se aplica por componente en las sesiones siguientes, no
// acá (un mismo preset no puede ser "sombra o borde" a la vez).
export const shadows = {
  ctaCard: {
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  fab: {
    shadowColor: '#6A5ACD',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.36,
    shadowRadius: 26,
    elevation: 12,
  },
  stickyNote: {
    shadowColor: '#786414',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  toast: {
    shadowColor: '#0A0A19',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 14,
  },
  contextMenu: {
    shadowColor: '#1E1E3C',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 10,
  },
};
