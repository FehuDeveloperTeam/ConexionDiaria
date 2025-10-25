import { useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Hook personalizado para manejar el estado en línea del usuario
 * Actualiza automáticamente isOnline y lastSeen en Firestore
 */
export const useOnlineStatus = () => {
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);

        // Función para actualizar el estado
        const updateOnlineStatus = async (isOnline: boolean) => {
            try {
                await updateDoc(userRef, {
                    isOnline: isOnline,
                    lastSeen: serverTimestamp()
                });
            } catch (error) {
                console.error('Error updating online status:', error);
            }
        };

        // Marcar como online al montar el componente
        updateOnlineStatus(true);

        // Actualizar lastSeen cada 30 segundos mientras está activo
        const interval = setInterval(() => {
            if (appState.current === 'active') {
                updateOnlineStatus(true);
            }
        }, 30000); // 30 segundos

        // Listener para cambios en el estado de la app
        const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App vuelve a primer plano
                await updateOnlineStatus(true);
            } else if (nextAppState.match(/inactive|background/)) {
                // App va a segundo plano
                await updateOnlineStatus(false);
            }
            appState.current = nextAppState;
        });

        // Cleanup: marcar como offline al desmontar
        return () => {
            clearInterval(interval);
            subscription.remove();
            updateOnlineStatus(false);
        };
    }, []);
};