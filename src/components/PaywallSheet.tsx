// Paywall premium — Sprint 7.1 (componentes transversales), variante de
// escritorio en Sprint 7.10.
//
// Patrón único y reutilizable (ver README del bundle de diseño, sección
// "C. Paywall premium"): un solo componente para los cinco disparadores
// (emojis premium, historial del extrañómetro, recordatorios, límite de
// deseos, personalización de tema, límite de almacenamiento). Reemplazó a
// UpgradeModal.tsx (retirado en la sesión 7.9).
//
// En escritorio (>=760px) el handoff pide panel lateral en vez de bottom
// sheet ("Responsive / Escritorio, Detalles de PC") — mismo contenido,
// solo cambia el contenedor: pegado a la derecha y a todo el alto en vez
// de anclado abajo con esquinas redondeadas arriba.
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/themeContext';
import { radii, spacing } from '../config/theme';
import { useResponsive } from '../hooks/useResponsive';
import { usePricing } from '../hooks/usePricing';

export const PaywallSheet: React.FC<{
    visible: boolean;
    onClose: () => void;
    onUpgradePress: () => void;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
    benefits: string[];
    proofSlot?: React.ReactNode;
}> = ({
    visible,
    onClose,
    onUpgradePress,
    icon,
    title,
    description,
    benefits,
    proofSlot,
}) => {
    const { theme, fontFamilies } = useTheme();
    const { isDesktop } = useResponsive();

    // Sprint 9.19: el precio salía de tres props con valor por defecto escrito
    // a mano ('US$9.99', 'US$2.99', '-70% HOY'). Eso decía "-70% HOY" los 365
    // días del año, aunque no hubiera ningún descuento vigente, y seguiría
    // diciendo US$2.99 el día que se agoten los cupos de fundador. Un cartel
    // que miente sobre el precio no es un detalle de diseño.
    //
    // Ahora todo sale de la oferta que de verdad se va a cobrar. Solo se
    // consulta con el cartel abierto (ver 'enabled').
    const pricing = usePricing({ enabled: visible });
    const price = pricing.monthly?.product.priceString ?? null;

    const cardContent = (
        <>
            <LinearGradient
                colors={theme.premiumGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
            >
                <Ionicons name={icon} size={22} color={theme.premiumTextOnFill} />
            </LinearGradient>

            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase', color: theme.premium }}>
                CONEXIÓN TOTAL
            </Text>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, lineHeight: 27, color: theme.text }}>{title}</Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 21, color: theme.textMuted }}>
                {description} <Text style={{ fontFamily: fontFamilies.bodyBold, color: theme.text }}>Uno paga, ambos disfrutan.</Text>
            </Text>

            {proofSlot}

            <View style={{ gap: spacing.s8 }}>
                {benefits.map((benefit) => (
                    <View key={benefit} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                        <Ionicons name="checkmark-circle" size={17} color={theme.success} />
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, color: theme.text, flexShrink: 1 }}>{benefit}</Text>
                    </View>
                ))}
            </View>

            {/* Sin precio que respaldar no se inventa ninguno: mientras
                carga, o si RevenueCat no respondió, el bloque no aparece y el
                botón sigue estando. Es preferible un cartel sin precio a un
                precio que no es el que se va a cobrar. */}
            {!!price && (
                <View style={{ gap: spacing.s6, marginTop: spacing.s4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.s8, flexWrap: 'wrap' }}>
                        {!!pricing.listMonthlyPrice && (
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 15, color: theme.textMuted, textDecorationLine: 'line-through' }}>
                                {pricing.listMonthlyPrice}
                            </Text>
                        )}
                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 26, color: theme.text }}>{price}</Text>
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted }}>/ mes</Text>
                        {!!pricing.offer.discountLabel && (
                            <View style={{ backgroundColor: theme.warnBg, borderRadius: 6, paddingHorizontal: spacing.s8, paddingVertical: 3, marginLeft: spacing.s4 }}>
                                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10, color: theme.warnText }}>
                                    {pricing.offer.discountLabel}
                                </Text>
                            </View>
                        )}
                    </View>
                    {/* La otra mitad del trabajo: un descuento sin motivo se
                        lee como precio inflado el resto del año. */}
                    {!!pricing.offer.reason && (
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.premium }}>
                            {pricing.offer.reason}
                        </Text>
                    )}
                </View>
            )}

            <TouchableOpacity
                onPress={onUpgradePress}
                style={{ backgroundColor: theme.primary, borderRadius: radii.field + 1, paddingVertical: spacing.s16 + 1, alignItems: 'center', marginTop: spacing.s8 }}
            >
                <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 16, color: theme.white }}>Actualizar a Conexión Total</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ alignItems: 'center', paddingVertical: spacing.s8 }}>
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.textMuted }}>Ahora no</Text>
            </TouchableOpacity>
        </>
    );

    if (isDesktop) {
        return (
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(24,22,46,0.5)' }}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
                    <ScrollView
                        style={{ width: 400, backgroundColor: theme.surface, borderTopLeftRadius: radii.sheetTop, borderBottomLeftRadius: radii.sheetTop }}
                        contentContainerStyle={{ padding: spacing.s26, gap: spacing.s12 }}
                    >
                        {cardContent}
                    </ScrollView>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,22,46,0.5)' }}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
                <View
                    style={{
                        backgroundColor: theme.surface,
                        borderTopLeftRadius: radii.sheetTop,
                        borderTopRightRadius: radii.sheetTop,
                        borderBottomLeftRadius: radii.sheetBottom,
                        borderBottomRightRadius: radii.sheetBottom,
                        padding: spacing.s22,
                        paddingBottom: spacing.s26 + spacing.s4,
                        gap: spacing.s12,
                    }}
                >
                    <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.borderSoft, marginBottom: spacing.s8 }} />
                    {cardContent}
                </View>
            </View>
        </Modal>
    );
};
