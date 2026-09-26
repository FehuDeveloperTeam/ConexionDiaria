import { initializeApp } from "firebase/app";
import {
  getFirestore, initializeFirestore,
  persistentLocalCache, persistentMultipleTabManager,
} from "firebase/firestore";
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

// Inicializa servicios.
//
// Sprint 11.5: caché persistente en web. Sin ella, cada recarga de la pestaña
// vuelve a pedirle todo a la red: el chat, las notas y el álbum aparecen
// vacíos un instante y la app se siente lenta aunque no lo sea. Con la caché,
// lo último que se vio ya está dibujado antes de que llegue la primera
// respuesta.
//
// 'persistentMultipleTabManager' importa de verdad acá: sin él, abrir la app
// en una segunda pestaña hace fallar la persistencia de la primera con
// 'failed-precondition'. Y esta app se usa en escritorio, donde tener dos
// pestañas abiertas es lo normal.
//
// LO QUE ESTO NO RESUELVE: el caso móvil. La caché persistente de Firestore va
// sobre IndexedDB, que no existe en React Native — ahí el SDK web solo tiene
// caché en memoria, así que la app sigue sirviendo mientras está abierta pero
// arranca vacía sin señal. Resolverlo de verdad exige migrar a
// @react-native-firebase, que trae el SDK nativo con persistencia propia; es
// una decisión grande y aparte, no un ajuste de configuración.
//
// La comprobación es por IndexedDB y no por Platform.OS: durante el export
// estático, Platform.OS ya es 'web' pero el código corre en Node, donde la
// caché persistente no se puede usar.
const hayIndexedDb =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined';

const db = Platform.OS === 'web' && hayIndexedDb
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : getFirestore(app);

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