// En: src/contexts/PlanContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, DocumentData, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebaseConfig';
// --- ¡ESTA ES LA IMPORTACIÓN CORREGIDA! ---
import Purchases from 'react-native-purchases';

// Define la estructura del contexto
interface PlanContextType {
    user: User | null;
    userData: DocumentData | null;
    plan: 'free' | 'premium';
    isLoading: boolean;
}

// Crea el contexto con valores por defecto
const PlanContext = createContext<PlanContextType>({
    user: null,
    userData: null,
    plan: 'free',
    isLoading: true,
});

// Crea el Proveedor (Provider)
export const PlanProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [plan, setPlan] = useState<'free' | 'premium'>('free');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // 1. Escuchar cambios de Auth
        const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
            if (authUser) {
                setUser(authUser);
                // Configurar RevenueCat con el ID de usuario
                Purchases.logIn(authUser.uid);
            } else {
                setUser(null);
                setUserData(null);
                setPlan('free');
                setIsLoading(false);
                Purchases.logOut();
            }
        });

        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        // 2. Si hay usuario, escuchar su documento de 'users'
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setUserData(data);
                    // 3. Actualizar el estado del plan
                    setPlan(data.plan || 'free'); 
                } else {
                    auth.signOut();
                }
                setIsLoading(false);
            });
            return () => unsubscribeUser();
        } else {
            setIsLoading(false);
        }
    }, [user]);

    return (
        <PlanContext.Provider value={{ user, userData, plan, isLoading }}>
            {children}
        </PlanContext.Provider>
    );
};

// Crea un Hook personalizado para consumir el contexto fácilmente
export const usePlan = () => {
    return useContext(PlanContext);
};