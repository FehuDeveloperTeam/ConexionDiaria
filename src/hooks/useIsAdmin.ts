// ¿Esta sesión tiene permiso de panel? — Sprint 10.1.
//
// El permiso es un 'custom claim' del token de Auth, no un documento de
// Firestore: así las reglas lo comprueban sin una lectura extra y ningún
// cliente puede escribírselo. Se otorga desde fuera con
// functions/scripts/setAdmin.js.
//
// El token se refresca porque el claim recién concedido no aparece en el que
// ya está en memoria: sin forzarlo, alguien que acaba de recibir el permiso
// tendría que esperar a que caduque su sesión (una hora) para verlo.
import { useEffect, useState } from 'react';
import { getIdTokenResult } from 'firebase/auth';
import { usePlan } from '../contexts/planContext';

export const useIsAdmin = (): { isAdmin: boolean; isChecking: boolean } => {
    const { user } = usePlan();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsAdmin(false);
            setIsChecking(false);
            return;
        }

        let cancelled = false;
        setIsChecking(true);

        getIdTokenResult(user, true)
            .then(result => { if (!cancelled) setIsAdmin(result.claims.admin === true); })
            .catch(error => {
                console.error('No se pudo leer el token:', error);
                if (!cancelled) setIsAdmin(false);
            })
            .finally(() => { if (!cancelled) setIsChecking(false); });

        return () => { cancelled = true; };
    }, [user]);

    return { isAdmin, isChecking };
};
