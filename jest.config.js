// Pruebas de interfaz — Sprint 11.6.
//
// Las 183 pruebas que ya existían son todas de lógica pura: reglas, fechas,
// precios, cupos. Cero de interfaz. Y los cuatro errores reportados en la
// revisión visual fueron TODOS de interfaz: el tema oscuro ilegible, la fecha
// que no abría, el sostén preguntado a un hombre y el bucle de la bienvenida.
// No es casualidad — es la parte sin cubrir.
//
// Corre con:  npm run test:ui
module.exports = {
    preset: 'jest-expo',
    setupFiles: ['<rootDir>/tests/ui/setup.js'],
    testMatch: ['<rootDir>/tests/ui/**/*.test.tsx'],
    // Las suites de lógica corren con node a secas (ver los scripts test:*);
    // jest solo se ocupa de la interfaz.
    testPathIgnorePatterns: ['<rootDir>/tests/.tmp-', '<rootDir>/node_modules/'],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-gifted-chat|firebase|@firebase/.*))',
    ],
};
