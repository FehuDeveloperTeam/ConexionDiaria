// "Un día como hoy" — Sprint 9.26.
//
// El álbum tenía un problema que no era de estilo: con 150 fotos cargadas solo
// se veían las nueve más nuevas, y el resto era un archivo muerto que había
// que ir a buscar scrolleando. Era además la única sección que se veía
// idéntica entre una visita y otra.
//
// Esto no guarda nada nuevo: consulta distinto lo que ya está subido. La
// pregunta que responde es "¿qué estábamos haciendo un día como hoy?", y la
// respuesta cambia sola todos los días.
//
// Archivo puro (fechas y nada más) para poder probarlo:
// tests/memories.test.mjs. La consulta a Firestore la hace la pantalla.

import { addMonths } from './milestones';

export interface MemoryCandidate {
    key: string;
    // Cómo se nombra el recuerdo: "Hace un año", "Hace 6 meses".
    label: string;
    // Rango del día completo, que es lo que se le pide a Firestore.
    start: Date;
    end: Date;
}

// Hasta cinco años atrás. Más que eso no es que sobre: es que la app no
// existía, y cada candidato cuesta una consulta.
const YEARS_BACK = 5;

const dayRange = (date: Date): { start: Date; end: Date } => ({
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999),
});

const yearsLabel = (years: number): string =>
    years === 1 ? 'Hace un año' : `Hace ${years} años`;

// Los días que vale la pena mirar, del más cercano al más lejano.
//
// 'oldest' es desde cuándo puede haber algo: la fecha en que empezaron, o la
// primera foto. Sirve para no gastar consultas en años en los que esta pareja
// todavía no existía.
export const memoryCandidates = (today: Date, oldest: Date | null): MemoryCandidate[] => {
    const candidates: MemoryCandidate[] = [];

    // Medio año es el primer salto que se siente lejos sin serlo tanto: para
    // una pareja de un año, es el único recuerdo posible.
    const halfYear = addMonths(today, -6);
    candidates.push({ key: 'm6', label: 'Hace 6 meses', ...dayRange(halfYear) });

    for (let years = 1; years <= YEARS_BACK; years++) {
        const date = addMonths(today, -12 * years);
        candidates.push({ key: `y${years}`, label: yearsLabel(years), ...dayRange(date) });
    }

    if (!oldest) return candidates;

    // Se descarta el candidato que cae antes del comienzo. El propio día de
    // inicio sí cuenta: es el recuerdo más valioso que puede haber.
    const floor = new Date(oldest.getFullYear(), oldest.getMonth(), oldest.getDate()).getTime();
    return candidates.filter(candidate => candidate.end.getTime() >= floor);
};
