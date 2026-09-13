// Sprint 7.8b — Probador de tema premium: preview en vivo del estilo de
// borde, fondo y texto de la pareja, más la tipografía de cuerpo. El tema
// es de la relación, no individual — "Aplicar a los dos" escribe una sola
// vez en 'relationships/{id}.settings'.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../src/config/firebaseConfig';
import { fontFamilies, radii, spacing } from '../src/config/theme';
import { PREMIUM_BORDER_OPTIONS, useTheme } from '../src/contexts/themeContext';
import { usePlan } from '../src/contexts/planContext';
import { Button } from '../src/components/Button';
import { FullScreenLoader } from '../src/components/FullScreenLoader';
import Toast from 'react-native-toast-message';

const BG_SWATCHES = ['#F7F7FF', '#FBF4FF', '#FFF4F7', '#EAF7F0'];
const TEXT_SWATCHES = ['#1E1E1E', '#3B2247', '#7A2E48', '#1E5138'];
const FONT_CHIPS: { key: 'Newsreader_400Regular' | 'Manrope_500Medium' | 'monospace'; label: string }[] = [
    { key: 'Newsreader_400Regular', label: 'Newsreader' },
    { key: 'Manrope_500Medium', label: 'Manrope' },
    { key: 'monospace', label: 'Mono' },
];

const ThemeEditorScreen: React.FC = () => {
    const router = useRouter();
    const { theme } = useTheme();
    const { user, userData, relationshipData, plan, isLoading } = usePlan();

    const currentSettings = relationshipData?.settings || {};
    const [borderKey, setBorderKey] = useState<string | undefined>(currentSettings.borderStyle);
    const [bgColor, setBgColor] = useState<string | undefined>(currentSettings.backgroundColor);
    const [textColor, setTextColor] = useState<string | undefined>(currentSettings.fontColor);
    const [fontKey, setFontKey] = useState<string | undefined>(currentSettings.fontFamily);
    const [isSaving, setIsSaving] = useState(false);

    const selectedOption = useMemo(
        () => PREMIUM_BORDER_OPTIONS.find(o => o.key === borderKey),
        [borderKey]
    );

    const previewBg = bgColor || selectedOption?.background || theme.surface;
    const previewText = textColor || selectedOption?.textColor || theme.text;
    const previewFontFamily = fontKey === 'monospace' ? 'monospace' : (fontKey || fontFamilies.body);

    const handleReset = () => {
        setBorderKey(undefined);
        setBgColor(undefined);
        setTextColor(undefined);
        setFontKey(undefined);
    };

    const handleApply = async () => {
        if (!user || !userData?.partnerId) return;
        setIsSaving(true);
        try {
            const chatId = [user.uid, userData.partnerId].sort().join('_');
            await setDoc(doc(db, 'relationships', chatId), {
                settings: {
                    borderStyle: borderKey ?? null,
                    backgroundColor: bgColor ?? null,
                    fontColor: textColor ?? null,
                    fontFamily: fontKey ?? null,
                },
            }, { merge: true });
            Toast.show({ type: 'success', text1: 'Tema aplicado para los dos' });
            router.back();
        } catch (error) {
            console.error('Error aplicando el tema:', error);
            Toast.show({ type: 'error', text1: 'No se pudo guardar el tema' });
        }
        setIsSaving(false);
    };

    if (isLoading) return <FullScreenLoader />;

    if (plan !== 'premium') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center' }}>
                    La personalización de tema es exclusiva de Conexión Total.
                </Text>
                <Button title="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.s16 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: spacing.s12 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: theme.text }}>Personalizar tema</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s16 }}>
                {/* Preview en vivo */}
                <View style={{ marginTop: spacing.s10, marginBottom: spacing.s22 }}>
                    <View
                        style={{
                            backgroundColor: previewBg,
                            borderWidth: selectedOption?.borderWidth ?? 1,
                            borderColor: selectedOption?.borderColor ?? theme.borderSoft,
                            borderStyle: selectedOption?.dashed ? 'dashed' : 'solid',
                            borderRadius: selectedOption?.borderRadius ?? radii.card,
                            padding: spacing.s20,
                            ...(selectedOption?.shadow ? { shadowColor: '#FF7A9C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 6 } : {}),
                        }}
                    >
                        {selectedOption?.icon === 'heart' && (
                            <Ionicons name="heart" size={22} color={selectedOption.iconColor} style={{ marginBottom: spacing.s8 }} />
                        )}
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 20, color: previewText, marginBottom: spacing.s4 }}>
                            Conexión Diaria
                        </Text>
                        <Text style={{ fontFamily: previewFontFamily, fontSize: 14, color: previewText, opacity: 0.85 }}>
                            Así se verá su espacio compartido.
                        </Text>
                    </View>
                    <View style={{
                        position: 'absolute', top: -10, alignSelf: 'center',
                        backgroundColor: theme.primary, borderRadius: radii.pill,
                        paddingHorizontal: spacing.s10, paddingVertical: 3,
                    }}>
                        <Text style={{ fontFamily: fontFamilies.bodyExtraBold, fontSize: 9, color: theme.white, letterSpacing: 0.5 }}>PREVIEW</Text>
                    </View>
                </View>

                {/* Estilo de borde */}
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint, marginBottom: spacing.s10 }}>
                    ESTILO DE BORDE · 10 OPCIONES
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8, marginBottom: spacing.s22 }}>
                    {PREMIUM_BORDER_OPTIONS.map(option => {
                        const isSelected = borderKey === option.key;
                        return (
                            <TouchableOpacity
                                key={option.key}
                                onPress={() => setBorderKey(isSelected ? undefined : option.key)}
                                style={{
                                    width: '47%',
                                    backgroundColor: option.background,
                                    borderWidth: isSelected ? 2.5 : option.borderWidth,
                                    borderColor: isSelected ? theme.primary : option.borderColor,
                                    borderStyle: option.dashed ? 'dashed' : 'solid',
                                    borderRadius: Math.min(option.borderRadius, 18),
                                    padding: spacing.s12,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: spacing.s8,
                                }}
                            >
                                {option.icon === 'heart' && <Ionicons name="heart" size={16} color={option.iconColor} />}
                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12.5, color: option.textColor, flexShrink: 1 }}>
                                    {option.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Fondo */}
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint, marginBottom: spacing.s10 }}>
                    FONDO
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.s10, marginBottom: spacing.s22 }}>
                    {BG_SWATCHES.map(color => {
                        const isSelected = bgColor === color;
                        return (
                            <TouchableOpacity
                                key={color}
                                onPress={() => setBgColor(isSelected ? undefined : color)}
                                style={{
                                    width: 26, height: 26, borderRadius: 8, backgroundColor: color,
                                    borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? theme.primary : theme.borderSoft,
                                }}
                            />
                        );
                    })}
                </View>

                {/* Texto */}
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint, marginBottom: spacing.s10 }}>
                    TEXTO
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.s10, marginBottom: spacing.s22 }}>
                    {TEXT_SWATCHES.map(color => {
                        const isSelected = textColor === color;
                        return (
                            <TouchableOpacity
                                key={color}
                                onPress={() => setTextColor(isSelected ? undefined : color)}
                                style={{
                                    width: 26, height: 26, borderRadius: 8, backgroundColor: color,
                                    borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? theme.primary : theme.borderSoft,
                                }}
                            />
                        );
                    })}
                </View>

                {/* Tipografía */}
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint, marginBottom: spacing.s10 }}>
                    TIPOGRAFÍA
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                    {FONT_CHIPS.map(chip => {
                        const isSelected = fontKey === chip.key;
                        return (
                            <TouchableOpacity
                                key={chip.key}
                                onPress={() => setFontKey(isSelected ? undefined : chip.key)}
                                style={{
                                    flex: 1, alignItems: 'center', paddingVertical: spacing.s12,
                                    borderRadius: radii.field, borderWidth: isSelected ? 2 : 1,
                                    borderColor: isSelected ? theme.primary : theme.borderSoft,
                                    backgroundColor: theme.surface,
                                }}
                            >
                                <Text style={{ fontFamily: chip.key === 'monospace' ? 'monospace' : chip.key, fontSize: 13, color: theme.text }}>
                                    {chip.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Pie fijo */}
            <View style={{ flexDirection: 'row', gap: spacing.s10, padding: spacing.s22, borderTopWidth: 1, borderTopColor: theme.divider }}>
                <View style={{ flex: 1 }}>
                    <Button title="Restablecer" variant="outline" onPress={handleReset} disabled={isSaving} />
                </View>
                <View style={{ flex: 1.4 }}>
                    <Button title="Aplicar a los dos" onPress={handleApply} loading={isSaving} loadingText="Aplicando…" />
                </View>
            </View>
        </SafeAreaView>
    );
};

export default ThemeEditorScreen;
