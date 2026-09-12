import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebaseConfig';

// Info de la pareja para el header del chat (nombre/online/lastSeen/foto)
// y la propia presencia del usuario actual (isOnline/lastSeen).
export function usePartnerPresence({
    currentUser,
    partnerId,
}: {
    currentUser: FirebaseUser | null;
    partnerId: string | null | undefined;
}) {
    const [partnerInfo, setPartnerInfo] = useState<{
        name: string;
        isOnline: boolean;
        lastSeen: Timestamp | null;
        photoURL?: string;
    } | null>(null);

    // Escuchar cambios en los datos de la pareja para el header
    useEffect(() => {
        console.log('🔍 Hook de pareja ejecutado:', {
            hasPartnerId: !!partnerId,
            partnerId
        });

        if (!partnerId) {
            console.log('⚠️ No hay partnerId aún');
            return;
        }

        console.log('👥 Cargando datos de la pareja:', partnerId);

        const partnerRef = doc(db, 'users', partnerId);
        const unsubscribe = onSnapshot(partnerRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data();

                // Intentar obtener el nombre de diferentes campos posibles
                const partnerName = data.name || data.displayName || data.fullName || data.username || 'Pareja';

                console.log('✅ Datos de pareja recibidos:', {
                    rawData: data,
                    name: data.name,
                    displayName: data.displayName,
                    fullName: data.fullName,
                    username: data.username,
                    selectedName: partnerName,
                    isOnline: data.isOnline,
                    hasLastSeen: !!data.lastSeen,
                    hasPhotoURL: !!data.photoURL
                });

                setPartnerInfo({
                    name: partnerName,
                    isOnline: data.isOnline || false,
                    lastSeen: data.lastSeen || null,
                    photoURL: data.photoURL || data.photoUrl || undefined,
                });
            } else {
                console.log('❌ Documento de pareja no existe');
            }
        }, (error) => {
            console.error('❌ Error cargando datos de pareja:', error);
        });

        return () => unsubscribe();
    }, [partnerId]);

    // Actualizar estado de presencia del usuario actual (isOnline/lastSeen)
    useEffect(() => {
        if (!currentUser) return;

        console.log('🟢 Iniciando sistema de presencia para:', currentUser.uid);

        const userStatusRef = doc(db, 'users', currentUser.uid);
        let updateInterval: ReturnType<typeof setInterval>;

        // Función para marcar como online
        const setUserOnline = async () => {
            try {
                await updateDoc(userStatusRef, {
                    isOnline: true,
                    lastSeen: Timestamp.now()
                });
                console.log('✅ Usuario marcado como online');
            } catch (error) {
                console.error('❌ Error actualizando presencia:', error);
            }
        };

        // Función para marcar como offline
        const setUserOffline = async () => {
            try {
                await updateDoc(userStatusRef, {
                    isOnline: false,
                    lastSeen: Timestamp.now()
                });
                console.log('🔴 Usuario marcado como offline');
            } catch (error) {
                console.error('❌ Error actualizando presencia:', error);
            }
        };

        // Marcar como online al iniciar
        setUserOnline();

        // Actualizar cada 30 segundos para mantener online
        updateInterval = setInterval(() => {
            if (AppState.currentState === 'active') {
                setUserOnline();
            }
        }, 30000);

        // Listener de cambios de estado de la app
        const subscription = AppState.addEventListener('change', async (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('📱 App activa');
                await setUserOnline();
            } else if (nextAppState === 'background' || nextAppState === 'inactive') {
                console.log('📱 App en background');
                await setUserOffline();
            }
        });

        // Cleanup: marcar como offline al desmontar
        return () => {
            clearInterval(updateInterval);
            setUserOffline();
            subscription.remove();
        };
    }, [currentUser]);

    // Actualizar la visualización del tiempo de última conexión cada minuto
    useEffect(() => {
        const interval = setInterval(() => {
            // Forzar re-render para actualizar "Hace X min"
            if (partnerInfo && !partnerInfo.isOnline && partnerInfo.lastSeen) {
                setPartnerInfo(prev => prev ? { ...prev } : null);
            }
        }, 60000); // Cada 60 segundos

        return () => clearInterval(interval);
    }, [partnerInfo]);

    return { partnerInfo };
}
