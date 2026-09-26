// Conversión de fechas para los <input> del navegador — Sprint 11.6.
//
// Corre con:  npm run test:dateinput
//
// Acá vivió un error que llegó a producción dos veces: new Date('aaaa-mm-dd')
// se interpreta como medianoche UTC, así que en Chile devuelve el DÍA
// ANTERIOR. Alguien elegía el 25 y se guardaba el 24. No falla, no avisa: solo
// está mal por un día, que es justo lo peor para una app cuyo negocio son las
// fechas importantes.
//
// La suite corre con TZ=America/Santiago fijada en el script de npm: en un
// servidor UTC este error no se reproduce y la prueba pasaría sin comprobar
// nada.

import { toDateInputValue, toTimeInputValue, fromDateInputValue, withTimeFromInput }
    from './.tmp-dateinput/dateInput.js';

let pass = 0, fail = 0;
const failures = [];
const check = (n, c, d = '') => {
    if (c) { console.log(`  ✓ ${n}`); pass++; }
    else { console.log(`  ✗ ${n}${d ? ` — ${d}` : ''}`); fail++; failures.push(n); }
};

console.log('\nDe Date al formato del input');

check('un día normal', toDateInputValue(new Date(2026, 8, 18)) === '2026-09-18');
check('rellena mes y día con cero', toDateInputValue(new Date(2026, 0, 5)) === '2026-01-05');
check('el 31 de diciembre', toDateInputValue(new Date(2026, 11, 31)) === '2026-12-31');
check('la hora en formato de 24', toTimeInputValue(new Date(2026, 8, 18, 21, 5)) === '21:05');
check('medianoche', toTimeInputValue(new Date(2026, 8, 18, 0, 0)) === '00:00');

console.log('\nDel input a Date — el error del día anterior');

const leida = fromDateInputValue('2026-09-18');
check(
    // Con new Date('2026-09-18') esto daría 17 en Chile.
    'el 18 se lee como 18, no como 17',
    leida.getDate() === 18 && leida.getMonth() === 8 && leida.getFullYear() === 2026,
    leida ? leida.toString() : 'null'
);
check(
    'un 1 de enero no retrocede al 31 de diciembre anterior',
    (() => { const d = fromDateInputValue('2026-01-01'); return d.getDate() === 1 && d.getMonth() === 0 && d.getFullYear() === 2026; })()
);
check('queda a medianoche local, no a las 21 del día anterior', leida.getHours() === 0);
check('un valor vacío devuelve null', fromDateInputValue('') === null);
check('un valor incompleto devuelve null', fromDateInputValue('2026-09') === null);
check('un valor con basura devuelve null', fromDateInputValue('no-es-fecha') === null);

console.log('\nCambiar la hora conservando el día');

const base = new Date(2026, 8, 18, 9, 30);
const conHora = withTimeFromInput(base, '21:45');
check(
    // En Calendario los dos pasos son dos aperturas del mismo modal: el
    // segundo no puede borrar lo que eligió el primero.
    'conserva el día elegido',
    conHora.getDate() === 18 && conHora.getMonth() === 8 && conHora.getFullYear() === 2026
);
check('reemplaza la hora', conHora.getHours() === 21 && conHora.getMinutes() === 45);
check('deja segundos y milisegundos en cero', conHora.getSeconds() === 0 && conHora.getMilliseconds() === 0);
check('no muta la fecha original', base.getHours() === 9 && base.getMinutes() === 30);
check('una hora inválida devuelve null', withTimeFromInput(base, 'x:y') === null);

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) console.log(`  Fallaron: ${failures.join(' | ')}`);
console.log('='.repeat(58));
process.exit(fail > 0 ? 1 : 0);
