import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, initializeAuth, setPersistence, browserLocalPersistence, getReactNativePersistence } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuración de Firebase (ver .env.example para las variables requeridas)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Faltan variables EXPO_PUBLIC_FIREBASE_* — copia .env.example a .env y completa los valores.'
  );
}

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa servicios
const db = getFirestore(app);
const storage = getStorage(app);

// A-05: en móvil, 'getAuth(app)' NO conecta AsyncStorage solo — el propio
// SDK avisa por consola "Auth state will default to memory persistence and
// will not persist between sessions" si se usa así. Hay que pedir la
// persistencia explícitamente con 'initializeAuth', y hacerlo ANTES de
// cualquier 'getAuth()' (una vez que un provider de Auth queda inicializado,
// las llamadas siguientes lo reusan tal cual quedó). En web, en cambio,
// 'getAuth' + 'setPersistence' ya es la forma correcta.
const auth = Platform.OS === 'web'
  ? getAuth(app)
  : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });

if (Platform.OS === 'web') {
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting persistence:', error);
  });
}

// Emparejamiento con código (F-02, functions/src/pairing.ts) y push remoto
// (functions/src/pushNotifications.ts) viven en la región por defecto
// (us-central1), igual que la Cloud Function: no hace falta indicarla acá.
const functions = getFunctions(app);

export { db, auth, storage, functions };