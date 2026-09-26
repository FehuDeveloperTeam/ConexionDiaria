// Aniversarios y mesversarios — Sprint 9.20.
//
// La app sabía contar aniversarios pero no meses cumplidos, que para una
// pareja joven son casi todo: el primer aniversario queda a un año de
// distancia y en el medio no pasaba nada. Los mesversarios no se guardan en
// Firestore ni se crean a mano — se calculan desde la fecha de inicio, así
// que aparecen solos y no ocupan cupo del plan gratuito.
//
// Igual que services/pricing.ts, este archivo es PURO: solo fechas, sin
// Firebase ni React, para poder probarlo (tests/milestones.test.mjs). La
// aritmética de meses tiene trampas —el 31 en meses de 30, febrero, el
// cambio de hora— y ninguna se nota mirando la pantalla el día que se
// escribe el código: se nota meses después, cuando la fecha llega.

export type MilestoneKind = 'anniversary' | 'monthiversary';

export interface Milestone {
    kind: MilestoneKind;
    date: Date;
    // Años cumplidos para un aniversario, meses para un mesversario.
    count: number;
    title: string;
}

const startOfDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

const daysInMonth = (year: number, monthIndex: number): number =>
    new Date(year, monthIndex + 1, 0).getDate();

// Suma meses conservando el día cuando existe. Quien empezó un 31 de enero
// cumple meses el 28 de febrero (o el 29), no el 3 de marzo: desbordar al mes
// siguiente movería el mesversario a un mes que no le corresponde.
export const addMonths = (source: Date, months: number): Date => {
    const targetMonth = source.getMonth() + months;
    const year = source.getFullYear() + Math.floor(targetMonth / 12);
    const monthIndex = ((targetMonth % 12) + 12) % 12;
    const day = Math.min(source.getDate(), daysInMonth(year, monthIndex));
    return new Date(year, monthIndex, day);
};

// Días entre dos fechas contando días de calendario, no de 24 horas. El día
// del cambio de hora dura 23, y truncando milisegundos una cuenta regresiva
// se adelanta un día justo en la fecha que más importa.
export const daysBetween = (from: Date, to: Date): number =>
    Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);

// Meses completos transcurridos entre las dos fechas.
export const monthsElapsed = (start: Date, today: Date): number => {
    const rough =
        (today.getFullYear() - start.getFullYear()) * 12 +
        (today.getMonth() - start.getMonth());
    // Si aún no llega el día del mes, ese mes no está cumplido.
    return addMonths(start, rough) > startOfDay(today) ? rough - 1 : rough;
};

export const isAnniversaryDay = (start: Date, date: Date): boolean =>
    date.getMonth() === start.getMonth() && date.getDate() === start.getDate();

// Un mesversario es cualquier mes cumplido que NO sea también aniversario:
// los 12, 24 y 36 meses ya se celebran como 1, 2 y 3 años, y anunciar las dos
// cosas el mismo día le quita peso a la que importa.
export const isMonthiversaryDay = (start: Date, date: Date): boolean => {
    if (date <= startOfDay(start)) return false;
    if (isAnniversaryDay(start, date)) return false;

    const months = monthsElapsed(start, date);
    if (months <= 0) return false;

    return addMonths(start, months).getTime() === startOfDay(date).getTime();
};

export const anniversaryTitle = (years: number): string =>
    `Aniversario · ${years} ${years === 1 ? 'año' : 'años'}`;

export const monthiversaryTitle = (months: number): string =>
    `${months} ${months === 1 ? 'mes' : 'meses'} juntos`;

export const nextAnniversary = (start: Date, today: Date): Milestone => {
    const from = startOfDay(today);
    let date = new Date(from.getFullYear(), start.getMonth(), start.getDate());
    if (date < from) date = new Date(from.getFullYear() + 1, start.getMonth(), start.getDate());

    const count = date.getFullYear() - start.getFullYear();
    return { kind: 'anniversary', date, count, title: anniversaryTitle(count) };
};

// El próximo mes cumplido que no coincida con el aniversario. Null solo si la
// fecha de inicio está en el futuro, que no debería pasar pero tampoco vale la
// pena que reviente si pasa.
export const nextMonthiversary = (start: Date, today: Date): Milestone | null => {
    const from = startOfDay(today);
    if (startOfDay(start) > from) return null;

    let months = Math.max(monthsElapsed(start, from), 0);
    // Como mucho da trece vueltas: doce para saltar un aniversario y una para
    // pasar del mes en curso si ya venció.
    for (let guard = 0; guard < 14; guard++) {
        const candidate = addMonths(start, months);
        if (candidate >= from && months > 0 && months % 12 !== 0) {
            return {
                kind: 'monthiversary',
                date: candidate,
                count: months,
                title: monthiversaryTitle(months),
            };
        }
        months++;
    }
    return null;
};
