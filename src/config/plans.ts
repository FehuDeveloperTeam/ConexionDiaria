// Topes de almacenamiento por plan — Sprint 11.3.
//
// Estaban escritos dos veces, en chat.tsx y en notes.tsx, con el mismo número
// mágico repetido. Peor: solo existían en el cliente, así que el tope del plan
// gratuito era una sugerencia — cualquiera con el build web y la consola del
// navegador abierta podía subir lo que quisiera.
//
// Ahora el número vive acá, el servidor lo copia al documento de la relación
// cuando cambia el plan (functions/src/storageLimit.ts) y la regla de Storage
// lo hace cumplir de verdad. El cliente sigue usándolo para mostrar la barra
// de uso y para avisar ANTES de subir, que es cortesía; la barrera real está
// en la regla.

export const FREE_STORAGE_BYTES = 100 * 1024 * 1024;        // 100 MB
export const PREMIUM_STORAGE_BYTES = 25 * 1024 * 1024 * 1024; // 25 GB

export const storageLimitFor = (plan: 'free' | 'premium'): number =>
    plan === 'premium' ? PREMIUM_STORAGE_BYTES : FREE_STORAGE_BYTES;
