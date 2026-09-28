// Pruebas del recordatorio de eventos del lado de la app — Sprint 10.3c.
//
// Corre con:  npm run test:eventreminder
//
// Lo que importa acá es cuándo el aviso vuelve a quedar pendiente. Si se
// rearmara de más, editar el título de un evento ya avisado mandaría el aviso
// otra vez; si se rearmara de menos, mover la hora dejaría el aviso como
// "enviado" y no volvería a sonar. Las reglas exigen lo mismo, así que un
// error acá se notaría como un guardado que falla.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const {
    reminderFields, choiceFromEvent, isLeadAvailable, describeReminder, notifyLabel, DEFAULT_LEAD,
} = require('./.tmp-eventreminder/eventReminder.js');

let pass = 0, fail = 0;
const failures = [];
const check = (nombre, cond, detalle = '') => {
    if (cond) { console.log(`  ✓ ${nombre}`); pass++; }
    else { console.log(`  ✗ ${nombre}${detalle ? ` — ${detalle}` : ''}`); fail++; failures.push(nombre); }
};

const evento = new Date('2026-12-24T23:00:00Z');
const unaHoraAntes = new Date('2026-12-24T22:00:00Z');

console.log('\nQué se escribe en el evento');

const nuevo = reminderFields({ notify: 'both', lead: 60 }, evento);
check('un aviso nuevo queda pendiente', nuevo.reminderStatus === 'pending');
check('la hora del aviso es la del evento menos la anticipación', nuevo.remindAt.getTime() === unaHoraAntes.getTime());
check('guarda a quién y con cuánta anticipación', nuevo.notify === 'both' && nuevo.reminderLeadMinutes === 60);

const sinAviso = reminderFields({ notify: null, lead: 60 }, evento);
check(
    'sin aviso, todos los campos quedan en null (y no una hora de aviso colgando)',
    sinAviso.notify === null && sinAviso.remindAt === null && sinAviso.reminderStatus === null && sinAviso.reminderLeadMinutes === null
);

console.log('\nCuándo el aviso vuelve a quedar pendiente');

const enviado = { notify: 'both', reminderLeadMinutes: 60, remindAt: unaHoraAntes, reminderStatus: 'sent' };

check(
    'REGRESIÓN: editar solo el título de un evento ya avisado NO lo vuelve a mandar',
    reminderFields({ notify: 'both', lead: 60 }, evento, enviado).reminderStatus === 'sent'
);
check(
    'mover la hora del evento lo deja pendiente otra vez',
    reminderFields({ notify: 'both', lead: 60 }, new Date('2026-12-25T00:00:00Z'), enviado).reminderStatus === 'pending'
);
check(
    'cambiar la anticipación lo deja pendiente otra vez',
    reminderFields({ notify: 'both', lead: 15 }, evento, enviado).reminderStatus === 'pending'
);
check(
    'cambiar a quién avisa lo deja pendiente otra vez',
    reminderFields({ notify: 'me', lead: 60 }, evento, enviado).reminderStatus === 'pending'
);
check(
    // Un evento antiguo (sin estado) al que se le activa el aviso nuevo.
    'un evento que no tenía estado queda pendiente',
    reminderFields({ notify: 'both', lead: 60 }, evento, { notify: 'both', reminderLeadMinutes: 60, remindAt: unaHoraAntes, reminderStatus: null }).reminderStatus === 'pending'
);

console.log('\nQué anticipaciones se ofrecen');

const ahora = new Date('2026-12-24T12:00:00Z');
check('para un evento de hoy en la noche, "1 hora antes" se ofrece', isLeadAvailable(evento, 60, ahora));
check('"1 día antes" ya pasó y no se ofrece', !isLeadAvailable(evento, 1440, ahora));
check('"1 semana antes" tampoco', !isLeadAvailable(evento, 10080, ahora));
check('un evento que ya pasó no ofrece ni "a la hora"', !isLeadAvailable(new Date('2026-12-24T11:00:00Z'), 0, ahora));

console.log('\nAbrir un evento para editarlo');

check('un evento sin aviso abre sin aviso', choiceFromEvent({}).notify === null);
check('y con la anticipación por defecto lista', choiceFromEvent({}).lead === DEFAULT_LEAD);
check(
    'un evento nuevo abre con lo que tenía guardado',
    JSON.stringify(choiceFromEvent({ notify: 'partner', reminderLeadMinutes: 1440 })) === JSON.stringify({ notify: 'partner', lead: 1440 })
);
check(
    // Lo que era: una notificación en el teléfono del autor, a la hora.
    'un evento con el recordatorio de antes abre como "a mí, a la hora"',
    JSON.stringify(choiceFromEvent({ reminder: true })) === JSON.stringify({ notify: 'me', lead: 0 })
);

console.log('\nTextos');

check('las opciones nombran a la pareja', notifyLabel('partner', 'Carol') === 'A Carol');
check('sin nombre dice "tu pareja"', notifyLabel('partner', ' ') === 'A tu pareja');
check(
    'quien lo creó lee "a ti" en lo que se avisó a sí mismo',
    describeReminder('me', 60, true, 'Andrés', 'Carol') === 'Avisa a ti · 1 hora antes'
);
check(
    // Alice lo creó "para mí": Bob no debe leer "a mí" ni "a ti".
    'la pareja lee a quién le avisa, desde su lado',
    describeReminder('me', 60, false, 'Andrés', 'Carol') === 'Avisa a Andrés · 1 hora antes'
);
check(
    'lo que se creó para la pareja, ella lo lee como "a ti"',
    describeReminder('partner', 1440, false, 'Andrés', 'Carol') === 'Avisa a ti · 1 día antes'
);
check('a los dos', describeReminder('both', 0, true, 'Andrés', 'Carol') === 'Avisa a los dos · a la hora');

console.log(`\n${pass} pasaron · ${fail} fallaron`);
if (fail > 0) {
    console.log('Fallaron:\n' + failures.map(f => `  - ${f}`).join('\n'));
    process.exit(1);
}
