// Pregunta del día — Sprint 9.21.
//
// Es el motor de retención de la app: una razón para abrirla todos los días
// aunque no haya pasado nada. Las dos personas ven la MISMA pregunta, y la
// respuesta de la otra aparece recién cuando uno responde la suya — si se
// viera antes, la mitad contestaría copiando y la pregunta dejaría de decir
// nada.
//
// No hay servidor eligiendo: la pregunta se deriva del día y del id de la
// relación, así que los dos teléfonos llegan a la misma sin coordinarse y sin
// una lectura extra. Que dependa también de la relación evita que todas las
// parejas del país lean lo mismo el mismo día.
//
// Archivo puro (sin Firebase ni React) para poder probarlo:
// tests/dailyQuestions.test.mjs.

export const DAILY_QUESTIONS: string[] = [
    '¿Qué fue lo mejor de tu día?',
    '¿Qué canción te recuerda a nosotros?',
    'Si tuvieras el día libre mañana, ¿qué harías conmigo?',
    '¿Qué es lo primero que pensaste de mí cuando nos conocimos?',
    '¿Qué comida te gustaría que cocináramos juntos?',
    '¿Qué lugar del mundo te gustaría ver conmigo?',
    '¿Qué es algo que hago y que te hace reír siempre?',
    '¿Cuál fue el último día que te sentiste realmente tranquilo?',
    '¿Qué te gustaría que hiciéramos más seguido?',
    '¿Qué es lo que más te cuesta decirme?',
    'Si pudieras revivir un día juntos, ¿cuál sería?',
    '¿Qué película volverías a ver conmigo?',
    '¿Qué es algo que aprendiste de mí?',
    '¿Cómo te diste cuenta de que esto iba en serio?',
    '¿Qué te da miedo del futuro?',
    '¿Qué te hace sentir querido sin que yo diga nada?',
    '¿Qué costumbre tuya crees que se me pegó?',
    '¿Qué es lo más raro que te gusta de mí?',
    'Si armáramos una casa mañana, ¿qué sería lo primero que compras?',
    '¿Qué te gustaría que recordáramos de este año?',
    '¿Qué es algo que nunca te he preguntado y te gustaría contarme?',
    '¿Cuál es tu recuerdo favorito de tu infancia?',
    '¿Qué te gustaría que yo dejara de preocuparme tanto?',
    '¿Qué olor te trae un buen recuerdo?',
    'Si nos ganáramos algo de plata mañana, ¿en qué la gastarías?',
    '¿Qué es lo que más agradeces de esta semana?',
    '¿Qué te gustaría hacer conmigo antes de fin de año?',
    '¿Qué parte del día es tu favorita?',
    '¿Qué crees que la gente no entiende de ti?',
    '¿Qué te hizo sentir orgulloso últimamente?',
    '¿Qué serie empezarías conmigo desde cero?',
    '¿Qué te gustaría que te dijera más seguido?',
    '¿Cuándo fue la última vez que lloraste de risa?',
    '¿Qué harías si supieras que no puedes fallar?',
    '¿Qué te calma cuando estás mal?',
    '¿Qué es algo que hago y que preferirías que no hiciera?',
    '¿Qué te gustaría que aprendiéramos juntos?',
    '¿Cuál ha sido el viaje que más te marcó?',
    '¿Qué se te viene a la cabeza cuando piensas en "hogar"?',
    '¿Qué te gustaría que cambiara de nuestra rutina?',
    '¿Qué es lo más valiente que has hecho?',
    'Si tuvieras que describirnos en tres palabras, ¿cuáles serían?',
    '¿Qué te gustaría celebrar y todavía no celebramos?',
    '¿Qué te hace sentir seguro conmigo?',
    '¿Qué es algo que te gustaría hacer solo, sin culpa?',
    '¿Cuál fue la mejor decisión que tomaste este año?',
    '¿Qué te gustaría que hiciéramos un domingo perfecto?',
    '¿Qué te sorprendió de mí hace poco?',
    '¿Qué le dirías a la persona que eras hace cinco años?',
    '¿Qué es algo que te gustaría perdonarte?',
    '¿Qué canción pondrías si tuviéramos que bailar ahora?',
    '¿Qué te gustaría que supiera de tu día de hoy?',
    '¿Qué es lo que más extrañas cuando no estamos juntos?',
    '¿Qué te daría vergüenza contarme y igual me contarías?',
    '¿Qué te gustaría tener en diez años?',
    '¿Qué pequeño detalle mío te gusta?',
    '¿Qué es algo que hiciste hoy de lo que nadie se enteró?',
    '¿Qué te gustaría que hiciéramos cuando estemos viejos?',
    '¿Qué te hace falta esta semana?',
    '¿Qué momento nuestro te gustaría tener en una foto?',
    '¿Qué costumbre te gustaría que empezáramos?',
    '¿Qué te gustaría que te regalaran, aunque no sea tu cumpleaños?',
    '¿Cuál es la conversación que más recuerdas de las nuestras?',
    '¿Qué te preocupa y no me has contado?',
    '¿Qué es lo que más te gusta de ti?',
];

// Suma simple de caracteres. No pretende ser criptográfica: solo separa las
// secuencias de una pareja y otra, para que no todas lean lo mismo el mismo
// día.
const hashString = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash * 31 + value.charCodeAt(i)) % 100000;
    }
    return hash;
};

// Días transcurridos desde el 1 de enero de 1970, leyendo la clave de fecha
// 'YYYY-MM-DD' como número y no como Date: así el resultado no depende de la
// zona horaria del teléfono ni del horario de verano. Dos teléfonos con la
// misma fecha en pantalla llegan siempre a la misma pregunta.
export const dayIndexFromKey = (dateKey: string): number => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
};

export const questionIndexFor = (dateKey: string, relationshipId: string): number => {
    const index = (dayIndexFromKey(dateKey) + hashString(relationshipId)) % DAILY_QUESTIONS.length;
    return ((index % DAILY_QUESTIONS.length) + DAILY_QUESTIONS.length) % DAILY_QUESTIONS.length;
};

export const questionFor = (dateKey: string, relationshipId: string): string =>
    DAILY_QUESTIONS[questionIndexFor(dateKey, relationshipId)];
