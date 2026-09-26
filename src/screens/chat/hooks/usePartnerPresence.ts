import { useState, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebaseConfig';

// El "en línea" del otro dispositivo se apaga con un updateDoc en el cleanup
// de su propio hook al desmontarse (ver setUserOffline más abajo) — pero en
// web eso NO corre si esa pestaña se cierra, se recarga, o se cambia de
// cuenta sin pasar por un logout que desmonte limpio (reportado: "cambié de
// usuario y mi pareja seguía en línea"). En vez de confiar solo en ese
// cleanup, acá tratamos "en línea" como caduco si el latido (cada 30s, ver
// setUserOnline) no se actualizó hace más de STALE_MS — así se autocorrige
// aunque el otro lado nunca haya alcanzado a avisar que se fue.
const STALE_MS = 2 * 60 * 1000;

// Info de la pareja para el header del chat (nombre/online/lastSeen/foto)
// y la propia presencia del usuario actual (isOnline/lastSeen).
export function usePartnerPresence({
    currentUser,
    partnerId,
}: {
    currentUser: FirebaseUser | null;
    partnerId: string | null | undefined;
}) {
    const [partnerRaw, setPartnerRaw] = useState<{
        name: string;
        isOnlineRaw: boolean;
        lastSeen: Timestamp | null;
        photoURL?: string;
    } | null>(null);
    const [now, setNow] = useState(() => Date.now());

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

                setPartnerRaw({
                    name: partnerName,
                    isOnlineRaw: data.isOnline || false,
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

    // Recalcular "now" cada 30s: hace que 'isOnline' caduque solo (ver
    // STALE_MS arriba) y de paso refresca el texto "Hace X min".
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(interval);
    }, []);

    const partnerInfo = useMemo(() => {
        if (!partnerRaw) return null;
        const lastSeenMs = partnerRaw.lastSeen?.toDate ? partnerRaw.lastSeen.toDate().getTime() : null;
        const isOnline = partnerRaw.isOnlineRaw && lastSeenMs !== null && (now - lastSeenMs) < STALE_MS;
        return {
            name: partnerRaw.name,
            isOnline,
            lastSeen: partnerRaw.lastSeen,
            photoURL: partnerRaw.photoURL,
        };
    }, [partnerRaw, now]);

    return { partnerInfo };
}
