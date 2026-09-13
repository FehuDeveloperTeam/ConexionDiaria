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
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

const firestoreRules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const storageRules = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8');

// UIDs con la forma real de Firebase Auth: alfanuméricos, sin guion bajo.
// Importa: el id de relación es 'uid1_uid2' y las reglas lo parten con
// split('_'), así que un uid con '_' rompería esa cuenta.
const ALICE = 'aliceAAAAAAAAAAAAAAAAAAAAAA1';
const BOB = 'bobBBBBBBBBBBBBBBBBBBBBBBBB2';
const EVE = 'eveEEEEEEEEEEEEEEEEEEEEEEEE3'; // atacante: se registró, nada más
const SOLO = 'soloSSSSSSSSSSSSSSSSSSSSSSS4'; // registrado, todavía sin pareja
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

    // Perfiles mínimos para las pruebas de emparejamiento (F-02): Alice y
    // Bob ya son pareja, Eve y Solo están registrados pero sin pareja.
    await setDoc(doc(db, 'users', ALICE), { partnerId: BOB });
    await setDoc(doc(db, 'users', BOB), { partnerId: ALICE });
    await setDoc(doc(db, 'users', EVE), { partnerId: null });
    await setDoc(doc(db, 'users', SOLO), { partnerId: null });

    // Documento de relación con 'usedStorage' ya calculado, como lo dejaría
    // la Cloud Function de contabilidad de Storage (F-04, F-05).
    await setDoc(doc(db, 'relationships', REL), { usedStorage: 1000 });

    // Token de push de Alice en su subcolección privada (F-06).
    await setDoc(doc(db, 'users', ALICE, 'private', 'push'), { expoPushToken: 'tok-alice' });

    const st = ctx.storage();
    await uploadBytes(ref(st, `relationships/${REL}/images/foto.jpg`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `relationships/${REL}/audios/nota.m4a`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `albums/${REL}/recuerdo.jpg`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `avatars/${ALICE}/perfil.jpg`), new Uint8Array([1, 2, 3]));
});

const alice = testEnv.authenticatedContext(ALICE);
const bob = testEnv.authenticatedContext(BOB);
const eve = testEnv.authenticatedContext(EVE);
const solo = testEnv.authenticatedContext(SOLO);

console.log('\nEmparejamiento (Firestore) — F-02');

await check(
    'ATAQUE: Eve NO puede forzar su uid como partnerId de alguien sin pareja',
    assertFails(updateDoc(doc(eve.firestore(), 'users', SOLO), { partnerId: EVE }))
);
await check(
    'ATAQUE: Eve NO puede ponerse a sí misma un partnerId inventado',
    assertFails(updateDoc(doc(eve.firestore(), 'users', EVE), { partnerId: SOLO }))
);
await check(
    'ATAQUE: Eve NO puede liberar la pareja de Alice y Bob sin ser parte de ella',
    assertFails(updateDoc(doc(eve.firestore(), 'users', BOB), { partnerId: null }))
);
await check(
    'LEGÍTIMO: Solo sí puede seguir sin pareja (no toca partnerId)',
    assertSucceeds(updateDoc(doc(solo.firestore(), 'users', SOLO), { mood: '😊' }))
);
await check(
    'LEGÍTIMO: Alice sí puede desconectarse (su propio partnerId -> null)',
    assertSucceeds(updateDoc(doc(alice.firestore(), 'users', ALICE), { partnerId: null }))
);
await check(
    'LEGÍTIMO: Alice sí puede liberar a Bob, que hoy la tiene como pareja',
    assertSucceeds(updateDoc(doc(alice.firestore(), 'users', BOB), { partnerId: null }))
);

console.log('\nContabilidad de almacenamiento (Firestore) — F-04, F-05');

await check(
    'ATAQUE: Alice NO puede bajar usedStorage a 0 para saltarse el tope',
    assertFails(updateDoc(doc(alice.firestore(), 'relationships', REL), { usedStorage: 0 }))
);
await check(
    'ATAQUE: Alice NO puede subir usedStorage a mano tampoco',
    assertFails(updateDoc(doc(alice.firestore(), 'relationships', REL), { usedStorage: 999999 }))
);
await check(
    'ATAQUE: Eve NO puede crear el documento de su relación con usedStorage ya puesto',
    assertFails(setDoc(doc(eve.firestore(), 'relationships', [EVE, SOLO].sort().join('_')), { usedStorage: 0 }))
);
await check(
    'LEGÍTIMO: Alice sí puede seguir escribiendo el resto del documento de relación',
    assertSucceeds(updateDoc(doc(alice.firestore(), 'relationships', REL), { lastResetDate: '2024-01-01' }))
);

console.log('\nToken de push (Firestore) — F-06');

await check(
    'ATAQUE: Bob NO puede leer el token de push de Alice, aunque sea su pareja',
    assertFails(getDoc(doc(bob.firestore(), 'users', ALICE, 'private', 'push')))
);
await check(
    'LEGÍTIMO: Alice sí puede leer su propio token de push',
    assertSucceeds(getDoc(doc(alice.firestore(), 'users', ALICE, 'private', 'push')))
);

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
