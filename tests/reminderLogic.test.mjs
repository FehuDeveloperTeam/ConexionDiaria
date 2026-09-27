// Pruebas de la lógica de los avisos — Sprint 10.3a.
//
// Corre con:  npm run test:reminders
//
// Corre con TZ=UTC a propósito. Cloud Functions vive en UTC, y los errores
// que importan acá son justo los que no se ven desde un computador en Chile:
// un cumpleaños guardado como medianoche chilena es otro día en UTC, y un
// evento a las 23:30 de hoy ya es "mañana" para el servidor. Si esta suite
// corriera en hora chilena, pasaría aunque la lógica estuviera mal.

// Se fija acá y no con 'TZ=UTC node ...' en el script de npm: esa forma no
// existe en el cmd de Windows, y el proyecto también se trabaja desde ahí.
// Node aplica el cambio de TZ en caliente.
process.env.TZ = 'UTC';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
    isNotifyTarget, isReminderLead, recipientsFor, remindAtFor, isReminderStale,
    calendarDayInTz, addDays, annualDateFallsOn, dueDateAlertDays, isCouplePremium,
    anniversaryYearsAt, birthdayText, anniversaryText, whenText, decideReminder, planDateAlerts,
} = require('./.tmp-reminders/reminderLogic.js');

let pass = 0, fail = 0;
const failures = [];
const check = (nombre, cond, detalle = '') => {
    if (cond) { console.log(`  ✓ ${nombre}`); pass++; }
    else { console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fail++; failures.push(nombre); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const day = (year, month, d) => ({ year, month, day: d });


const ALICE = 'aliceAAA';
const BOB = 'bobBBB';

console.log('\nA quién le llega un recordatorio');

check('"solo a mí" le llega solo al autor', eq(recipientsFor('me', ALICE, BOB), [ALICE]));
check('"solo a mi pareja" le llega solo a la pareja', eq(recipientsFor('partner', ALICE, BOB), [BOB]));
check('"a los dos" le llega a ambos', eq(recipientsFor('both', ALICE, BOB), [ALICE, BOB]));
check(
    // Se desvincularon después de crear el evento: lo que era para ella ya
    // no tiene a quién llegar, pero lo que era para mí sí.
    'sin pareja, "a los dos" le llega solo al autor',
    eq(recipientsFor('both', ALICE, null), [ALICE])
);
check('sin pareja, "solo a mi pareja" no le llega a nadie', eq(recipientsFor('partner', ALICE, null), []));
check(
    'un dato corrupto con pareja = autor no duplica el aviso',
    eq(recipientsFor('both', ALICE, ALICE), [ALICE])
);

console.log('\nQué valores acepta el servidor');

check('"me", "partner" y "both" son válidos', ['me', 'partner', 'both'].every(isNotifyTarget));
check('"everyone" no es válido', !isNotifyTarget('everyone'));
check('null no es válido', !isNotifyTarget(null));
check('las cinco anticipaciones son válidas', [0, 15, 60, 1440, 10080].every(isReminderLead));
check('37 minutos no es válido', !isReminderLead(37));
check('"15" como texto no es válido', !isReminderLead('15'));

console.log('\nCuándo sale un recordatorio');

const evento = new Date('2026-10-10T21:30:00Z');
check('a la hora: sale a la hora del evento', remindAtFor(evento, 0).getTime() === evento.getTime());
check('1 hora antes', remindAtFor(evento, 60).toISOString() === '2026-10-10T20:30:00.000Z');
check('1 semana antes', remindAtFor(evento, 10080).toISOString() === '2026-10-03T21:30:00.000Z');

const hora = new Date('2026-10-10T20:00:00Z');
check('29 minutos tarde todavía se manda', !isReminderStale(hora, new Date(hora.getTime() + 29 * 60000)));
check(
    // Si la función estuvo caída, avisar "empieza ahora" de algo que ya
    // terminó es peor que no avisar.
    '31 minutos tarde ya no se manda',
    isReminderStale(hora, new Date(hora.getTime() + 31 * 60000))
);

console.log('\nQué hace el servidor con un recordatorio vencido');

const base = {
    notify: 'both', authorUid: ALICE, relationshipPartnerUid: BOB, authorCurrentPartnerId: BOB,
    authorPlan: 'free', partnerPlan: 'premium',
    remindAt: new Date('2026-10-10T20:00:00Z'), now: new Date('2026-10-10T20:00:30Z'),
};
const decide = (cambios) => decideReminder({ ...base, ...cambios });

check('pareja premium, a los dos: se manda a ambos', eq(decide({}), { action: 'send', recipients: [ALICE, BOB] }));
check(
    // "Uno paga, ambos disfrutan": acá paga Bob y el evento es de Alice.
    'basta con que pague la pareja del autor',
    decide({}).action === 'send'
);
check(
    // El plan se mira al enviar: si dejaron de pagar entremedio, no se regala.
    'si ninguno paga al momento de enviar, no se manda',
    eq(decide({ partnerPlan: 'free' }), { action: 'skip', reason: 'not-premium' })
);
check(
    'desvinculados: a la ex pareja no le llega nada',
    eq(decide({ authorCurrentPartnerId: null, authorPlan: 'premium' }), { action: 'send', recipients: [ALICE] })
);
check(
    // Si ya no son pareja, el plan de quien era su pareja no le sirve.
    'desvinculados: el plan de la ex pareja ya no cuenta',
    eq(decide({ authorCurrentPartnerId: 'otraPersona' }), { action: 'skip', reason: 'not-premium' })
);
check(
    'desvinculados y "solo a mi pareja": no hay a quién mandar',
    eq(decide({ notify: 'partner', authorCurrentPartnerId: null, authorPlan: 'premium' }), { action: 'skip', reason: 'no-recipients' })
);
check('un destinatario inválido no se manda', eq(decide({ notify: 'todos' }), { action: 'skip', reason: 'invalid' }));
check(
    'más de 30 minutos tarde se descarta',
    eq(decide({ now: new Date('2026-10-10T20:31:00Z') }), { action: 'expire' })
);

console.log('\nPlan del día: cumpleaños y aniversarios');

// Hoy es 1 de octubre de 2026, 09:00 en Chile. Así se guardan las fechas desde
// la app: medianoche chilena, que en UTC es de madrugada — a las 03:00 con
// horario de verano (UTC-3) y a las 04:00 con el de invierno (UTC-4).
//
// Ojo con el segundo argumento: la primera versión de esta prueba suponía
// siempre UTC-3, y el 1 de octubre de 1995 Chile todavía estaba en invierno.
// Esa "medianoche" caía el 30 de septiembre, y la lógica —con razón— decía
// que no era el cumpleaños. Es justo el error que esta suite existe para ver.
// Los desfases de abajo están comprobados contra la base de husos de Node, no
// supuestos: en 1995 el horario de verano chileno empezaba recién a mediados
// de octubre.
const HOY = new Date('2026-10-01T12:00:00Z');
const medianocheChile = (iso, horasUtc = 3) => new Date(`${iso}T0${horasUtc}:00:00Z`);
const persona = (uid, partnerId, extra = {}) => ({
    uid, partnerId, displayName: uid === ALICE ? 'Alice' : 'Bob', plan: 'free',
    birthDate: null, relationshipStartDate: null, ...extra,
});
const resumen = (alerts) => alerts.map(a => `${a.to}:${a.kind}:${a.daysLeft}`).sort();

check(
    'cumpleaños hoy: le llega a la pareja, no a quien cumple',
    eq(resumen(planDateAlerts([
        persona(ALICE, BOB, { birthDate: medianocheChile('1995-10-01', 4) }),
        persona(BOB, ALICE),
    ], HOY)), [`${BOB}:birthday:0`])
);
check(
    'free: el cumpleaños en 14 días no avisa',
    planDateAlerts([
        persona(ALICE, BOB, { birthDate: medianocheChile('1995-10-15', 4) }),
        persona(BOB, ALICE),
    ], HOY).length === 0
);
check(
    // "Uno paga, ambos disfrutan": paga Bob y el cumpleaños es de Alice.
    'premium de la pareja: el cumpleaños en 14 días sí avisa',
    eq(resumen(planDateAlerts([
        persona(ALICE, BOB, { birthDate: medianocheChile('1995-10-15', 4) }),
        persona(BOB, ALICE, { plan: 'premium' }),
    ], HOY)), [`${BOB}:birthday:14`])
);
check(
    'aniversario hoy: le llega a los dos, una sola vez a cada uno',
    eq(resumen(planDateAlerts([
        persona(ALICE, BOB, { relationshipStartDate: medianocheChile('2020-10-01') }),
        persona(BOB, ALICE, { relationshipStartDate: medianocheChile('2020-10-01') }),
    ], HOY)), [`${ALICE}:anniversary:0`, `${BOB}:anniversary:0`])
);
check(
    'el aniversario dice los años que se cumplen',
    planDateAlerts([
        persona(ALICE, BOB, { relationshipStartDate: medianocheChile('2020-10-01') }),
        persona(BOB, ALICE, { relationshipStartDate: medianocheChile('2020-10-01') }),
    ], HOY)[0].text.title === '💞 Hoy cumplen 6 años juntos'
);
check(
    'el día en que empezaron no es aniversario',
    planDateAlerts([
        persona(ALICE, BOB, { relationshipStartDate: medianocheChile('2026-10-01') }),
        persona(BOB, ALICE, { relationshipStartDate: medianocheChile('2026-10-01') }),
    ], HOY).length === 0
);
check(
    // El peor error posible: avisarle a alguien el cumpleaños de su ex.
    'REGRESIÓN: si la pareja ya no es mutua, no se avisa nada',
    planDateAlerts([
        persona(ALICE, BOB, { birthDate: medianocheChile('1995-10-01', 4), relationshipStartDate: medianocheChile('2020-10-01') }),
        persona(BOB, 'otraPersona', { relationshipStartDate: medianocheChile('2020-10-01') }),
    ], HOY).length === 0
);
check(
    'si la pareja no está en la lista, no se avisa nada',
    planDateAlerts([persona(ALICE, BOB, { birthDate: medianocheChile('1995-10-01', 4) })], HOY).length === 0
);
check(
    'sin fecha de nacimiento no hay aviso de cumpleaños',
    planDateAlerts([persona(ALICE, BOB), persona(BOB, ALICE)], HOY).length === 0
);

console.log('\nFechas de calendario en hora de Chile (con el proceso en UTC)');

check(
    // Así se guarda un cumpleaños desde el registro: medianoche chilena. En
    // marzo de 1990 Chile estaba en UTC-3.
    'un cumpleaños guardado como medianoche chilena se lee en su día',
    eq(calendarDayInTz(new Date('1990-03-05T03:00:00Z')), day(1990, 3, 5))
);
check(
    'las 23:30 del 9 de enero en Chile siguen siendo 9, aunque en UTC ya sea 10',
    eq(calendarDayInTz(new Date('2026-01-10T02:30:00Z')), day(2026, 1, 9))
);
check('sumar un día cruza el cambio de hora sin saltarse nada', eq(addDays(day(2026, 9, 5), 1), day(2026, 9, 6)));
check('sumar 14 días cruza el fin de año', eq(addDays(day(2026, 12, 25), 14), day(2027, 1, 8)));
check('sumar días cruza un fin de mes corto', eq(addDays(day(2027, 2, 20), 14), day(2027, 3, 6)));

console.log('\nFechas que se repiten cada año');

check('un cumpleaños cae en su día', annualDateFallsOn(day(1990, 3, 5), day(2026, 3, 5)));
check('y no el día siguiente', !annualDateFallsOn(day(1990, 3, 5), day(2026, 3, 6)));
check('el 29 de febrero cae el 29 en un año bisiesto', annualDateFallsOn(day(1996, 2, 29), day(2028, 2, 29)));
check('y ese año no cae el 28', !annualDateFallsOn(day(1996, 2, 29), day(2028, 2, 28)));
check(
    // Tres años de cada cuatro no hay 29: correrlo al 1 de marzo lo cambiaría
    // de mes, y saltarlo dejaría a alguien sin aviso.
    'el 29 de febrero cae el 28 en un año no bisiesto',
    annualDateFallsOn(day(1996, 2, 29), day(2027, 2, 28))
);
check('y ese año no cae el 1 de marzo', !annualDateFallsOn(day(1996, 2, 29), day(2027, 3, 1)));

console.log('\nQué avisos tocan hoy, según el plan');

const cumple = day(1990, 10, 15);
check('premium: 14 días antes toca', dueDateAlertDays(cumple, day(2026, 10, 1), true) === 14);
check('premium: 7 días antes toca', dueDateAlertDays(cumple, day(2026, 10, 8), true) === 7);
check('premium: el mismo día toca', dueDateAlertDays(cumple, day(2026, 10, 15), true) === 0);
check('premium: 10 días antes no toca', dueDateAlertDays(cumple, day(2026, 10, 5), true) === null);
check('free: el mismo día toca', dueDateAlertDays(cumple, day(2026, 10, 15), false) === 0);
check('free: 14 días antes NO toca', dueDateAlertDays(cumple, day(2026, 10, 1), false) === null);
check('free: 7 días antes NO toca', dueDateAlertDays(cumple, day(2026, 10, 8), false) === null);
check(
    'el aviso de 14 días cruza el fin de año',
    dueDateAlertDays(day(1990, 1, 3), day(2026, 12, 20), true) === 14
);
check(
    'un 29 de febrero avisa 14 días antes del 28 en un año no bisiesto',
    dueDateAlertDays(day(1996, 2, 29), day(2027, 2, 14), true) === 14
);

console.log('\nPlan de la pareja');

check('basta con que uno pague', isCouplePremium('free', 'premium') && isCouplePremium('premium', 'free'));
check('los dos free es free', !isCouplePremium('free', 'free'));
check('un plan que falta no cuenta como premium', !isCouplePremium(undefined, null));

console.log('\nAños de aniversario');

check('se cuentan en la fecha anunciada, no hoy', anniversaryYearsAt(day(2020, 10, 1), day(2026, 9, 17), 14) === 6);
check(
    'el anuncio de 14 días que cruza el año cuenta el año nuevo',
    anniversaryYearsAt(day(2020, 1, 3), day(2026, 12, 20), 14) === 7
);
check('el mismo día que empezaron da cero', anniversaryYearsAt(day(2026, 9, 17), day(2026, 9, 17), 0) === 0);

console.log('\nTextos');

check('cumpleaños hoy nombra a la pareja', birthdayText('Carol', 0).title === '🎂 Hoy es el cumpleaños de Carol');
check('cumpleaños en 7 días dice "una semana"', birthdayText('Carol', 7).title.startsWith('🎁 En una semana'));
check('cumpleaños en 14 días dice "dos semanas"', birthdayText('Carol', 14).title.startsWith('🎁 En dos semanas'));
check('sin nombre dice "tu pareja"', birthdayText('  ', 0).title.endsWith('de tu pareja'));
check('1 año va en singular', anniversaryText(1, 0).title === '💞 Hoy cumplen 1 año juntos');
check('3 años va en plural', anniversaryText(3, 7).title === '💞 En una semana cumplen 3 años juntos');

console.log('\nCuándo es el evento, dicho desde el aviso');

// 27 de septiembre de 2026: Chile ya está en horario de verano, UTC-3.
const ahora = new Date('2026-09-27T15:00:00Z'); // 12:00 en Chile
const en = (min) => new Date(ahora.getTime() + min * 60000);

check('a la hora dice "Empieza ahora"', whenText(ahora, ahora) === 'Empieza ahora');
check('en 15 minutos', whenText(en(15), ahora) === 'Empieza en 15 minutos');
check('más tarde hoy dice la hora chilena', whenText(new Date('2026-09-27T21:30:00Z'), ahora) === 'Hoy a las 18:30');
check(
    // En UTC esto ya es el 28. Leído con la zona del servidor diría "Mañana".
    'las 23:30 de hoy en Chile son "hoy", aunque en UTC sean mañana',
    whenText(new Date('2026-09-28T02:30:00Z'), ahora) === 'Hoy a las 23:30'
);
check('mañana', whenText(new Date('2026-09-28T12:00:00Z'), ahora) === 'Mañana a las 09:00');
check('medianoche se escribe 00:00, no 24:00', whenText(new Date('2026-09-28T03:00:00Z'), ahora) === 'Mañana a las 00:00');
const semana = whenText(new Date('2026-10-04T21:30:00Z'), ahora);
check('en una semana dice el día y la hora', semana.startsWith('El ') && semana.endsWith('a las 18:30'), semana);

console.log(`\n${pass} pasaron · ${fail} fallaron`);
if (fail > 0) {
    console.log('Fallaron:\n' + failures.map(f => `  - ${f}`).join('\n'));
    process.exit(1);
}
