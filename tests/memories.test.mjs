// Pruebas de "Un día como hoy" — Sprint 9.26.
//
// Corre con:  npm run test:memories
//
// Lo que se comprueba es que los días que se van a consultar sean los
// correctos. Un error acá no se ve: el álbum simplemente no muestra ningún
// recuerdo, o muestra el del día equivocado, y nadie tiene cómo darse cuenta
// sin ir a revisar qué foto era. Y depende de "hoy", así que a mano no se
// prueba nunca.

import { createRequire } from 'module';

// createRequire y no import: los módulos compilados son commonjs (ver
// tests/tsconfig.memories.json para el porqué).
const require = createRequire(import.meta.url);
const { memoryCandidates } = require('./.tmp-memories/memories.js');

let pass = 0;
let fail = 0;
const failures = [];

function check(nombre, condicion, detalle = '') {
    if (condicion) {
        console.log(`  ✓ ${nombre}`);
        pass++;
    } else {
        console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`);
        fail++;
        failures.push(nombre);
    }
}

const d = (y, m, day) => new Date(y, m - 1, day);
const HOY = d(2026, 9, 15);

console.log('\nQué días se miran');

const todos = memoryCandidates(HOY, null);

check('sin fecha de inicio se miran medio año y cinco años atrás', todos.length === 6);
check('el primero es el de hace 6 meses', todos[0].label === 'Hace 6 meses');
check(
    'hace 6 meses del 15 de septiembre es el 15 de marzo',
    todos[0].start.getFullYear() === 2026 && todos[0].start.getMonth() === 2 && todos[0].start.getDate() === 15
);
check('un año va en singular', todos[1].label === 'Hace un año');
check('dos años va en plural', todos[2].label === 'Hace 2 años');
check(
    'hace un año es el mismo día del año anterior',
    todos[1].start.getFullYear() === 2025 && todos[1].start.getMonth() === 8 && todos[1].start.getDate() === 15
);
check('van del más cercano al más lejano', todos[5].label === 'Hace 5 años');

console.log('\nEl rango cubre el día entero');

const rango = todos[0];
check('empieza a las 00:00:00.000', rango.start.getHours() === 0 && rango.start.getMinutes() === 0 && rango.start.getMilliseconds() === 0);
check('termina a las 23:59:59.999', rango.end.getHours() === 23 && rango.end.getMinutes() === 59 && rango.end.getMilliseconds() === 999);
check('empieza y termina el mismo día', rango.start.getDate() === rango.end.getDate());

console.log('\nNo se gastan consultas en años que no existieron');

// Pareja que empezó hace poco más de un año: no tiene sentido preguntar por
// hace tres, cuatro ni cinco años.
const desdeHaceUnAnio = memoryCandidates(HOY, d(2025, 6, 1));
check(
    'una pareja de un año solo mira 6 meses y un año atrás',
    desdeHaceUnAnio.length === 2,
    `devolvió ${desdeHaceUnAnio.length}`
);
check(
    'y esos dos son los correctos',
    desdeHaceUnAnio[0].label === 'Hace 6 meses' && desdeHaceUnAnio[1].label === 'Hace un año'
);

const reciente = memoryCandidates(HOY, d(2026, 8, 1));
check('una pareja de un mes no tiene ningún recuerdo que mirar', reciente.length === 0);

check(
    // El día en que empezaron es el recuerdo más valioso que puede existir:
    // si el filtro lo dejara fuera por un tema de horas, se perdería justo ese.
    'el propio día de inicio sí se mira',
    memoryCandidates(HOY, d(2025, 9, 15)).some(c => c.label === 'Hace un año')
);

console.log('\nFechas que se desbordan');

// 29 de febrero: el año anterior no lo tiene. addMonths recorta al último día
// del mes en vez de saltar a marzo, que sería el mes equivocado.
const bisiesto = memoryCandidates(d(2028, 2, 29), null);
check(
    'un 29 de febrero mira el 28 del año anterior, no el 1 de marzo',
    bisiesto[1].start.getMonth() === 1 && bisiesto[1].start.getDate() === 28,
    `devolvió ${bisiesto[1].start.toDateString()}`
);

// 31 de agosto menos 6 meses es el 28/29 de febrero, no el 3 de marzo.
const finDeMes = memoryCandidates(d(2026, 8, 31), null);
check(
    'el 31 de agosto mira el 28 de febrero, no el 3 de marzo',
    finDeMes[0].start.getMonth() === 1 && finDeMes[0].start.getDate() === 28,
    `devolvió ${finDeMes[0].start.toDateString()}`
);

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) console.log(`  Fallaron: ${failures.join(' | ')}`);
console.log('='.repeat(58));

process.exit(fail > 0 ? 1 : 0);
