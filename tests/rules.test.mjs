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
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
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

    // Una foto del álbum, para las pruebas de reacciones y comentarios (9.27).
    await setDoc(doc(db, 'relationships', REL, 'photos', 'foto1'), {
        imageUrl: 'https://example.test/foto1.jpg', authorId: ALICE,
    });

    // Métricas del panel, como las dejaría el servidor (Sprint 10.1).
    await setDoc(doc(db, 'adminMetrics', 'summary'), { totalUsers: 12, totalCouples: 5, premiumUsers: 2 });
    await setDoc(doc(db, 'adminDaily', '2026-09-14'), { date: '2026-09-14', messages: 48, activeUsers: 7 });

    // Contador de fundadores, como lo dejaría el webhook (Sprint 9.17).
    await setDoc(doc(db, 'appConfig', 'founders'), { claimed: 12, limit: 500 });

    // Token de push de Alice en su subcolección privada (F-06).
    await setDoc(doc(db, 'users', ALICE, 'private', 'push'), { expoPushToken: 'tok-alice' });

    const st = ctx.storage();
    await uploadBytes(ref(st, `relationships/${REL}/images/foto.jpg`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `relationships/${REL}/audios/nota.m4a`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `relationships/${REL}/videos/clip.mp4`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `albums/${REL}/recuerdo.jpg`), new Uint8Array([1, 2, 3]));
    await uploadBytes(ref(st, `avatars/${ALICE}/perfil.jpg`), new Uint8Array([1, 2, 3]));
});

const alice = testEnv.authenticatedContext(ALICE);
const bob = testEnv.authenticatedContext(BOB);
const eve = testEnv.authenticatedContext(EVE);
const solo = testEnv.authenticatedContext(SOLO);

// El permiso de administrador viaja como custom claim en el token, no como un
// documento: por eso se declara acá y no en la semilla de Firestore.
const admin = testEnv.authenticatedContext('adminAAAAAAAAAAAAAAAAAAAAAA7', { admin: true });

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

// Subcolección nueva en el Sprint 9.9. Sin una regla propia habría quedado
// denegada por defecto, así que estas pruebas cubren las dos caras: que la
// pareja pueda organizar su agenda y que nadie más entre.
console.log('\nGrupos de tareas (Firestore) — Sprint 9.9');

await check(
    'ATAQUE: Eve NO puede leer los grupos de tareas de otra pareja',
    assertFails(getDocs(collection(eve.firestore(), 'relationships', REL, 'taskGroups')))
);
await check(
    'ATAQUE: Eve NO puede crear un grupo en la relación de Alice y Bob',
    assertFails(setDoc(doc(eve.firestore(), 'relationships', REL, 'taskGroups', 'infiltrado'), { name: 'Infiltrado' }))
);
await check(
    'LEGÍTIMO: Alice sí puede crear un grupo en su relación',
    assertSucceeds(setDoc(doc(alice.firestore(), 'relationships', REL, 'taskGroups', 'finde'), { name: 'Compras del finde', authorId: ALICE }))
);
await check(
    'LEGÍTIMO: Bob sí puede leer los grupos que creó Alice',
    assertSucceeds(getDoc(doc(bob.firestore(), 'relationships', REL, 'taskGroups', 'finde')))
);
await check(
    'LEGÍTIMO: Bob sí puede renombrar un grupo creado por Alice (la agenda es compartida)',
    assertSucceeds(updateDoc(doc(bob.firestore(), 'relationships', REL, 'taskGroups', 'finde'), { name: 'Compras' }))
);
await check(
    'LEGÍTIMO: Bob sí puede borrar un grupo creado por Alice (borrarlo no borra tareas)',
    assertSucceeds(deleteDoc(doc(bob.firestore(), 'relationships', REL, 'taskGroups', 'finde')))
);

console.log('\nTallas (Firestore) — Sprint 9.24');

// Las pruebas de emparejamiento de más arriba terminan desconectando a Alice
// y a Bob (es justo lo que comprueban). Como acá hace falta que SÍ sean
// pareja para distinguir "lo lee su pareja" de "lo lee cualquiera", se
// rehace el vínculo saltándose las reglas, igual que la semilla inicial.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ALICE), { partnerId: BOB });
    await setDoc(doc(db, 'users', BOB), { partnerId: ALICE });
});

// Dos destinos distintos a propósito, y las reglas son lo único que los
// separa: MIS tallas van en mi perfil para que mi pareja las lea, y lo que yo
// ANOTO de ella va en mi subcolección privada, donde ella no entra. Si un día
// alguien moviera las anotaciones al perfil "por comodidad", esta tanda de
// pruebas es la que lo cacha.
await check(
    'LEGÍTIMO: Alice puede declarar sus propias tallas en su perfil',
    assertSucceeds(updateDoc(doc(alice.firestore(), 'users', ALICE), { measurements: { topSize: 'M', shoeSize: '38' } }))
);
await check(
    'LEGÍTIMO: Bob sí puede leer las tallas que declaró Alice (para eso están)',
    assertSucceeds(getDoc(doc(bob.firestore(), 'users', ALICE)))
);
await check(
    'ATAQUE: Eve NO puede leer las tallas de Alice',
    assertFails(getDoc(doc(eve.firestore(), 'users', ALICE)))
);
await check(
    'ATAQUE: Bob NO puede escribir las tallas de Alice, aunque sea su pareja',
    assertFails(updateDoc(doc(bob.firestore(), 'users', ALICE), { measurements: { topSize: 'XXL' } }))
);
await check(
    'ATAQUE: Bob NO puede leer lo que Alice anotó de ÉL en su ficha privada',
    assertFails(getDoc(doc(bob.firestore(), 'users', ALICE, 'private', 'partnerProfile')))
);
await check(
    'LEGÍTIMO: Alice sí puede guardar sus anotaciones privadas sobre Bob',
    assertSucceeds(setDoc(doc(alice.firestore(), 'users', ALICE, 'private', 'partnerProfile'), { topSize: 'L', notes: 'le gusta holgada' }))
);
await check(
    'ATAQUE: Alice NO puede colarse a premium de paso al guardar sus tallas',
    assertFails(updateDoc(doc(alice.firestore(), 'users', ALICE), { measurements: { topSize: 'M' }, plan: 'premium' }))
);

console.log('\nContador de fundadores (Firestore) — Sprint 9.17');

// El cupo de fundador es lo primero que alguien querría falsificar: dejarlo
// en 499 para siempre significa comprar a US$2,99 el resto de la vida. Por eso
// la colección entera es de solo lectura para el cliente.
await check(
    'LEGÍTIMO: Alice sí puede leer cuántos cupos de fundador quedan',
    assertSucceeds(getDoc(doc(alice.firestore(), 'appConfig', 'founders')))
);
await check(
    'ATAQUE: Alice NO puede bajar el contador de fundadores',
    assertFails(updateDoc(doc(alice.firestore(), 'appConfig', 'founders'), { claimed: 0 }))
);
await check(
    'ATAQUE: Alice NO puede subir el tope de cupos',
    assertFails(updateDoc(doc(alice.firestore(), 'appConfig', 'founders'), { limit: 999999 }))
);
await check(
    'ATAQUE: Eve NO puede inventar otro documento de configuración',
    assertFails(setDoc(doc(eve.firestore(), 'appConfig', 'inventado'), { claimed: 0 }))
);
await check(
    'ATAQUE: nadie puede enumerar appConfig',
    assertFails(getDocs(collection(alice.firestore(), 'appConfig')))
);
await check(
    'ATAQUE: Alice NO puede darse un número de fundador a sí misma',
    // Sin 'plan' en la misma escritura: lo que se comprueba es que
    // 'founderNumber' esté bloqueado POR SÍ SOLO. Con el plan al lado, la
    // prueba pasaba por el motivo equivocado y el hueco seguía abierto.
    assertFails(updateDoc(doc(alice.firestore(), 'users', ALICE), { founderNumber: 1 }))
);
await check(
    'ATAQUE: nadie puede registrarse ya con número de fundador',
    assertFails(setDoc(doc(eve.firestore(), 'users', 'nuevoUsuarioXXXXXXXXXXXXXX9'), { plan: 'free', premiumSince: null, founderNumber: 1 }))
);

console.log('\nPregunta del día (Firestore) — Sprint 9.21');

// Las dos respuestas del día viven en un mismo documento, así que lo que hay
// que comprobar es que ese formato no le regale a nadie la respuesta del otro.
await check(
    'LEGÍTIMO: Alice responde la pregunta de hoy',
    assertSucceeds(setDoc(doc(alice.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-15'), {
        questionIndex: 4,
        answers: { [ALICE]: 'Lo mejor fue el almuerzo' },
    }))
);
await check(
    'ATAQUE: Alice NO puede crear el documento respondiendo por Bob',
    assertFails(setDoc(doc(alice.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-20'), {
        questionIndex: 9,
        answers: { [BOB]: 'esto lo escribió Alice' },
    }))
);
await check(
    'LEGÍTIMO: Bob agrega la suya sin tocar la de Alice',
    assertSucceeds(updateDoc(doc(bob.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-15'), {
        [`answers.${BOB}`]: 'A mí me gustó la tarde',
    }))
);
await check(
    'ATAQUE: Bob NO puede reescribir la respuesta de Alice',
    assertFails(updateDoc(doc(bob.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-15'), {
        [`answers.${ALICE}`]: 'texto puesto por Bob',
    }))
);
await check(
    'ATAQUE: Bob NO puede borrar la respuesta de Alice reemplazando el mapa',
    assertFails(setDoc(doc(bob.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-15'), {
        questionIndex: 4,
        answers: { [BOB]: 'solo la mía' },
    }))
);
await check(
    'LEGÍTIMO: Alice sí puede corregir su propia respuesta',
    assertSucceeds(updateDoc(doc(alice.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-15'), {
        [`answers.${ALICE}`]: 'Pensándolo bien, lo mejor fue la caminata',
    }))
);
await check(
    'LEGÍTIMO: Bob puede leer el archivo de respuestas de su relación',
    assertSucceeds(getDocs(collection(bob.firestore(), 'relationships', REL, 'dailyQuestions')))
);
await check(
    'ATAQUE: Eve NO puede leer las respuestas de otra pareja',
    assertFails(getDocs(collection(eve.firestore(), 'relationships', REL, 'dailyQuestions')))
);
await check(
    'ATAQUE: lo respondido no se puede borrar',
    assertFails(deleteDoc(doc(alice.firestore(), 'relationships', REL, 'dailyQuestions', '2026-09-15')))
);

console.log('\nVideo del chat (Storage) — Sprint 9.23');

// Los videos van por la misma ruta comodín que imágenes y audios
// (relationships/{rel}/{tipo}/{archivo}), así que ya estaban cubiertos por la
// regla existente. Estas pruebas lo dejan escrito: si algún día alguien
// reemplaza el comodín por rutas explícitas, el video no puede quedarse fuera
// sin que falle algo.
await check(
    'ATAQUE: Eve NO puede descargar un video del chat ajeno',
    assertFails(getBytes(ref(eve.storage(), `relationships/${REL}/videos/clip.mp4`)))
);
await check(
    'ATAQUE: Eve NO puede borrar un video del chat ajeno',
    assertFails(deleteObject(ref(eve.storage(), `relationships/${REL}/videos/clip.mp4`)))
);
await check(
    'LEGÍTIMO: Alice sí puede subir un video a su relación',
    assertSucceeds(uploadBytes(ref(alice.storage(), `relationships/${REL}/videos/otro.mp4`), new Uint8Array([1, 2, 3])))
);
await check(
    'LEGÍTIMO: Bob sí puede leer el video que subió Alice',
    assertSucceeds(getBytes(ref(bob.storage(), `relationships/${REL}/videos/clip.mp4`)))
);

console.log('\nReacciones y comentarios del álbum (Firestore) — Sprint 9.27');

await check(
    'LEGÍTIMO: Bob puede reaccionar a una foto de Alice',
    assertSucceeds(setDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'reactions', BOB), { emoji: '❤️' }))
);
await check(
    // El id del documento TIENE que ser el uid de quien escribe, así que
    // reaccionar por el otro no es algo que la regla permita discutir.
    'ATAQUE: Bob NO puede reaccionar en nombre de Alice',
    assertFails(setDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'reactions', ALICE), { emoji: '❤️' }))
);
await check(
    'ATAQUE: Bob NO puede borrar la reacción de Alice',
    assertFails(deleteDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'reactions', ALICE)))
);
await check(
    'LEGÍTIMO: Bob sí puede quitar la suya',
    assertSucceeds(deleteDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'reactions', BOB)))
);
await check(
    'LEGÍTIMO: Alice comenta su propia foto',
    assertSucceeds(setDoc(doc(alice.firestore(), 'relationships', REL, 'photos', 'foto1', 'comments', 'c1'), {
        text: 'Este día lo pasamos increíble', authorId: ALICE, authorName: 'Alice',
    }))
);
await check(
    'ATAQUE: Bob NO puede publicar un comentario firmado por Alice',
    assertFails(setDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'comments', 'c2'), {
        text: 'esto lo escribió Bob', authorId: ALICE, authorName: 'Alice',
    }))
);
await check(
    'ATAQUE: Bob NO puede editar el comentario de Alice',
    assertFails(updateDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'comments', 'c1'), { text: 'cambiado' }))
);
await check(
    'ATAQUE: Bob NO puede borrar el comentario de Alice',
    assertFails(deleteDoc(doc(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'comments', 'c1')))
);
await check(
    'LEGÍTIMO: Bob sí puede leer los comentarios de la foto',
    assertSucceeds(getDocs(collection(bob.firestore(), 'relationships', REL, 'photos', 'foto1', 'comments')))
);
await check(
    'ATAQUE: Eve NO puede leer los comentarios de una foto ajena',
    assertFails(getDocs(collection(eve.firestore(), 'relationships', REL, 'photos', 'foto1', 'comments')))
);
await check(
    // El contador lo escribe la Cloud Function con Admin SDK. Si el cliente
    // pudiera tocarlo, el número dejaría de significar nada.
    'ATAQUE: nadie puede inflar a mano el contador de comentarios de la foto',
    assertFails(updateDoc(doc(alice.firestore(), 'relationships', REL, 'photos', 'foto1'), { commentCount: 99 }))
);

console.log('\nPanel administrativo (Firestore) — Sprint 10.1');

await check(
    'LEGÍTIMO: un administrador puede leer el resumen',
    assertSucceeds(getDoc(doc(admin.firestore(), 'adminMetrics', 'summary')))
);
await check(
    'LEGÍTIMO: un administrador puede listar los días',
    assertSucceeds(getDocs(collection(admin.firestore(), 'adminDaily')))
);
await check(
    'ATAQUE: un usuario cualquiera NO puede leer el resumen',
    assertFails(getDoc(doc(alice.firestore(), 'adminMetrics', 'summary')))
);
await check(
    'ATAQUE: un usuario cualquiera NO puede listar los días',
    assertFails(getDocs(collection(eve.firestore(), 'adminDaily')))
);
await check(
    // El claim no se puede autoasignar —lo pone el servidor en el token—,
    // pero aunque alguien lo lograra, escribir sigue cerrado: un panel que
    // pueda editar sus propias métricas no mide nada.
    'ATAQUE: ni siquiera un administrador puede escribir las métricas',
    assertFails(setDoc(doc(admin.firestore(), 'adminMetrics', 'summary'), { totalUsers: 9999 }))
);
await check(
    'ATAQUE: un administrador tampoco puede tocar un día',
    assertFails(updateDoc(doc(admin.firestore(), 'adminDaily', '2026-09-14'), { messages: 0 }))
);
await check(
    'LEGÍTIMO: un administrador puede leer el embudo por cohorte',
    assertSucceeds(getDocs(collection(admin.firestore(), 'adminCohorts')))
);
await check(
    'ATAQUE: un usuario cualquiera NO puede leer el embudo',
    assertFails(getDoc(doc(alice.firestore(), 'adminCohorts', '2026-09')))
);
await check(
    'ATAQUE: ni un administrador puede escribir una cohorte',
    assertFails(updateDoc(doc(admin.firestore(), 'adminCohorts', '2026-09'), { premium: 999 }))
);
await check(
    // El panel es de números agregados. Ser administrador no da acceso a los
    // datos de una pareja: para el soporte hay una función que devuelve cinco
    // campos y nada más.
    'ATAQUE: ser administrador NO abre los mensajes de una pareja',
    assertFails(getDocs(collection(admin.firestore(), 'relationships', REL, 'messages')))
);
await check(
    'ATAQUE: ser administrador NO abre el perfil de otra persona',
    assertFails(getDoc(doc(admin.firestore(), 'users', ALICE)))
);

console.log('\nCupo de almacenamiento — Sprint 11.3');

// El tope TOTAL no se valida en storage.rules: las reglas entre servicios
// (firestore.get() desde Storage) no funcionan en el emulador, comprobado con
// una sonda —firestore.exists() devuelve false aunque el documento esté ahí—,
// así que una regla así no se podría probar antes de desplegarla. Se hace
// cumplir en functions/src/storageAccounting.ts, y su lógica de decisión tiene
// pruebas propias en tests/storageQuota.test.mjs.
//
// Lo que SÍ depende de las reglas, y se comprueba acá, es que el cliente no
// pueda tocar los dos números con los que el servidor decide.
const CUPO_PREMIUM = 25 * 1024 * 1024 * 1024;

await check(
    'ATAQUE: Alice NO puede subirse el tope de almacenamiento a sí misma',
    assertFails(updateDoc(doc(alice.firestore(), 'relationships', REL), { storageLimit: CUPO_PREMIUM * 10 }))
);
await check(
    'ATAQUE: Eve NO puede crear una relación con el tope ya puesto',
    assertFails(setDoc(doc(eve.firestore(), 'relationships', 'eveEEEEEEEEEEEEEEEEEEEEEEEE3_soloSSSSSSSSSSSSSSSSSSSSSSS4'), {
        members: [EVE, SOLO], storageLimit: CUPO_PREMIUM,
    }))
);
await check(
    'ATAQUE: Alice tampoco puede bajar usedStorage y storageLimit en la misma escritura',
    assertFails(updateDoc(doc(alice.firestore(), 'relationships', REL), { usedStorage: 0, storageLimit: CUPO_PREMIUM }))
);

await testEnv.cleanup();

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) {
    console.log(`  Fallaron: ${failures.join(' | ')}`);
}
console.log('='.repeat(58));
process.exit(fail > 0 ? 1 : 0);
