// Catálogo de tallas — Sprint 9.24.
//
// Un único lugar donde se define qué se pregunta, cómo se agrupa y a quién
// aplica cada campo. Lo consumen tres pantallas: la ficha de la pareja (lo que
// yo anoto de ella), "Mis tallas" (lo que yo declaro de mí) y el aviso de
// regalo de Inicio. Tenerlo repetido en cada una era la vía rápida para que se
// desincronizaran.
//
// Hay DOS lugares de guardado, y la diferencia es deliberada:
//
//   users/{uid}.measurements          -> MIS tallas. Las declaro yo y las lee
//                                        mi pareja (la regla de 'users' ya deja
//                                        leer el perfil a la pareja). Es un
//                                        dato que quiero que sepa.
//   users/{uid}/private/partnerProfile -> lo que yo ANOTO de mi pareja. Solo lo
//                                        veo yo, ni ella puede abrirlo. Si se
//                                        pudiera, se acabó la sorpresa.
//
// Cuando mi pareja declaró una talla, su valor se muestra en la ficha y yo no
// tengo que averiguar nada; si además quiero anotar un matiz ("usa M pero le
// gusta holgada"), lo escribo encima y eso queda privado.

import { Ionicons } from '@expo/vector-icons';
import type { Gender } from '../types/models';

// A quién le sirve el campo. Con género sin declarar (todas las cuentas
// anteriores, y quien prefiera no decirlo) se muestran todos: es preferible
// preguntar de más que esconderle a alguien una talla que sí usa.
export type Audience = 'all' | 'notMale' | 'notFemale';

export interface MeasurementField {
    key: string;
    label: string;
    // Cómo se pregunta en primera persona, en el asistente de "Mis tallas".
    question: string;
    placeholder: string;
    audience: Audience;
    // Ayuda solo donde el formato no es obvio (nadie duda de "Polera: M").
    hint?: string;
}

export interface MeasurementGroup {
    key: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    fields: MeasurementField[];
}

export const MEASUREMENT_GROUPS: MeasurementGroup[] = [
    {
        key: 'clothing',
        title: 'Prendas',
        icon: 'shirt-outline',
        fields: [
            { key: 'topSize', label: 'Polera', question: '¿Qué talla de polera usas?', placeholder: 'M', audience: 'all' },
            { key: 'bottomSize', label: 'Pantalón', question: '¿Y de pantalón?', placeholder: '42', audience: 'all' },
            { key: 'dressSize', label: 'Vestido', question: '¿Qué talla de vestido usas?', placeholder: 'S', audience: 'notMale' },
            { key: 'outerwearSize', label: 'Abrigo o chaqueta', question: '¿Qué talla de abrigo o chaqueta usas?', placeholder: 'M', audience: 'all' },
            { key: 'swimwearSize', label: 'Traje de baño', question: '¿Qué talla de traje de baño usas?', placeholder: 'M', audience: 'all' },
        ],
    },
    {
        // Las tres que piden en una sastrería o al comprar una camisa formal.
        // Van aparte porque se miden en centímetros, no en tallas, y mezcladas
        // con las prendas confunden.
        key: 'tailoring',
        title: 'A la medida',
        icon: 'cut-outline',
        fields: [
            { key: 'neckSize', label: 'Contorno de cuello', question: '¿Cuánto mide tu contorno de cuello?', placeholder: '39', audience: 'all', hint: 'En centímetros' },
            { key: 'sleeveLength', label: 'Largo de manga', question: '¿Y el largo de manga?', placeholder: '62', audience: 'all', hint: 'Del hombro a la muñeca, en centímetros' },
            { key: 'suitSize', label: 'Traje o blazer', question: '¿Qué talla de traje o blazer usas?', placeholder: '48', audience: 'all' },
        ],
    },
    {
        key: 'underwear',
        title: 'Ropa interior',
        icon: 'body-outline',
        fields: [
            { key: 'braSize', label: 'Sostén', question: '¿Qué talla de sostén usas?', placeholder: '90B', audience: 'notMale' },
            { key: 'boxerSize', label: 'Bóxer', question: '¿Qué talla de bóxer usas?', placeholder: 'M', audience: 'notFemale' },
        ],
    },
    {
        key: 'accessories',
        title: 'Accesorios',
        icon: 'watch-outline',
        fields: [
            { key: 'shoeSize', label: 'Calzado', question: '¿Qué número calzas?', placeholder: '38', audience: 'all' },
            { key: 'ringSize', label: 'Anillo', question: '¿Qué talla de anillo usas?', placeholder: '14', audience: 'all' },
            { key: 'wristSize', label: 'Pulsera o reloj', question: '¿Cuánto mide tu muñeca?', placeholder: '17', audience: 'all', hint: 'En centímetros' },
        ],
    },
];

export const ALL_MEASUREMENT_FIELDS: MeasurementField[] =
    MEASUREMENT_GROUPS.flatMap(group => group.fields);

// Antes del 9.24 la ficha guardaba una sola talla de ropa, 'clothingSize'.
// Al abrirla ahora, ese valor aparece como la talla de polera — que es lo que
// la gente anotaba ahí — en vez de perderse. No se reescribe el documento: la
// traducción ocurre al leer, así que nada se corrompe si alguien abre la
// versión vieja de la app desde otro dispositivo.
const LEGACY_KEYS: Record<string, string> = { clothingSize: 'topSize' };

export type MeasurementValues = Record<string, string>;

export const normalizeMeasurements = (raw: unknown): MeasurementValues => {
    const source = (raw ?? {}) as Record<string, unknown>;
    const values: MeasurementValues = {};

    for (const field of ALL_MEASUREMENT_FIELDS) {
        const own = source[field.key];
        if (typeof own === 'string' && own.trim()) {
            values[field.key] = own;
        }
    }

    for (const [legacyKey, currentKey] of Object.entries(LEGACY_KEYS)) {
        const legacy = source[legacyKey];
        if (!values[currentKey] && typeof legacy === 'string' && legacy.trim()) {
            values[currentKey] = legacy;
        }
    }

    return values;
};

const appliesTo = (audience: Audience, gender: Gender | null | undefined): boolean => {
    if (audience === 'notMale') return gender !== 'male';
    if (audience === 'notFemale') return gender !== 'female';
    return true;
};

// Los grupos que le sirven a esta persona, ya sin los campos que no aplican y
// sin grupos vacíos (a un hombre, "Ropa interior" le queda con un solo campo;
// a quien no declaró género, con los dos).
export const groupsFor = (gender: Gender | null | undefined): MeasurementGroup[] =>
    MEASUREMENT_GROUPS
        .map(group => ({ ...group, fields: group.fields.filter(f => appliesTo(f.audience, gender)) }))
        .filter(group => group.fields.length > 0);

export const fieldsFor = (gender: Gender | null | undefined): MeasurementField[] =>
    ALL_MEASUREMENT_FIELDS.filter(f => appliesTo(f.audience, gender));

export const countFilled = (values: MeasurementValues, fields: MeasurementField[]): number =>
    fields.filter(field => !!values[field.key]?.trim()).length;
