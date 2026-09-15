// Pruebas de la pregunta del día — Sprint 9.21.
//
// Corre con:  npm run test:questions
//
// Lo que se comprueba no es el texto de las preguntas sino la propiedad de la
// que depende toda la función: que los DOS teléfonos de una pareja lleguen a
// la misma pregunta el mismo día, sin hablar entre ellos. Si eso falla, cada
// uno responde una pregunta distinta y la sección deja de tener sentido — y
// no se nota en pantalla, porque cada teléfono se ve perfectamente bien.

import {
    DAILY_QUESTIONS, dayIndexFromKey, questionFor, questionIndexFor,
} from './.tmp-questions/dailyQuestions.js';

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

const REL = 'aliceAAAAAAAAAAAAAAAAAAAAAA1_bobBBBBBBBBBBBBBBBBBBBBBBBB2';
const OTRA = 'carlosCCCCCCCCCCCCCCCCCCCCC5_danaDDDDDDDDDDDDDDDDDDDDDDD6';

console.log('\nCatálogo');

check('hay preguntas suficientes para no repetir en dos meses', DAILY_QUESTIONS.length >= 60);
check('ninguna viene vacía', DAILY_QUESTIONS.every(q => typeof q === 'string' && q.trim().length > 0));
check('no hay preguntas repetidas', new Set(DAILY_QUESTIONS).size === DAILY_QUESTIONS.length);

console.log('\nLa misma pregunta para los dos');

check(
    'el mismo día y la misma relación dan siempre la misma pregunta',
    questionFor('2026-09-15', REL) === questionFor('2026-09-15', REL)
);
check(
    // Si se calculara con new Date('2026-09-15'), esa fecha se lee como
    // medianoche UTC: en Chile sería el día anterior y los dos teléfonos
    // podrían caer en preguntas distintas cruzando la medianoche.
    'el índice del día no depende de la zona horaria',
    dayIndexFromKey('2026-09-15') === Math.floor(Date.UTC(2026, 8, 15) / 86400000)
);
check(
    'días distintos dan preguntas distintas',
    questionFor('2026-09-15', REL) !== questionFor('2026-09-16', REL)
);
check(
    'dos parejas distintas no leen lo mismo el mismo día',
    questionIndexFor('2026-09-15', REL) !== questionIndexFor('2026-09-15', OTRA)
);

console.log('\nRecorrido del catálogo');

const total = DAILY_QUESTIONS.length;
const vistas = new Set();
for (let i = 0; i < total; i++) {
    const day = new Date(Date.UTC(2026, 0, 1 + i));
    const key = `${day.getUTCFullYear()}-${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`;
    vistas.add(questionIndexFor(key, REL));
}
check(
    'en un ciclo completo se recorren todas sin repetir ninguna',
    vistas.size === total,
    `se vieron ${vistas.size} de ${total}`
);

check(
    'el índice siempre cae dentro del catálogo',
    ['1970-01-01', '2026-12-31', '2099-07-04'].every(key => {
        const i = questionIndexFor(key, REL);
        return Number.isInteger(i) && i >= 0 && i < total;
    })
);

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) console.log(`  Fallaron: ${failures.join(' | ')}`);
console.log('='.repeat(58));

process.exit(fail > 0 ? 1 : 0);
