// Pruebas de aniversarios y mesversarios — Sprint 9.20.
//
// Corre con:  npm run test:milestones
//
// La suite corre con TZ=America/Santiago fijada en el script de npm: el día en
// que empieza el horario de verano dura 23 horas, y esa hora perdida es justo
// lo que corre una cuenta regresiva un día si se trunca en vez de redondear.
// En un servidor UTC ese caso no se comprueba nunca.

import {
    addMonths, daysBetween, monthsElapsed, isAnniversaryDay, isMonthiversaryDay,
    nextAnniversary, nextMonthiversary,
} from './.tmp-milestones/milestones.js';

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
const same = (a, b) => a.getTime() === b.getTime();

console.log('\nSuma de meses');

check('un mes normal', same(addMonths(d(2024, 1, 15), 1), d(2024, 2, 15)));
check('cruza el año', same(addMonths(d(2024, 11, 5), 3), d(2025, 2, 5)));
check(
    // Sin el recorte, new Date(2024, 1, 31) se desborda al 2 de marzo y el
    // mesversario se celebra en el mes equivocado.
    'del 31 de enero al 29 de febrero, no al 2 de marzo',
    same(addMonths(d(2024, 1, 31), 1), d(2024, 2, 29))
);
check('del 31 de enero al 28 de febrero en año no bisiesto', same(addMonths(d(2025, 1, 31), 1), d(2025, 2, 28)));
check('del 31 de marzo al 30 de abril', same(addMonths(d(2024, 3, 31), 1), d(2024, 4, 30)));
check(
    // Recortar no puede ser permanente: quien empezó un 31 sigue cumpliendo
    // los 31 en los meses que los tienen.
    'el día original se recupera en el mes siguiente que sí lo tiene',
    same(addMonths(d(2024, 1, 31), 2), d(2024, 3, 31))
);

console.log('\nMeses cumplidos');

check('el mismo día son 0 meses', monthsElapsed(d(2024, 5, 10), d(2024, 5, 10)) === 0);
check('un día antes del mes aún son 0', monthsElapsed(d(2024, 5, 10), d(2024, 6, 9)) === 0);
check('el día del mes ya es 1', monthsElapsed(d(2024, 5, 10), d(2024, 6, 10)) === 1);
check('un año son 12', monthsElapsed(d(2024, 5, 10), d(2025, 5, 10)) === 12);
check('dos años y medio son 30', monthsElapsed(d(2022, 1, 10), d(2024, 7, 10)) === 30);

console.log('\nQué día es un mesversario');

const inicio = d(2024, 3, 20);

check('el día 20 del mes siguiente sí', isMonthiversaryDay(inicio, d(2024, 4, 20)));
check('el 19 no', !isMonthiversaryDay(inicio, d(2024, 4, 19)));
check('el 21 no', !isMonthiversaryDay(inicio, d(2024, 4, 21)));
check('la propia fecha de inicio no es mesversario', !isMonthiversaryDay(inicio, d(2024, 3, 20)));
check(
    // 12 meses son un año: anunciar las dos cosas el mismo día le quita peso
    // a la que importa.
    'a los 12 meses manda el aniversario, no el mesversario',
    !isMonthiversaryDay(inicio, d(2025, 3, 20)) && isAnniversaryDay(inicio, d(2025, 3, 20))
);
check('a los 24 meses tampoco', !isMonthiversaryDay(inicio, d(2026, 3, 20)));
check('a los 13 meses vuelve a haber mesversario', isMonthiversaryDay(inicio, d(2025, 4, 20)));
check(
    'quien empezó un 31 cumple meses el último día de los meses cortos',
    isMonthiversaryDay(d(2024, 1, 31), d(2024, 4, 30))
);

console.log('\nPróximo aniversario');

check(
    'el del año en curso si todavía no pasa',
    same(nextAnniversary(d(2020, 8, 14), d(2026, 3, 1)).date, d(2026, 8, 14))
);
check(
    'el del año siguiente si ya pasó',
    same(nextAnniversary(d(2020, 8, 14), d(2026, 9, 1)).date, d(2027, 8, 14))
);
check(
    'el día mismo cuenta como próximo, no como pasado',
    same(nextAnniversary(d(2020, 8, 14), d(2026, 8, 14)).date, d(2026, 8, 14))
);
check('cuenta los años cumplidos', nextAnniversary(d(2020, 8, 14), d(2026, 3, 1)).count === 6);
check('un año va en singular', nextAnniversary(d(2025, 8, 14), d(2026, 3, 1)).title === 'Aniversario · 1 año');

console.log('\nPróximo mesversario');

check(
    'el del mes en curso si todavía no llega',
    same(nextMonthiversary(d(2024, 3, 20), d(2026, 5, 4)).date, d(2026, 5, 20))
);
check(
    'el del mes siguiente si el de este mes ya pasó',
    same(nextMonthiversary(d(2024, 3, 20), d(2026, 5, 21)).date, d(2026, 6, 20))
);
check(
    'el día mismo cuenta como próximo',
    same(nextMonthiversary(d(2024, 3, 20), d(2026, 5, 20)).date, d(2026, 5, 20))
);
check(
    // Si no saltara el aniversario, el mes 12 aparecería como "12 meses
    // juntos" compitiendo con "Aniversario · 1 año" el mismo día.
    'salta el mes que cae en el aniversario',
    same(nextMonthiversary(d(2024, 3, 20), d(2025, 3, 5)).date, d(2025, 4, 20))
);
check(
    'cuenta bien los meses',
    nextMonthiversary(d(2024, 3, 20), d(2026, 5, 4)).count === 26
);
check('un mes va en singular', nextMonthiversary(d(2026, 4, 10), d(2026, 5, 1)).title === '1 mes juntos');
check(
    'con la fecha de inicio en el futuro no inventa nada',
    nextMonthiversary(d(2027, 1, 1), d(2026, 5, 1)) === null
);

console.log('\nCuenta de días');

check('el cambio de hora no corre la cuenta regresiva', daysBetween(d(2026, 9, 5), d(2026, 9, 8)) === 3);
check('hoy son 0 días', daysBetween(d(2026, 9, 5), d(2026, 9, 5)) === 0);

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) console.log(`  Fallaron: ${failures.join(' | ')}`);
console.log('='.repeat(58));

process.exit(fail > 0 ? 1 : 0);
