// Pruebas de la escalera de precios — Sprint 9.18.
//
// Corre con:  npm run test:pricing
// (compila src/services/pricing.ts a un directorio temporal y lo importa;
// por eso ese archivo no importa Firebase ni RevenueCat)
//
// Por qué existen: acá se decide cuánto se le cobra a alguien. Un error de un
// día en una ventana de descuento no rompe el build, no falla en TypeScript y
// no se nota mirando la pantalla — se nota en el cobro, cuando ya es tarde. Y
// las ventanas dependen de "hoy", así que son justo lo que nunca se prueba a
// mano: nadie va a esperar hasta el 14 de febrero para revisar si anda.

import { resolvePricingOffer, daysUntilNextYearly, TIER_OFFERING_IDS } from './.tmp-pricing/pricing.js';

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

// La suite corre con TZ=America/Santiago fijado en el script de npm, no con la
// zona de quien la ejecute: si no, el caso del cambio de hora pasa en un
// servidor UTC sin comprobar nada y el error aparece en el teléfono de un
// usuario en Chile.
//
// Fechas fijas, nunca new Date(): una prueba que depende del día en que se
// corre falla sola en algún momento y nadie sabe por qué.
const d = (y, m, day) => new Date(y, m - 1, day);

const base = {
    foundersLeft: 0,
    anniversary: null,
    myBirthday: null,
    partnerBirthday: null,
    partnerName: 'Mila',
};

console.log('\nCupos de fundador');

check(
    'con cupos disponibles manda fundador, por sobre cualquier otra ventana',
    resolvePricingOffer({ ...base, foundersLeft: 340, anniversary: d(2020, 6, 15), today: d(2026, 6, 14) }).tier === 'founder'
);
check(
    'el motivo dice cuántos cupos quedan',
    resolvePricingOffer({ ...base, foundersLeft: 340, today: d(2026, 6, 1) }).reason === 'Quedan 340 cupos de fundador'
);
check(
    'con un solo cupo, el motivo va en singular',
    resolvePricingOffer({ ...base, foundersLeft: 1, today: d(2026, 6, 1) }).reason === 'Queda 1 cupo de fundador'
);
check(
    'sin cupos se cae al precio de lista',
    resolvePricingOffer({ ...base, foundersLeft: 0, today: d(2026, 6, 1) }).tier === 'list'
);
check(
    // El caso que regalaría el precio de fundador a todo el mundo cada vez que
    // se cae la red: null es "no sé", no "quedan cupos".
    'contador ilegible (null) NO otorga precio de fundador',
    resolvePricingOffer({ ...base, foundersLeft: null, today: d(2026, 6, 1) }).tier === 'list'
);

console.log('\nVentana de aniversario (3 días antes y el día mismo)');

const conAniversario = (today) =>
    resolvePricingOffer({ ...base, anniversary: d(2020, 6, 15), today });

check('4 días antes todavía es precio de lista', conAniversario(d(2026, 6, 11)).tier === 'list');
check('3 días antes ya aplica', conAniversario(d(2026, 6, 12)).tier === 'anniversary');
check('el día mismo aplica', conAniversario(d(2026, 6, 15)).tier === 'anniversary');
check('el día siguiente ya no', conAniversario(d(2026, 6, 16)).tier === 'list');
check(
    'el motivo del día mismo dice "hoy"',
    conAniversario(d(2026, 6, 15)).reason === 'Su aniversario es hoy'
);
check(
    'el motivo de mañana dice "mañana"',
    conAniversario(d(2026, 6, 14)).reason === 'Su aniversario es mañana'
);

console.log('\nCumpleaños');

check(
    'el cumpleaños de la pareja abre la ventana',
    resolvePricingOffer({ ...base, partnerBirthday: d(1998, 12, 25), today: d(2026, 12, 24) }).tier === 'birthday'
);
check(
    'el motivo nombra a la pareja',
    resolvePricingOffer({ ...base, partnerBirthday: d(1998, 12, 25), today: d(2026, 12, 25) }).reason === 'El cumpleaños de Mila es hoy'
);
check(
    'el cumpleaños propio también abre la ventana',
    resolvePricingOffer({ ...base, myBirthday: d(1995, 3, 8), today: d(2026, 3, 8) }).tier === 'birthday'
);
check(
    'el aniversario (70 %) le gana al cumpleaños (50 %) si caen juntos',
    resolvePricingOffer({
        ...base, anniversary: d(2020, 3, 8), myBirthday: d(1995, 3, 8), today: d(2026, 3, 8),
    }).tier === 'anniversary'
);

console.log('\nFechas especiales');

check(
    'el 24 de diciembre es precio de Navidad',
    resolvePricingOffer({ ...base, today: d(2026, 12, 24) }).tier === 'seasonal'
);
check(
    'el 26 de diciembre ya no',
    resolvePricingOffer({ ...base, today: d(2026, 12, 26) }).tier === 'list'
);
check(
    'el 14 de febrero es San Valentín',
    resolvePricingOffer({ ...base, today: d(2026, 2, 14) }).reason === 'Precio de San Valentín'
);
check(
    'el 15 de febrero ya no',
    resolvePricingOffer({ ...base, today: d(2026, 2, 15) }).tier === 'list'
);
check(
    // Navidad (40 %) cae dentro de la ventana de un cumpleaños del 25 (50 %):
    // tiene que ganar el descuento mayor, no el que esté antes en el código.
    'el cumpleaños del 25 de diciembre le gana al precio de Navidad',
    resolvePricingOffer({ ...base, partnerBirthday: d(1998, 12, 25), today: d(2026, 12, 24) }).tier === 'birthday'
);

console.log('\nPrecio de lista y forma de la respuesta');

const lista = resolvePricingOffer({ ...base, today: d(2026, 7, 1) });
check('el precio de lista no lleva sello de descuento', lista.discountLabel === '');
check('el precio de lista no inventa un motivo', lista.reason === null);
check(
    'cada escalón apunta a su oferta de RevenueCat',
    resolvePricingOffer({ ...base, foundersLeft: 5, today: d(2026, 7, 1) }).offeringId === TIER_OFFERING_IDS.founder
);

console.log('\nCuenta de días');

check('hoy son 0 días', daysUntilNextYearly(d(2020, 7, 1), d(2026, 7, 1)) === 0);
check('mañana es 1 día', daysUntilNextYearly(d(2020, 7, 2), d(2026, 7, 1)) === 1);
check(
    'una fecha ya pasada este año cuenta hacia el año siguiente',
    daysUntilNextYearly(d(2020, 1, 1), d(2026, 12, 31)) === 1
);
check(
    // El 29 de febrero no existe en 2026: new Date(2026, 1, 29) se desborda al
    // 1 de marzo. Es el comportamiento que queremos (celebrarlo el 1 de marzo),
    // pero conviene dejarlo escrito para que nadie lo "arregle" sin querer.
    'un 29 de febrero cae al 1 de marzo en años no bisiestos',
    daysUntilNextYearly(d(2020, 2, 29), d(2026, 3, 1)) === 0
);
check(
    'el cambio de hora no corre las ventanas un día',
    // En Chile el horario de verano empieza el primer sábado de septiembre.
    // Restar milisegundos entre dos fechas con husos distintos da 0,96 días;
    // por eso la cuenta redondea en vez de truncar.
    daysUntilNextYearly(d(2020, 9, 8), d(2026, 9, 5)) === 3
);

console.log(`\n${'='.repeat(58)}`);
console.log(`  ${pass} pasaron · ${fail} fallaron`);
if (fail > 0) console.log(`  Fallaron: ${failures.join(' | ')}`);
console.log('='.repeat(58));

process.exit(fail > 0 ? 1 : 0);
