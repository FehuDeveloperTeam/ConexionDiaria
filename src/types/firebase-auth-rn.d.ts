// Aumenta los tipos de 'firebase/auth' con 'getReactNativePersistence'.
//
// Por qué hace falta (A-05, auditoría de seguridad): @firebase/auth SÍ
// implementa esta función para React Native — vive en su build
// 'dist/rn/index.js', que Metro resuelve en tiempo de ejecución gracias a
// la condición 'react-native' de Expo (ver src/config/firebaseConfig.ts).
// Pero el paquete declara sus TIPOS con una clave 'types' de nivel
// superior en su package.json ("exports"), que apunta siempre al mismo
// 'auth-public.d.ts' genérico sin pasar por la rama condicional
// 'react-native' — así que TypeScript nunca ve esa función, aunque en
// tiempo de ejecución sí exista. Es un hueco de los tipos publicados por
// Firebase, no un error de este proyecto.
//
// Referencia: functions/src/pairing.ts (F-02) tiene el mismo tipo de
// gap documentado para email_verified; este es el equivalente en el
// cliente para el SDK de Auth.
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
