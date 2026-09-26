// Serie diaria compacta del panel — Sprint 10.1.
//
// Una sola medida por gráfico, a propósito. Poner "mensajes" y "parejas
// activas" en el mismo dibujo obligaría a dos escalas verticales, y un
// gráfico de doble eje deja comparar visualmente dos cosas que no son
// comparables: la forma de las curvas la decide la escala que uno eligió, no
// los datos. Dos gráficos chicos uno debajo del otro dicen lo mismo sin
// mentir.
//
// Con una sola serie no hace falta leyenda —el título ya dice qué es— ni
// paleta categórica. Tampoco se etiqueta cada barra: se muestra el valor del
// día que se toca, y por defecto el del último día.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/themeContext';
import { spacing } from '../config/theme';

export interface DailyPoint {
    date: string;   // 'YYYY-MM-DD'
    // -1 significa "no se pudo contar". Se distingue de 0 a propósito: pintar
    // un cero cuando en realidad no se sabe es la peor de las dos mentiras.
    value: number;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const shortDate = (dateKey: string): string => {
    const [, month, day] = dateKey.split('-').map(Number);
    return `${day} ${MESES[(month || 1) - 1]}`;
};

const CHART_HEIGHT = 84;

export const MiniBarChart: React.FC<{
    title: string;
    points: DailyPoint[];
}> = ({ title, points }) => {
    const { theme, fontFamilies } = useTheme();
    const [selected, setSelected] = useState<number | null>(null);

    const known = points.filter(p => p.value >= 0);
    const max = known.reduce((acc, p) => Math.max(acc, p.value), 0);

    const focus = selected !== null ? points[selected] : points[points.length - 1];

    return (
        <View style={{ gap: spacing.s8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s8 }}>
                <Text style={{
                    fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9,
                    textTransform: 'uppercase', color: theme.textMuted, flex: 1,
                }}>
                    {title}
                </Text>
                {!!focus && (
                    <>
                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 17, color: theme.text }}>
                            {focus.value < 0 ? '—' : focus.value.toLocaleString('es-CL')}
                        </Text>
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 11.5, color: theme.textFaint }}>
                            {shortDate(focus.date)}
                        </Text>
                    </>
                )}
            </View>

            <View style={{
                flexDirection: 'row', alignItems: 'flex-end', gap: 2,
                height: CHART_HEIGHT,
                borderBottomWidth: 1, borderBottomColor: theme.divider,
            }}>
                {points.map((point, index) => {
                    const isFocus = (selected === null ? index === points.length - 1 : selected === index);
                    const missing = point.value < 0;
                    // Altura proporcional, con un mínimo visible para que un
                    // día con actividad baja no se confunda con uno sin datos.
                    const height = missing || max === 0
                        ? 3
                        : Math.max(3, Math.round((point.value / max) * CHART_HEIGHT));

                    return (
                        <TouchableOpacity
                            key={point.date}
                            onPress={() => setSelected(index === selected ? null : index)}
                            accessibilityRole="button"
                            accessibilityLabel={`${shortDate(point.date)}: ${missing ? 'sin datos' : point.value}`}
                            // El área que se toca ocupa todo el alto aunque la
                            // barra sea corta: apuntarle a 3 píxeles con el
                            // dedo no es razonable.
                            style={{ flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end' }}
                        >
                            <View style={{
                                height,
                                borderTopLeftRadius: 4, borderTopRightRadius: 4,
                                backgroundColor: missing
                                    ? theme.borderSoft
                                    : (isFocus ? theme.primary : theme.primarySoft),
                            }} />
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 10.5, color: theme.textFaint }}>
                    {points.length > 0 ? shortDate(points[0].date) : ''}
                </Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 10.5, color: theme.textFaint }}>
                    {points.length > 0 ? shortDate(points[points.length - 1].date) : ''}
                </Text>
            </View>
        </View>
    );
};
