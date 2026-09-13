// Pruebas de las reglas de seguridad de Firestore y Storage.
//
// Corre con:  npm run test:rules
// (levanta los emuladores de Firebase; necesita Java instalado)
//
// Por qué existen: las reglas son la única barrera real entre los datos de
// una pareja y cualquier otra persona registrada en la app. Un error acá no
// rompe el build ni falla en TypeScript — simplemente deja la puerta
// abierta, en silencio. Estas pruebas cubren las dos caras: que los ataques
// conocidos fallen, y que los flujos legítimos de la app sigan funcionando.
//
// Escritas junto con la auditoría de seguridad que cerró los hallazgos
// F-01 (Storage sin acotar) y F-03 (enumeración de códigos de invitación).

import { readFileSync } from 'fs';
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const firestoreRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');

// UIDs con la forma real de Firebase Auth: alfanuméricos, sin guion bajo.
// Importa: el id de relación es 'uid1_uid2' y las reglas lo parten con
// split('_'), así que un uid con '_' rompería esa cuenta.
const ALICE = 'aliceAAAAAAAAAAAAAAAAAAAAAA1';
const BOB = 'bobBBBBBBBBBBBBBBBBBBBBBBBB2';
const EVE = 'eveEEEEEEEEEEEEEEEEEEEEEEEE3'; // atacante: se registró, nada más
const REL = [ALICE, BOB].sort().join('_');

let pass = 0;
let fail = 0;
const failures = [];

async function check(nombre, promesa) {
    try {
        await promesa;
        console.log(`  ✓ ${nombre}`);
        pass++;
    } catch (e) {
        console.log(`  ✗ ${nombre}`);
        console.log(`      ${e.message?.split('\n')[0]}`);
        fail++;
        failures.push(nombre);
    }
}

const testEnv = await initializeTestEnvironment({
    projectId: 'demo-conexiondiaria',
    firestore: { rules: firestoreRules, host: '127.0.0.1', port: 8080 },
    storage: { rules: storageRules, host: '127.0.0.1', port: 9199 },
});

// --- Semilla: datos que ya existirían en la app, saltándose las reglas ---
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'invitationCodes', 'ABC123'), { uid: ALICE });
    await setDoc(doc(db, 'invitationCodes', 'XYZ789'), { uid: BOB });

    const st = ctx.storage();
    await uploadBytes(ref(st, `relationships/${REL}/images/foto.jpg`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `relationships/${REL}/audios/nota.m4a`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `albums/${REL}/recuerdo.jpg`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `avatars/${ALICE}/perfil.jpg`), new Uint8Array([1, 2, 3]));
});

const alice = testEnv.authenticatedContext(ALICE);
const eve = testEnv.authenticatedContext(EVE);

console.log('\nCódigos de invitación (Firestore)');

await check(
    'ATAQUE: Eve NO puede listar la colección y llevarse todos los uid',
    assertFails(getDocs(collection(eve.firestore(), 'invitationCodes')))
);
await check(
    'LEGÍTIMO: Eve sí puede resolver un código puntual que le pasaron',
    assertSucceeds(getDoc(doc(eve.firestore(), 'invitationCodes', 'ABC123')))
);
await check(
    'LEGÍTIMO: al registrarse, puede crear su propio código',
    assertSucceeds(setDoc(doc(eve.firestore(), 'invitationCodes', 'NEW001'), { uid: EVE }))
);
await check(
    'ATAQUE: no puede crear un código que apunte a otra persona',
    assertFails(setDoc(doc(eve.firestore(), 'invitationCodes', 'NEW002'), { uid: ALICE }))
);

console.log('\nArchivos del chat (Storage)');

await check(
    'ATAQUE: Eve NO puede descargar una imagen del chat ajeno',
    assertFails(getBytes(ref(eve.storage(), `relationships/${REL}/images/foto.jpg`)))
);
await check(
    'ATAQUE: Eve NO puede descargar una nota de voz ajena',
    assertFails(getBytes(ref(eve.storage(), `relationships/${REL}/audios/nota.m4a`)))
);
await check(
    'ATAQUE: Eve NO puede BORRAR un archivo del chat ajeno',
    assertFails(deleteObject(ref(eve.storage(), `relationships/${REL}/images/foto.jpg`)))
);
await check(
    'ATAQUE: Eve NO puede pisar un archivo del chat ajeno',
    assertFails(uploadBytes(ref(eve.storage(), `relationships/${REL}/images/foto.jpg`), new Uint8Array([9])))
);
await check(
    'LEGÍTIMO: Alice sí puede leer los archivos de su propia relación',
    assertSucceeds(getBytes(ref(alice.storage(), `relationships/${REL}/images/foto.jpg`)))
);
await check(
    'LEGÍTIMO: Alice sí puede subir un adjunto a su relación',
    assertSucceeds(uploadBytes(ref(alice.storage(), `relationships/${REL}/files/doc.pdf`), new Uint8Array([1, 2])))
);

console.log('\nÁlbum (Storage)');

await check(
    'ATAQUE: Eve NO puede descargar una foto del álbum ajeno',
    assertFails(getBytes(ref(eve.storage(), `albums/${REL}/recuerdo.jpg`)))
);
await check(
    'ATAQUE: Eve NO puede borrar una foto del álbum ajeno',
    assertFails(deleteObject(ref(eve.storage(), `albums/${REL}/recuerdo.jpg`)))
);
await check(
    'LEGÍTIMO: Alice sí puede leer del álbum de su relación',
    assertSucceeds(getBytes(ref(alice.storage(), `albums/${REL}/recuerdo.jpg`)))
);

console.log('\nAvatares y rutas no declaradas (Storage)');

await check(
    'ATAQUE: Eve NO puede descargar el avatar de otra persona',
    assertFails(getBytes(ref(eve.storage(), `avatars/${ALICE}/perfil.jpg`)))
);
await check(
    'LEGÍTIMO: Alice sí puede subir su propio avatar',
    assertSucceeds(uploadBytes(ref(alice.storage(), `avatars/${ALICE}/perfil.jpg`), new Uint8Array([1, 2, 3])))
);
await check(
    'ATAQUE: Eve NO puede subir a una ruta no declarada',
    assertFails(uploadBytes(ref(eve.storage(), 'cualquier/cosa.txt'), new Uint8Array([1])))
);
await check(
    'LÍMITE: un avatar de 6 MB es rechazado (tope de 5 MB)',
    assertFails(uploadBytes(ref(alice.storage(), `avatars/${ALICE}/enorme.jpg`), new Uint8Array(6 * 1024 * 1024)))
);

await testEnv.cleanup();

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) {
    console.log(`  Fallaron: ${failures.join(' | ')}`);
}
console.log('='.repeat(58));
process.exit(fail > 0 ? 1 : 0);
