// src/config/theme.ts

const lightColors = {
  background: '#F7F7FF', // Un blanco lila muy suave
  primary: '#6A5ACD', // Un violeta bonito (SlateBlue)
  text: '#1E1E1E', // Casi negro para el texto
  inputBackground: '#FFFFFF',
  placeholder: '#A9A9A9', // Gris para placeholders
  borderColor: '#D3D3D3', // Borde gris claro
  link: '#007BFF', // Azul estándar para links
  white: '#FFFFFF',
};

const darkColors = {
  background: '#121212', // Un fondo oscuro profundo
  primary: '#BB86FC', // Un lavanda brillante para modo oscuro
  text: '#E1E1E1', // Texto casi blanco
  inputBackground: '#1E1E1E',
  placeholder: '#888888',
  borderColor: '#333333',
  link: '#BB86FC', // Usamos el color primario para el link
  white: '#FFFFFF',
};

export const themes = {
  light: lightColors,
  dark: darkColors,
};

export type ThemeColors = typeof lightColors;