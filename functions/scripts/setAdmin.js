// Da (o quita) el permiso de administrador del panel — Sprint 10.1.
//
// Uso, desde la carpeta 'functions' y con credenciales de la cuenta de
// servicio disponibles:
//
//   node scripts/setAdmin.js persona@correo.com
//   node scripts/setAdmin.js persona@correo.com --quitar
//
// Las credenciales salen de GOOGLE_APPLICATION_CREDENTIALS (la ruta a un JSON
// de cuenta de servicio) o de haber corrido antes:
//
//   gcloud auth application-default login
//
// Por qué un script y no una pantalla en la app: el primer administrador no
// puede darse el permiso a sí mismo desde dentro del producto sin abrir una
// puerta para que cualquiera lo haga. Se otorga desde fuera, con las llaves
// del proyecto en la mano, que es justo lo que no tiene un atacante.
//
// El permiso es un 'custom claim': viaja dentro del token de Auth, así que
// las reglas de Firestore lo leen sin una consulta extra y ningún cliente
// puede escribírselo.

const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const email = process.argv[2];
const revoke = process.argv.includes('--quitar');

if (!email) {
    console.error('Falta el correo.\n  node scripts/setAdmin.js persona@correo.com [--quitar]');
    process.exit(1);
}

initializeApp({ credential: applicationDefault() });

(async () => {
    try {
        const user = await getAuth().getUserByEmail(email);

        // Se conservan los claims que ya tuviera: sobrescribir el objeto
        // entero borraría cualquier otro permiso que se agregue más adelante.
        const claims = { ...(user.customClaims || {}) };
        if (revoke) delete claims.admin;
        else claims.admin = true;

        await getAuth().setCustomUserClaims(user.uid, claims);

        console.log(revoke
            ? `Permiso de administrador retirado a ${email} (${user.uid}).`
            : `${email} (${user.uid}) ya es administrador.`);
        // El token viejo sigue siendo válido hasta que caduca (una hora), así
        // que el cambio no es instantáneo si la sesión ya estaba abierta.
        console.log('Tiene que cerrar y volver a iniciar sesión para que el cambio surta efecto.');
    } catch (error) {
        console.error('No se pudo cambiar el permiso:', error.message);
        process.exit(1);
    }
})();
