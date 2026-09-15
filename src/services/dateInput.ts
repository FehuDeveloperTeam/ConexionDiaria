// Conversión entre Date y el formato que exigen los <input> del navegador.
//
// Vive aparte porque lo comparten los dos componentes de fecha que funcionan
// en web (DateField y DateTimeModal), y porque la trampa de abajo hay que
// explicarla una sola vez.

const pad2 = (n: number): string => String(n).padStart(2, '0');

// <input type="date"> exige 'aaaa-mm-dd', siempre, sin importar el idioma del
// equipo. Lo que ve la persona lo decide el navegador.
export const toDateInputValue = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const toTimeInputValue = (date: Date): string =>
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

// Se construye a mano y no con new Date('aaaa-mm-dd'): esa forma se interpreta
// como medianoche UTC y en Chile devuelve el día anterior.
export const fromDateInputValue = (value: string): Date | null => {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

// Devuelve una copia de 'base' con la hora reemplazada, para no perder el día
// que ya estaba elegido.
export const withTimeFromInput = (base: Date, value: string): Date | null => {
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    const result = new Date(base);
    result.setHours(hours, minutes, 0, 0);
    return result;
};
