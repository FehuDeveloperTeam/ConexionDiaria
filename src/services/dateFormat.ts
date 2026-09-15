// Formato de fecha de la app: dd/mm/aaaa.
//
// Se arma a mano en vez de delegar en toLocaleDateString porque el formato
// por defecto de es-CL usa guiones (14-09-2026) y, peor, cambia según la
// configuración del dispositivo: la misma fecha se vería distinta en dos
// teléfonos. Acá se ve igual siempre.
export const formatDate = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
};
