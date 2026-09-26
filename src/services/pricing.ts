// Escalera de precios — Sprint 9.18.
//
// Conexión Total tiene cinco precios distintos, no uno: lista, fundador,
// aniversario, cumpleaños y fechas especiales. Hasta ahora la compra usaba
// 'availablePackages[0]' —el primer paquete que devolviera RevenueCat—, que
// con un solo precio funcionaba de casualidad y con cinco deja de funcionar.
//
// Acá se decide QUÉ escalón corresponde. Una oferta ("offering") de
// RevenueCat por escalón, cada una con su paquete mensual y su anual, y la
// app elige la oferta por identificador. Esa forma se eligió sobre las
// "ofertas introductorias" de las tiendas porque estas se limitan a una por
// persona: con cinco ventanas al año, alguien que compra en su cumpleaños ya
// no podría recibir la de aniversario. Cinco productos con su propio precio
// no tienen ese límite.
//
// Si un escalón todavía no está creado en el dashboard de RevenueCat, se cae
// a la oferta actual y se cobra el precio de lista: la app no se rompe por
// una configuración que falta, solo deja de descontar.
//
// Este archivo es deliberadamente PURO: no importa Firebase ni RevenueCat,
// solo fechas y números. Así se puede probar de verdad (tests/pricing.test.mjs,
// `npm run test:pricing`), que es lo mínimo para algo de lo que depende cuánto
// se le cobra a alguien. Leer el contador de cupos vive en services/founders.ts
// y consumir las dos cosas, en hooks/usePricing.ts.

export type PricingTier = 'founder' | 'anniversary' | 'birthday' | 'seasonal' | 'list';

// Identificadores que hay que crear en RevenueCat (Offerings). El de lista es
// el que quede marcado como 'current'.
export const TIER_OFFERING_IDS: Record<PricingTier, string> = {
    founder: 'founders',
    anniversary: 'anniversary',
    birthday: 'birthday',
    seasonal: 'seasonal',
    list: 'default',
};

export const TIER_DISCOUNT: Record<PricingTier, number> = {
    founder: 70,
    anniversary: 70,
    birthday: 50,
    seasonal: 40,
    list: 0,
};

export interface PricingOffer {
    tier: PricingTier;
    offeringId: string;
    // Cuánto descuenta, para el sello: '-70%'. Vacío en el precio de lista.
    discountLabel: string;
    // Por qué aparece este precio, en palabras. Es la mitad del trabajo del
    // cartel: un descuento sin motivo se lee como precio inflado el resto del
    // año. Null en el precio de lista, que no necesita excusa.
    reason: string | null;
    // Cuántos cupos de fundador quedan, cuando se pudo leer el contador.
    foundersLeft: number | null;
}

// --- Ventanas de descuento ---

// Los tres días previos y el día mismo. La ventana corta es deliberada: con
// cinco escalones al año, cualquiera queda a menos de tres meses del
// siguiente descuento, así que si además duran semanas el precio de lista
// deja de existir.
const WINDOW_DAYS = 3;

const startOfDay = (date: Date): Date =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Días que faltan para el próximo aniversario de esta fecha. Hoy devuelve 0.
export const daysUntilNextYearly = (source: Date, today: Date): number => {
    const from = startOfDay(today);
    let next = new Date(from.getFullYear(), source.getMonth(), source.getDate());
    if (next < from) next = new Date(from.getFullYear() + 1, source.getMonth(), source.getDate());
    return Math.round((next.getTime() - from.getTime()) / 86400000);
};

const isInWindow = (source: Date | null, today: Date): boolean =>
    !!source && daysUntilNextYearly(source, today) <= WINDOW_DAYS;

// Navidad y San Valentín. No salen de services/holidays.ts a propósito: ese
// archivo son los feriados legales de Chile y San Valentín no es uno.
const SEASONAL_WINDOWS: { name: string; month: number; from: number; to: number }[] = [
    { name: 'Navidad', month: 12, from: 18, to: 25 },
    { name: 'San Valentín', month: 2, from: 10, to: 14 },
];

const seasonalWindowFor = (today: Date): string | null => {
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const match = SEASONAL_WINDOWS.find(w => w.month === month && day >= w.from && day <= w.to);
    return match ? match.name : null;
};

// --- Decisión ---

export interface PricingContext {
    foundersLeft: number | null;
    anniversary: Date | null;
    myBirthday: Date | null;
    partnerBirthday: Date | null;
    partnerName?: string | null;
    today?: Date;
}

const daysLabel = (days: number): string =>
    days === 0 ? 'hoy' : days === 1 ? 'mañana' : `en ${days} días`;

// El orden es el de la escalera, de mayor descuento a menor, con una
// excepción: fundador gana los empates con aniversario (ambos 70 %) porque el
// precio de fundador se conserva de por vida y el de aniversario dura tres
// días.
export const resolvePricingOffer = (context: PricingContext): PricingOffer => {
    const today = context.today ?? new Date();
    const foundersLeft = context.foundersLeft;

    const build = (tier: PricingTier, reason: string | null): PricingOffer => ({
        tier,
        offeringId: TIER_OFFERING_IDS[tier],
        discountLabel: TIER_DISCOUNT[tier] > 0 ? `-${TIER_DISCOUNT[tier]}%` : '',
        reason,
        foundersLeft,
    });

    if (foundersLeft !== null && foundersLeft > 0) {
        return build('founder', foundersLeft === 1
            ? 'Queda 1 cupo de fundador'
            : `Quedan ${foundersLeft} cupos de fundador`);
    }

    if (isInWindow(context.anniversary, today)) {
        const days = daysUntilNextYearly(context.anniversary!, today);
        return build('anniversary', `Su aniversario es ${daysLabel(days)}`);
    }

    if (isInWindow(context.partnerBirthday, today)) {
        const days = daysUntilNextYearly(context.partnerBirthday!, today);
        const who = context.partnerName || 'tu pareja';
        return build('birthday', `El cumpleaños de ${who} es ${daysLabel(days)}`);
    }

    if (isInWindow(context.myBirthday, today)) {
        const days = daysUntilNextYearly(context.myBirthday!, today);
        return build('birthday', `Tu cumpleaños es ${daysLabel(days)}`);
    }

    const seasonal = seasonalWindowFor(today);
    if (seasonal) return build('seasonal', `Precio de ${seasonal}`);

    return build('list', null);
};
