// En: src/contexts/PlanContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, DocumentData, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
import Purchases from 'react-native-purchases';

// Define la estructura del contexto
interface PlanContextType {
    user: User | null;
    userData: DocumentData | null;
    relationshipData: DocumentData | null;
    partnerData: DocumentData | null;
    plan: 'free' | 'premium';
    isLoading: boolean;
}

// Crea el contexto con valores por defecto
const PlanContext = createContext<PlanContextType>({
    user: null,
    userData: null,
    relationshipData: null,
    partnerData: null,
    plan: 'free',
    isLoading: true,
});

// Crea el Proveedor (Provider)
export const PlanProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [partnerData, setPartnerData] = useState<DocumentData | null>(null);
    const [relationshipData, setRelationshipData] = useState<DocumentData | null>(null);
    const [plan, setPlan] = useState<'free' | 'premium'>('free');
    const [isLoading, setIsLoading] = useState(true);

    // 1. Efecto para manejar la Autenticación (Auth)
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                setUser(authUser);
                Purchases.logIn(authUser.uid);
            } else {
                setUser(null);
                setUserData(null);
                setPartnerData(null);
                setRelationshipData(null);
                setPlan('free');
                setIsLoading(false);
                Purchases.logOut();
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // 2. Efecto para cargar datos de Firestore (depende del 'user')
    useEffect(() => {
        if (!user) {
            // Si no hay usuario, nos aseguramos de no estar cargando
            setIsLoading(false);
            return;
        }

        // Si hay usuario, empezamos a cargar
        setIsLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                setPlan(data.plan || 'free');

                // Si el usuario tiene una pareja, cargamos sus datos
                if (data.partnerId) {
                    const relationshipId = [user.uid, data.partnerId].sort().join('_');

                    // Listener para los datos de la pareja
                    const partnerDocRef = doc(db, 'users', data.partnerId);
                    const unsubscribePartner = onSnapshot(partnerDocRef, (partnerSnap) => {
                        setPartnerData(partnerSnap.data() || null);
                    });

                    // Listener para los datos de la relación (almacenamiento, etc.)
                    const relationshipDocRef = doc(db, 'relationships', relationshipId);
                    const unsubscribeRelationship = onSnapshot(relationshipDocRef, (relSnap) => {
                        setRelationshipData(relSnap.data() || null);
                        setIsLoading(false); // Terminamos de cargar TODO
                    });

                    // Devolvemos la limpieza para estos listeners anidados
                    return () => {
                        unsubscribePartner();
                        unsubscribeRelationship();
                    };

                } else {
                    // No tiene pareja, limpiamos los datos y terminamos de cargar
                    setPartnerData(null);
                    setRelationshipData(null);
                    setIsLoading(false);
                }

            } else {
                // El usuario está en Auth pero no en Firestore
                auth.signOut();
                setIsLoading(false);
            }
        });

        // Devolvemos la limpieza del listener principal del usuario
        return () => unsubscribeUser();
        
    }, [user]); // Este efecto se ejecuta solo si 'user' cambia

    return (
        // 3. CORRECCIÓN: Pasamos TODOS los datos en el 'value'
        <PlanContext.Provider value={{ user, userData, partnerData, relationshipData, plan, isLoading }}>
            {children}
        </PlanContext.Provider>
    );
};

// Crea un Hook personalizado para consumir el contexto fácilmente
export const usePlan = () => {
    const context = useContext(PlanContext);
    if (context === undefined) {
        throw new Error('usePlan debe ser usado dentro de un PlanProvider');
    }
    return context;
};