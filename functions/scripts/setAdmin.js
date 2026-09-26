// Da (o quita) el permiso de administrador del panel — Sprint 10.1.
//
// Uso, desde la carpeta 'functions':
//
//   node scripts/setAdmin.js persona@correo.com --key C:\ruta\a\la\llave.json
//   node scripts/setAdmin.js persona@correo.com --key ... --quitar
//
// La llave es un JSON de cuenta de servicio, que se descarga una vez desde
// la consola de Firebase:
//   Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave
//   privada.
//
// Guárdala FUERA del repositorio. Es una llave con permisos de administrador
// sobre todo el proyecto: quien la tenga puede leer y escribir cualquier cosa,
// sin pasar por las reglas de seguridad.
//
// También sirve sin --key si ya tienes configurado uno de estos:
//   - la variable GOOGLE_APPLICATION_CREDENTIALS apuntando a ese mismo JSON
//   - 'gcloud auth application-default login'
//
// Por qué un script y no una pantalla en la app: el primer administrador no
// puede darse el permiso a sí mismo desde dentro del producto sin abrir una
// puerta para que cualquiera lo haga. Se otorga desde fuera, con las llaves
// del proyecto en la mano, que es justo lo que no tiene un atacante.
//
// El permiso es un 'custom claim': viaja dentro del token de Auth, así que
// las reglas de Firestore lo leen sin una consulta extra y ningún cliente
// puede escribírselo.

const fs = require('fs');
const path = require('path');
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const args = process.argv.slice(2);
const email = args.find(a => !a.startsWith('--'));
const revoke = args.includes('--quitar');

const keyFlagIndex = args.indexOf('--key');
const keyPath = keyFlagIndex >= 0 ? args[keyFlagIndex + 1] : process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!email) {
    console.error('Falta el correo.');
    console.error('  node scripts/setAdmin.js persona@correo.com --key ruta\\a\\la\\llave.json [--quitar]');
    process.exit(1);
}

// El id del proyecto sale del .firebaserc del repo, que es donde ya vive.
// Sin esto, el SDK intenta averiguarlo preguntándole al servidor de metadatos
// de Google Cloud — que solo existe dentro de Google — y falla con un
// ENOTFOUND de metadata.google.internal, que no explica nada de lo que pasa.
const readProjectId = () => {
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT;
    try {
        const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.firebaserc'), 'utf8'));
        return rc.projects?.default ?? null;
    } catch {
        return null;
    }
};

const projectId = readProjectId();
if (!projectId) {
    console.error('No se pudo determinar el proyecto. Revisa que exista .firebaserc en la raíz del repo.');
    process.exit(1);
}

let credential;
if (keyPath) {
    if (!fs.existsSync(keyPath)) {
        console.error(`No existe el archivo de llave: ${keyPath}`);
        process.exit(1);
    }
    credential = cert(require(path.resolve(keyPath)));
} else {
    credential = applicationDefault();
}

initializeApp({ credential, projectId });

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
        console.log('Cierra sesión y vuelve a entrar en la app para que el cambio surta efecto.');
    } catch (error) {
        const code = error?.errorInfo?.code || error?.code || '';

        if (code === 'auth/user-not-found') {
            console.error(`No hay ninguna cuenta registrada con ${email}.`);
        } else if (String(error?.message || '').includes('metadata.google.internal')) {
            // El caso que trae acá a casi todo el mundo la primera vez.
            console.error('No hay credenciales disponibles en este equipo.');
            console.error('');
            console.error('Descarga una llave desde la consola de Firebase:');
            console.error('  Configuración del proyecto -> Cuentas de servicio -> Generar nueva clave privada');
            console.error('');
            console.error('Y vuelve a correrlo apuntando a ese archivo:');
            console.error(`  node scripts/setAdmin.js ${email} --key C:\\ruta\\a\\la\\llave.json`);
        } else {
            console.error('No se pudo cambiar el permiso:', error?.message || error);
        }
        process.exit(1);
    }
})();
