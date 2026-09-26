// Contador de cupos de fundador, lado cliente — Sprint 9.18.
//
// Lo escribe el webhook de RevenueCat en una transacción (Sprint 9.17) y el
// cliente solo lo lee: appConfig/founders es de lectura para cualquier sesión
// iniciada y de escritura para nadie (ver firestore.rules).
//
// Está separado de services/pricing.ts a propósito: ese archivo decide el
// escalón de precio y se mantiene puro para poder probarse sin Firebase.
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

// Debe coincidir con DEFAULT_FOUNDER_LIMIT de functions/src/index.ts. Solo se
// usa mientras el documento no existe; en cuanto hay una compra, el tope real
// sale del propio documento.
export const DEFAULT_FOUNDER_LIMIT = 500;

// Devuelve null —y no 0— cuando la lectura falla: "no sé cuántos quedan" no es
// lo mismo que "no queda ninguno". Confundirlos regalaría el precio de
// fundador cada vez que se cae la red.
export const fetchFoundersLeft = async (): Promise<number | null> => {
    try {
        const snapshot = await getDoc(doc(db, 'appConfig', 'founders'));
        if (!snapshot.exists()) {
            // Todavía nadie ha comprado: el documento lo crea el webhook con
            // la primera compra, así que están los 500 cupos.
            return DEFAULT_FOUNDER_LIMIT;
        }
        const data = snapshot.data();
        const claimed = typeof data.claimed === 'number' ? data.claimed : 0;
        const limit = typeof data.limit === 'number' ? data.limit : DEFAULT_FOUNDER_LIMIT;
        return Math.max(0, limit - claimed);
    } catch (error) {
        console.error('No se pudo leer el contador de fundadores:', error);
        return null;
    }
};
