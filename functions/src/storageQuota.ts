// Decisiones del cupo de almacenamiento, sin dependencias — Sprint 11.3.
//
// Vive aparte de storageAccounting.ts y de storageLimit.ts a propósito: acá no
// se importa firebase-admin ni nada, así que se puede probar
// (tests/storageQuota.test.mjs). El resto de esos archivos es plomería —
// transacciones, borrados, disparadores—, pero las decisiones son estas tres,
// y son justo las que si están mal no se notan: el cupo simplemente no se
// aplica, o se aplica a quien no corresponde.

// Deben coincidir con src/config/plans.ts del cliente. No se comparte el
// archivo porque functions/ tiene su propio tsconfig y su propio build;
// duplicar dos constantes es más barato que enredar los dos proyectos, pero si
// cambian tienen que cambiar juntas.
export const FREE_STORAGE_BYTES = 100 * 1024 * 1024;
export const PREMIUM_STORAGE_BYTES = 25 * 1024 * 1024 * 1024;

// Qué rutas de Storage cuentan para el cupo de una pareja.
//
// 'avatars/{uid}/…' NO cuenta: es del usuario, no de la pareja, y cobrarle la
// foto de perfil al cupo compartido sería tan injusto como difícil de
// explicar. Cualquier ruta que no calce con ninguna regla tampoco cuenta.
export const relationshipIdFromPath = (path: string | undefined | null): string | null => {
    if (!path) return null;
    const match = path.match(/^(?:relationships|albums)\/([^/]+)\//);
    return match ? match[1] : null;
};

// El tope de la pareja. Ausente significa plan gratuito, no "sin límite": un
// documento viejo o a medio crear no puede equivaler a barra libre.
export const limitFromRelationship = (data: { storageLimit?: unknown } | undefined | null): number => {
    const raw = data?.storageLimit;
    return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : FREE_STORAGE_BYTES;
};

// El tope de la pareja según los planes de sus dos miembros. Basta que uno sea
// premium: "uno paga, ambos disfrutan" es el modelo del producto, así que el
// cupo compartido tiene que seguir al miembro más generoso.
export const limitForPlans = (planA: unknown, planB: unknown): number =>
    planA === 'premium' || planB === 'premium' ? PREMIUM_STORAGE_BYTES : FREE_STORAGE_BYTES;

export const exceedsQuota = (used: number, limit: number): boolean => used > limit;
