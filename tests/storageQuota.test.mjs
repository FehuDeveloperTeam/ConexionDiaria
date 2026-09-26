// Pruebas del cupo de almacenamiento — Sprint 11.3.
//
// Corre con:  npm run test:storage
//
// Por qué existen: el tope del plan gratuito se validaba solo en el cliente, o
// sea no se validaba. Al moverlo al servidor, lo que hay que comprobar es que
// las tres decisiones estén bien — qué rutas cuentan, cuál es el tope cuando
// el dato falta, y cuál es el tope de una pareja mixta. Si cualquiera de las
// tres está mal, el síntoma no es un error: es que el cupo se aplica a quien
// no corresponde, o no se aplica a nadie.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
    FREE_STORAGE_BYTES, PREMIUM_STORAGE_BYTES,
    relationshipIdFromPath, limitFromRelationship, limitForPlans, exceedsQuota,
} = require('./.tmp-storage/storageQuota.js');

let pass = 0, fail = 0;
const failures = [];
const check = (nombre, cond, detalle = '') => {
    if (cond) { console.log(`  ✓ ${nombre}`); pass++; }
    else { console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fail++; failures.push(nombre); }
};

const REL = 'aliceAAA_bobBBB';

console.log('\nQué rutas cuentan para el cupo');

check('un adjunto del chat cuenta', relationshipIdFromPath(`relationships/${REL}/images/foto.jpg`) === REL);
check('una nota de voz cuenta', relationshipIdFromPath(`relationships/${REL}/audios/nota.m4a`) === REL);
check('un video cuenta', relationshipIdFromPath(`relationships/${REL}/videos/clip.mp4`) === REL);
check('una foto del álbum cuenta', relationshipIdFromPath(`albums/${REL}/recuerdo.jpg`) === REL);
check(
    // Cobrarle la foto de perfil al cupo compartido sería tan injusto como
    // difícil de explicar.
    'la foto de perfil NO cuenta',
    relationshipIdFromPath('avatars/aliceAAA/perfil.jpg') === null
);
check('una ruta desconocida no cuenta', relationshipIdFromPath('otracosa/x/y.jpg') === null);
check('sin ruta no cuenta', relationshipIdFromPath(undefined) === null);
check(
    'una ruta sin archivo dentro no cuenta',
    relationshipIdFromPath(`relationships/${REL}`) === null
);

console.log('\nCuál es el tope');

check(
    // El caso que convertiría el cupo en barra libre: un documento viejo o a
    // medio crear, sin el campo.
    'sin storageLimit se aplica el plan gratuito, no "sin límite"',
    limitFromRelationship({}) === FREE_STORAGE_BYTES
);
check('sin documento tampoco hay barra libre', limitFromRelationship(undefined) === FREE_STORAGE_BYTES);
check('un storageLimit válido se respeta', limitFromRelationship({ storageLimit: PREMIUM_STORAGE_BYTES }) === PREMIUM_STORAGE_BYTES);
check('un storageLimit en cero cae al gratuito', limitFromRelationship({ storageLimit: 0 }) === FREE_STORAGE_BYTES);
check('un storageLimit negativo cae al gratuito', limitFromRelationship({ storageLimit: -1 }) === FREE_STORAGE_BYTES);
check('un storageLimit de texto cae al gratuito', limitFromRelationship({ storageLimit: '999999999' }) === FREE_STORAGE_BYTES);

console.log('\nEl tope de una pareja sigue al miembro más generoso');

check('los dos en gratuito', limitForPlans('free', 'free') === FREE_STORAGE_BYTES);
check('uno paga y ambos disfrutan (A)', limitForPlans('premium', 'free') === PREMIUM_STORAGE_BYTES);
check('uno paga y ambos disfrutan (B)', limitForPlans('free', 'premium') === PREMIUM_STORAGE_BYTES);
check('los dos pagan', limitForPlans('premium', 'premium') === PREMIUM_STORAGE_BYTES);
check('un plan ausente se trata como gratuito', limitForPlans(undefined, undefined) === FREE_STORAGE_BYTES);

console.log('\nLa comparación');

check('justo en el tope todavía cabe', exceedsQuota(FREE_STORAGE_BYTES, FREE_STORAGE_BYTES) === false);
check('un byte sobre el tope no cabe', exceedsQuota(FREE_STORAGE_BYTES + 1, FREE_STORAGE_BYTES) === true);
check('bien por debajo cabe', exceedsQuota(1024, FREE_STORAGE_BYTES) === false);
check('el gratuito son 100 MB', FREE_STORAGE_BYTES === 104857600);
check('el premium son 25 GB', PREMIUM_STORAGE_BYTES === 26843545600);

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) console.log(`  Fallaron: ${failures.join(' | ')}`);
console.log('='.repeat(58));
process.exit(fail > 0 ? 1 : 0);
