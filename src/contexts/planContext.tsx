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
    const [isUserLoading, setIsUserLoading] = useState(true);
    const [isPartnerLoading, setIsPartnerLoading] = useState(false);

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
                setIsUserLoading(false);
                Purchases.logOut();
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // 2. Efecto para el propio documento de usuario (depende de 'user').
    // OJO: este listener se dispara seguido (isOnline cada 30s, cambios de
    // ánimo, etc.), así que no debe crear listeners de pareja/relación aquí
    // adentro — eso es el efecto 3, con dependencias más finas.
    useEffect(() => {
        if (!user) {
            setIsUserLoading(false);
            return;
        }

        setIsUserLoading(true);
        const userDocRef = doc(db, 'users', user.uid);

        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                setPlan(data.plan || 'free');
            } else {
                // El usuario está en Auth pero no en Firestore
                auth.signOut();
            }
            setIsUserLoading(false);
        });

        return () => unsubscribeUser();
    }, [user]);

    // 3. Efecto para pareja + relación. Depende del uid de la pareja (un
    // string plano), NO del objeto 'userData' completo — así solo se vuelve
    // a suscribir cuando la pareja realmente cambia, y su cleanup (real,
    // a diferencia del anterior) cierra ambos listeners antes de abrir otros.
    const partnerId: string | null = userData?.partnerId ?? null;

    useEffect(() => {
        if (!user || !partnerId) {
            setPartnerData(null);
            setRelationshipData(null);
            setIsPartnerLoading(false);
            return;
        }

        setIsPartnerLoading(true);
        const relationshipId = [user.uid, partnerId].sort().join('_');

        const partnerDocRef = doc(db, 'users', partnerId);
        const unsubscribePartner = onSnapshot(partnerDocRef, (partnerSnap) => {
            setPartnerData(partnerSnap.data() || null);
        });

        const relationshipDocRef = doc(db, 'relationships', relationshipId);
        const unsubscribeRelationship = onSnapshot(relationshipDocRef, (relSnap) => {
            setRelationshipData(relSnap.data() || null);
            setIsPartnerLoading(false);
        });

        return () => {
            unsubscribePartner();
            unsubscribeRelationship();
        };
    }, [user, partnerId]);

    const isLoading = isUserLoading || isPartnerLoading;

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