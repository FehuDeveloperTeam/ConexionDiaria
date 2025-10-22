// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA7SukKPiuIgGIAPbZ1CfPedb4KX3A2A3E",
  authDomain: "conexiondiariaapp.firebaseapp.com",
  projectId: "conexiondiariaapp",
  storageBucket: "conexiondiariaapp.firebasestorage.app",
  messagingSenderId: "647692937607",
  appId: "1:647692937607:web:1096ab03ff34caabb20b22"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
//Crea y exporta las instancias de Firestore y Authentication
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { db, auth, storage };