import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA7SukKPiuIgGIAPbZ1CfPedb4KX3A2A3E",
  authDomain: "conexiondiariaapp.firebaseapp.com",
  projectId: "conexiondiariaapp",
  storageBucket: "conexiondiariaapp.firebasestorage.app",
  messagingSenderId: "647692937607",
  appId: "1:647692937607:web:1096ab03ff34caabb20b22"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa servicios
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

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

export { db, auth, storage };