import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { Platform } from 'react-native';
import { getDatabase } from 'firebase/database';

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
const auth = getAuth(app);
// Emparejamiento con código (F-02, functions/src/pairing.ts) y push remoto
// (functions/src/pushNotifications.ts) viven en la región por defecto
// (us-central1), igual que la Cloud Function: no hace falta indicarla acá.
const functions = getFunctions(app);

// Configura persistencia después de inicializar auth
if (Platform.OS === 'web') {
  // Para web, usa browserLocalPersistence
  setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.error('Error setting persistence:', error);
  });
} else {
  // Para móvil, Firebase intentará usar AsyncStorage automáticamente
  // si está instalado @react-native-async-storage/async-storage
  // No necesitamos configurar nada adicional
}

export { db, auth, storage, functions };
export const realtimeDb = getDatabase(app);