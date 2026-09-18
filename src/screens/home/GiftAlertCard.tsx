// Aviso de regalo — Sprint 9.13, extraído en el 11.9.
//
// Es el encadenado que une Calendario, Deseos y la ficha de la pareja: la
// función que convierte tres secciones separadas en una sola cosa útil.
//
// En free se muestra igual la fecha: su cumpleaños no es un secreto que haya
// que cobrar. Lo que se reserva es la ayuda — qué pidió y qué tallas usa.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, themes, FontFamilies } from '../../config/theme';
import { useTheme } from '../../contexts/themeContext';

export interface GiftOccasion {
    label: string;
    date: Date;
    days: number;
}

export interface GiftIntel {
    wishes: string[];
    sizes: { label: string; value: string }[];
}

const getStyles = (theme: typeof themes.light, fontFamilies: FontFamilies) => StyleSheet.create({
    card: {
        width: '100%', backgroundColor: theme.surface, borderRadius: radii.card,
        borderWidth: 1.5, borderColor: theme.affection,
        padding: spacing.s16, marginTop: spacing.s12, gap: spacing.s10,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10 },
    title: { fontFamily: fontFamilies.bodyBold, fontSize: 14.5, color: theme.text, flex: 1 },
    when: { fontFamily: fontFamilies.bodyBold, fontSize: 12.5, color: theme.affectionInk },
    line: { fontFamily: fontFamilies.body, fontSize: 13.5, color: theme.textMuted, lineHeight: 20 },
    wishRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.s8 },
    wish: { fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.text, flex: 1 },
    sizes: {
        flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8,
        borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: spacing.s10,
    },
    sizeChip: { backgroundColor: theme.surfaceAlt, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
    sizeText: { fontFamily: fontFamilies.bodySemiBold, fontSize: 11.5, color: theme.textMuted },
    lockRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.s8,
        borderTopWidth: 1, borderTopColor: theme.divider, paddingTop: spacing.s10,
    },
    lockText: { fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint, flex: 1 },
    lockCta: { fontFamily: fontFamilies.bodyBold, fontSize: 12, color: theme.primary },
});

export const GiftAlertCard: React.FC<{
    occasion: GiftOccasion | null;
    intel: GiftIntel | null;
    plan: 'free' | 'premium';
    onOpenPartnerSheet: () => void;
    onNeedUpgrade: () => void;
}> = ({ occasion, intel, plan, onOpenPartnerSheet, onNeedUpgrade }) => {
    const { theme, fontFamilies } = useTheme();
    const styles = getStyles(theme, fontFamilies);

    if (!occasion) return null;

    const cuando = occasion.days <= 0
        ? 'Hoy'
        : occasion.days === 1 ? 'Mañana' : `En ${occasion.days} días`;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Ionicons name="gift" size={20} color={theme.affection} />
                <Text style={styles.title}>Se acerca {occasion.label}</Text>
                <Text style={styles.when}>{cuando}</Text>
            </View>

            {plan === 'premium' ? (
                <>
                    {intel && intel.wishes.length > 0 ? (
                        <View style={{ gap: spacing.s6 }}>
                            <Text style={styles.line}>Lo que pidió:</Text>
                            {intel.wishes.map((wish, i) => (
                                <View key={`${wish}-${i}`} style={styles.wishRow}>
                                    <Ionicons name="star" size={13} color={theme.premium} style={{ marginTop: 3 }} />
                                    <Text style={styles.wish}>{wish}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.line}>
                            No tiene deseos anotados. Puedes preguntarle sin que se note.
                        </Text>
                    )}

                    {intel && intel.sizes.length > 0 ? (
                        <View style={styles.sizes}>
                            {intel.sizes.map(size => (
                                <View key={size.label} style={styles.sizeChip}>
                                    <Text style={styles.sizeText}>{size.label} {size.value}</Text>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.lockRow} onPress={onOpenPartnerSheet}>
                            <Ionicons name="create-outline" size={15} color={theme.textFaint} />
                            <Text style={styles.lockText}>Anota sus tallas para tenerlas a mano</Text>
                            <Text style={styles.lockCta}>Abrir ficha</Text>
                        </TouchableOpacity>
                    )}
                </>
            ) : (
                <TouchableOpacity style={styles.lockRow} onPress={onNeedUpgrade}>
                    <Ionicons name="lock-closed" size={15} color={theme.premium} />
                    <Text style={styles.lockText}>
                        Conexión Total te muestra qué pidió y sus tallas
                    </Text>
                    <Text style={styles.lockCta}>Ver</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};
