// Feriados de Chile, calculados para cualquier año (Sprint 6, sesión 6.1).
//
// Antes había una tabla fija con los feriados de 2024 y 2025 escritos a
// mano en calendar.tsx — dejó de marcar nada apenas terminó 2025. Esta
// versión calcula los feriados NACIONALES de cualquier año sin red ni API
// externa: los de fecha fija, más Viernes y Sábado Santo vía el algoritmo
// de Pascua (Meeus/Jones/Butcher, el estándar para el calendario gregoriano).
//
// Alcance deliberado, a pedir de negocio: solo feriados nacionales fijos.
// Quedan fuera, para una sesión aparte con una API externa:
// - Feriados regionales (ej. el Natalicio de Bernardo O'Higgins, solo en Chillán).
// - Feriados "irrenunciables" que la ley traslada al lunes más cercano
//   cuando caen martes, miércoles o jueves (San Pedro y San Pablo, Encuentro
//   de Dos Mundos): acá quedan en su fecha calendario fija, igual que en la
//   tabla vieja.
// - Feriados adicionales de una sola vez que el Congreso agrega por ley
//   puntual (ej. el feriado extra del 20 de septiembre de 2024): no son una
//   regla, no hay forma de calcularlos.

const pad2 = (n: number): string => n.toString().padStart(2, '0');

const dateKey = (year: number, month: number, day: number): string =>
    `${year}-${pad2(month)}-${pad2(day)}`;

/**
 * Domingo de Pascua para un año dado, algoritmo de Meeus/Jones/Butcher
 * (calendario gregoriano). Devuelve { month, day } en ese año.
 */
const computeEasterSunday = (year: number): { month: number; day: number } => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month, day };
};

// Feriados nacionales de fecha fija. La ley del "feriado irrenunciable"
// mueve algunos de estos al lunes más cercano cuando caen martes/miércoles/
// jueves — no se aplica ese ajuste acá (ver alcance arriba).
const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
    { month: 1, day: 1, name: 'Año Nuevo' },
    { month: 5, day: 1, name: 'Día del Trabajo' },
    { month: 5, day: 21, name: 'Día de las Glorias Navales' },
    { month: 6, day: 20, name: 'Día de los Pueblos Indígenas' },
    { month: 6, day: 29, name: 'San Pedro y San Pablo' },
    { month: 7, day: 16, name: 'Día de la Virgen del Carmen' },
    { month: 8, day: 15, name: 'Asunción de la Virgen' },
    { month: 9, day: 18, name: 'Día de la Independencia' },
    { month: 9, day: 19, name: 'Día de las Glorias del Ejército' },
    { month: 10, day: 12, name: 'Encuentro de Dos Mundos' },
    { month: 10, day: 31, name: 'Día de las Iglesias Evangélicas' },
    { month: 11, day: 1, name: 'Día de Todos los Santos' },
    { month: 12, day: 8, name: 'Inmaculada Concepción' },
    { month: 12, day: 25, name: 'Navidad' },
];

/** Feriados nacionales de un año, como { 'YYYY-MM-DD': nombre }. */
export const getChileanHolidays = (year: number): Record<string, string> => {
    const holidays: Record<string, string> = {};

    for (const { month, day, name } of FIXED_HOLIDAYS) {
        holidays[dateKey(year, month, day)] = name;
    }

    const easter = computeEasterSunday(year);
    const easterDate = new Date(year, easter.month - 1, easter.day);

    const goodFriday = new Date(easterDate);
    goodFriday.setDate(easterDate.getDate() - 2);
    holidays[dateKey(goodFriday.getFullYear(), goodFriday.getMonth() + 1, goodFriday.getDate())] = 'Viernes Santo';

    const holySaturday = new Date(easterDate);
    holySaturday.setDate(easterDate.getDate() - 1);
    holidays[dateKey(holySaturday.getFullYear(), holySaturday.getMonth() + 1, holySaturday.getDate())] = 'Sábado Santo';

    return holidays;
};

/** Feriados nacionales combinados de varios años (calendario navegable). */
export const getChileanHolidaysForYears = (years: number[]): Record<string, string> => {
    return years.reduce<Record<string, string>>((acc, year) => {
        return { ...acc, ...getChileanHolidays(year) };
    }, {});
};
