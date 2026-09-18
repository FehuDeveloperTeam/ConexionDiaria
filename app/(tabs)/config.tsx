// Sprint 7.8a — re-skin de Ajustes según el sistema de diseño: avatar con
// badge de cámara, nombre editable inline, tarjeta de plan (free/premium),
// lista de preferencias y zona delicada separada visualmente.
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ActivityIndicator, Alert, Image, TouchableOpacity,
    TextInput, ScrollView, Switch, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { auth, db, storage } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import { signOut } from 'firebase/auth';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { formatDate } from '../../src/services/dateFormat';
import { countFilled, fieldsFor, normalizeMeasurements } from '../../src/config/measurements';
import { usePricing } from '../../src/hooks/usePricing';
import { useIsAdmin } from '../../src/hooks/useIsAdmin';
import type { Gender } from '../../src/types/models';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { ConfirmDestructiveModal } from '../../src/components/ConfirmDestructiveModal';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { captureError } from '../../src/services/errorReporter';

// Nombres de los 10 estilos de borde premium (ver ThemeContext), en el
// mismo orden que el catálogo del handoff — se reutiliza para mostrar el
// tema activo acá, y será la base del probador de tema (sesión 7.8b).
const BORDER_STYLE_NAMES: Record<string, string> = {
    heartBorder1: 'Corazón rosado',
    heartBorder2: 'Corazón fucsia punteado',
    heartBorder3: 'Circular',
    heartBorder4: 'Sombra rosa',
    heartBorder5: 'Lavanda pastel',
    heartBorder6: 'Azul pastel',
    heartBorder7: 'Menta pastel',
    heartBorder8: 'Limón pastel',
    heartBorder9: 'Durazno pastel',
    heartBorder10: 'Coral pastel',
};

const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) {
            console.error("uriToBlob falló:", e);
            reject(new TypeError("Network request failed"));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
};

// Las cuentas anteriores al Sprint 9.11 no guardan fecha de nacimiento y la
// fila es de solo lectura, así que se muestra esta en su lugar. Desde 9.11 el
// registro la exige, de modo que solo afecta a las cuentas de prueba viejas.
const LEGACY_BIRTH_DATE = new Date(1998, 11, 25);

const PrefRow: React.FC<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    subcopy?: string;
    isLast?: boolean;
    // Opcional: una fila de solo lectura no ofrece nada a la derecha.
    right?: React.ReactNode;
    onPress?: () => void;
}> = ({ icon, label, subcopy, isLast, right, onPress }) => {
    const { theme, fontFamilies } = useTheme();
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.s12,
                paddingVertical: 11,
                paddingHorizontal: 15,
                borderBottomWidth: isLast ? 0 : 1,
                borderBottomColor: theme.divider,
            }}
        >
            <Ionicons name={icon} size={20} color={theme.textMuted} />
            <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text }}>{label}</Text>
                {!!subcopy && (
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint, marginTop: 2 }}>{subcopy}</Text>
                )}
            </View>
            {right}
        </TouchableOpacity>
    );
};

// Sprint 9.19: una de las dos opciones de cobro dentro de la tarjeta de plan.
// Vive sobre el degradado premium, así que sus colores son fijos y no del
// tema: sobre ese fondo, theme.text sería ilegible en modo claro.
const PlanOption: React.FC<{
    label: string;
    price: string;
    suffix: string;
    strikethrough?: string | null;
    badge?: string;
    note?: string;
    selected: boolean;
    onPress: () => void;
}> = ({ label, price, suffix, strikethrough, badge, note, selected, onPress }) => {
    const { fontFamilies } = useTheme();
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={{
                borderRadius: 14,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.28)',
                backgroundColor: selected ? 'rgba(255,255,255,0.14)' : 'transparent',
                paddingVertical: spacing.s12,
                paddingHorizontal: spacing.s14,
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={17}
                    color={selected ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
                />
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: '#FFFFFF', flex: 1 }}>
                    {label}
                </Text>
                {!!strikethrough && (
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecorationLine: 'line-through' }}>
                        {strikethrough}
                    </Text>
                )}
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 18, color: '#FFFFFF' }}>{price}</Text>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>{suffix}</Text>
            </View>
            {!!(note || badge) && (
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 11.5, color: 'rgba(255,255,255,0.75)', marginLeft: 25, marginTop: 3 }}>
                    {[badge, note].filter(Boolean).join(' · ')}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const PremiumBadge: React.FC = () => {
    const { theme, fontFamilies } = useTheme();
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.warnBg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Ionicons name="lock-closed" size={13} color={theme.warnText} />
            <Text style={{ fontFamily: fontFamilies.bodyExtraBold, fontSize: 10, color: theme.warnText }}>PREMIUM</Text>
        </View>
    );
};

const ConfigScreen: React.FC = () => {
    const router = useRouter();
    const { theme, isDarkMode, setDarkMode, fontFamilies, borderStyle } = useTheme();
    const { plan, user, userData, relationshipData, isLoading } = usePlan();
    const pricing = usePricing();
    const { isAdmin } = useIsAdmin();
    const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');

    const [displayName, setDisplayName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isNotificationsSheetVisible, setIsNotificationsSheetVisible] = useState(false);
    const [isPaywallVisible, setIsPaywallVisible] = useState(false);
    // El de arriba explica la personalización de tema. La ficha de la pareja
    // necesita el suyo: un paywall que habla de otra cosa se lee como un error.
    const [isPartnerPaywallVisible, setIsPartnerPaywallVisible] = useState(false);
    const [isDisconnectConfirmVisible, setIsDisconnectConfirmVisible] = useState(false);
    const birthDate: Date | null = userData?.birthDate?.toDate ? userData.birthDate.toDate() : null;

    // Sprint 9.24: el contador de "Mis tallas" sale del perfil que ya está en
    // memoria, sin lecturas extra.
    const myMeasurementFields = fieldsFor((userData?.gender as Gender) ?? null);
    const myMeasurementsFilled = countFilled(normalizeMeasurements(userData?.measurements), myMeasurementFields);

    useEffect(() => {
        if (userData) {
            setDisplayName(userData.displayName || '');
        }
    }, [userData]);

    // Sprint 9.18: antes esto compraba 'availablePackages[0]', el primer
    // paquete que devolviera RevenueCat. Con un solo precio funcionaba de
    // casualidad; con cinco escalones cobraba el que quedara primero, que no
    // tiene por qué ser el que la persona vio en el cartel. Ahora el paquete
    // sale de usePricing(), que es quien decide el escalón — el mismo del que
    // el cartel saca el precio, así que lo mostrado y lo cobrado no se pueden
    // separar.
    const handleUpgrade = async (period: 'monthly' | 'annual' = 'monthly') => {
        if (!user) return;

        const packageToPurchase = period === 'annual' ? pricing.annual : pricing.monthly;
        if (!packageToPurchase) {
            Toast.show({
                type: 'error',
                text1: 'No hay planes disponibles',
                text2: 'Inténtalo de nuevo en un momento.',
            });
            return;
        }

        try {
            // Ya NO escribimos 'plan' acá. Las reglas de Firestore bloquean
            // que el cliente toque ese campo — lo hace exclusivamente la
            // Cloud Function que valida el webhook de RevenueCat, que además
            // es quien reparte el cupo de fundador (9.17). El listener de
            // PlanContext refleja el cambio solo.
            const granted = await pricing.purchase(packageToPurchase);
            if (granted) {
                Toast.show({ type: 'success', text1: '¡Compra exitosa!', text2: 'Activando tu Premium...' });
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error(e);
                // Un pago que falla es el único error que cuesta plata directa.
                captureError(e, { origin: 'comprarPremium', context: { period } });
                Toast.show({ type: 'error', text1: 'Error al procesar el pago' });
            }
        }
    };

    const handlePickAvatar = useCallback(async () => {
        if (!user) return;

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert("Permisos necesarios", "Se necesita acceso a la galería.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (result.canceled || !result.assets) return;

        setIsUploading(true);
        const uri = result.assets[0].uri;

        try {
            const manipResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 400 } }],
                { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
            );

            const blob = await uriToBlob(manipResult.uri);
            const fileName = `${user.uid}_${Crypto.randomUUID()}.jpg`;
            const storageRef = ref(storage, `avatars/${user.uid}/${fileName}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on('state_changed', null,
                (error) => {
                    console.error("Error al subir avatar:", error);
                    captureError(error, { origin: 'subirAvatar' });
                    setIsUploading(false);
                    Toast.show({ type: 'error', text1: 'Error al subir la imagen' });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    await updateDoc(doc(db, 'users', user.uid), { photoURL: downloadURL });
                    setIsUploading(false);
                    Toast.show({ type: 'success', text1: '¡Foto de perfil actualizada!' });
                }
            );
        } catch (error) {
            console.error("Error procesando imagen:", error);
            setIsUploading(false);
            Toast.show({ type: 'error', text1: 'Error al procesar la imagen' });
        }
    }, [user]);

    const handleSaveDisplayName = useCallback(async () => {
        if (!user || !displayName.trim()) {
            Toast.show({ type: 'error', text1: 'El nombre no puede estar vacío' });
            return;
        }

        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { displayName: displayName.trim() });
            Toast.show({ type: 'success', text1: 'Nombre actualizado' });
        } catch (error) {
            console.error("Error al guardar nombre:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar' });
        }
        setIsSaving(false);
    }, [user, displayName]);

    const handleToggleNotificationPref = useCallback(async (key: 'newMessages' | 'missYou' | 'albumActivity', value: boolean) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, 'users', user.uid), { [`notificationPrefs.${key}`]: value });
        } catch (error) {
            console.error('Error guardando preferencia de notificaciones:', error);
            Toast.show({ type: 'error', text1: 'No se pudo guardar el cambio' });
        }
    }, [user]);

    const handleDisconnect = useCallback(async () => {
        if (!user || !userData || !userData.partnerId) return;
        try {
            const batch = writeBatch(db);
            batch.update(doc(db, 'users', user.uid), { partnerId: null });
            batch.update(doc(db, 'users', userData.partnerId), { partnerId: null });
            await batch.commit();
            Toast.show({ type: 'success', text1: 'Desconectado correctamente' });
        } catch (error) {
            console.error("Error al desconectar:", error);
            Toast.show({ type: 'error', text1: 'Error al desconectar' });
        }
        setIsDisconnectConfirmVisible(false);
    }, [user, userData]);

    const handleLogout = useCallback(async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            Toast.show({ type: 'error', text1: 'Error al cerrar sesión' });
        }
    }, []);

    if (isLoading || !userData) {
        return <FullScreenLoader />;
    }

    const activeThemeName = relationshipData?.settings?.borderStyle
        ? BORDER_STYLE_NAMES[relationshipData.settings.borderStyle] || 'Personalizado'
        : 'Predeterminado';
    const activeFontName = relationshipData?.settings?.fontFamily || 'Manrope';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s26 }}>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.text, marginBottom: spacing.s20 }}>
                    Ajustes
                </Text>

                {/* Avatar + nombre */}
                <View style={{ alignItems: 'center', marginBottom: spacing.s22 }}>
                    <TouchableOpacity onPress={handlePickAvatar} disabled={isUploading} style={{ width: 78, height: 78 }}>
                        {userData?.photoURL ? (
                            <Image source={{ uri: userData.photoURL }} style={{ width: 78, height: 78, borderRadius: 39 }} />
                        ) : (
                            <View style={{ width: 78, height: 78, borderRadius: 39, backgroundColor: theme.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.primary }}>
                                    {userData?.displayName?.[0]?.toUpperCase() || 'U'}
                                </Text>
                            </View>
                        )}
                        {isUploading ? (
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 39, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            </View>
                        ) : (
                            <View style={{
                                position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderRadius: 15,
                                backgroundColor: theme.primary, borderWidth: 3, borderColor: theme.bg,
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Ionicons name="camera" size={14} color={theme.white} />
                            </View>
                        )}
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, marginTop: spacing.s16, width: '100%' }}>
                        <TextInput
                            style={{
                                flex: 1, height: 46, borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                                paddingHorizontal: spacing.s14, fontFamily: fontFamilies.body, fontSize: 15, color: theme.text,
                                backgroundColor: theme.inputBackground,
                            }}
                            value={displayName}
                            onChangeText={setDisplayName}
                            placeholder="Tu nombre de pila"
                            placeholderTextColor={theme.textFaint}
                            maxLength={20}
                        />
                        <TouchableOpacity
                            onPress={handleSaveDisplayName}
                            disabled={isSaving || displayName.trim() === '' || displayName === userData?.displayName}
                            style={{
                                paddingHorizontal: spacing.s16, height: 46, borderRadius: radii.field,
                                backgroundColor: theme.primarySoft, alignItems: 'center', justifyContent: 'center',
                                opacity: (isSaving || displayName.trim() === '' || displayName === userData?.displayName) ? 0.5 : 1,
                            }}
                        >
                            {isSaving ? <ActivityIndicator size="small" color={theme.primary} /> : (
                                <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 14, color: theme.primary }}>Guardar</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Tarjeta de plan */}
                {plan === 'free' ? (
                    <LinearGradient
                        colors={theme.premiumPanelGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: radii.card, padding: spacing.s20, marginBottom: spacing.s16 }}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s10 }}>
                            <Ionicons name="ribbon" size={16} color={theme.premium} />
                            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.premium }}>
                                PLAN ACTUAL: FREE
                            </Text>
                        </View>
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: '#FFFFFF', marginBottom: spacing.s6 }}>
                            Conexión Total para los dos
                        </Text>
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.s16 }}>
                            Uno paga, ambos disfrutan.
                        </Text>
                        {/* Sprint 9.19: estos precios estaban escritos a mano
                            ('US$9.99' tachado, 'US$2.99'). Ahora salen del
                            paquete que se va a cobrar, así que no se pueden
                            separar de lo que cobra la tienda, y el motivo del
                            descuento se dice en voz alta: un precio rebajado
                            sin explicación se lee como precio inflado el resto
                            del año. */}
                        {!!pricing.offer.reason && (
                            <View style={{
                                alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.s6,
                                backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 8,
                                paddingHorizontal: spacing.s10, paddingVertical: 5, marginBottom: spacing.s12,
                            }}>
                                <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: '#FFFFFF' }}>
                                    {pricing.offer.reason}
                                </Text>
                            </View>
                        )}

                        {pricing.monthly ? (
                            <View style={{ gap: spacing.s8, marginBottom: spacing.s16 }}>
                                <PlanOption
                                    label="Mensual"
                                    price={pricing.monthly.product.priceString}
                                    suffix="/ mes"
                                    strikethrough={pricing.listMonthlyPrice}
                                    badge={pricing.offer.discountLabel}
                                    selected={period === 'monthly'}
                                    onPress={() => setPeriod('monthly')}
                                />
                                {!!pricing.annual && (
                                    <PlanOption
                                        label="Anual"
                                        price={pricing.annual.product.priceString}
                                        suffix="/ año"
                                        note="Equivale a 10 meses: dos van de regalo"
                                        badge={pricing.offer.discountLabel}
                                        selected={period === 'annual'}
                                        onPress={() => setPeriod('annual')}
                                    />
                                )}
                            </View>
                        ) : (
                            // Ni un precio de mentira ni un botón que revienta:
                            // mientras no haya paquete, se dice que se está
                            // cargando.
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: spacing.s16 }}>
                                {pricing.isLoading ? 'Cargando planes…' : 'No pudimos cargar los planes. Inténtalo en un momento.'}
                            </Text>
                        )}

                        <TouchableOpacity
                            onPress={() => handleUpgrade(period)}
                            disabled={!pricing.monthly}
                            style={{
                                backgroundColor: theme.premium, borderRadius: 15,
                                paddingVertical: spacing.s14, alignItems: 'center',
                                opacity: pricing.monthly ? 1 : 0.5,
                            }}
                        >
                            <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 15, color: theme.premiumTextOnFill }}>
                                Actualizar a Conexión Total
                            </Text>
                        </TouchableOpacity>
                    </LinearGradient>
                ) : (
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: spacing.s12,
                        backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.premium,
                        borderRadius: radii.card, padding: spacing.s16, marginBottom: spacing.s16,
                    }}>
                        <LinearGradient
                            colors={theme.premiumGradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={{ width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Ionicons name="heart" size={22} color={theme.premiumTextOnFill} />
                        </LinearGradient>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 15, color: theme.premium }}>
                                Conexión Total activa
                            </Text>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint, marginTop: 2 }}>
                                Disfruten de todo sin límites.
                            </Text>
                        </View>
                    </View>
                )}

                {/* Preferencias */}
                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint, marginBottom: spacing.s10 }}>
                    PREFERENCIAS
                </Text>
                <View style={{
                    backgroundColor: theme.surface,
                    borderRadius: radii.field + 2,
                    marginBottom: spacing.s22,
                    // Sprint 8.6: estilo de borde de la pareja (probador de tema) —
                    // solo el borde, nunca el radio (el contenedor ya tiene el suyo).
                    ...(borderStyle.key !== 'default' ? {
                        borderWidth: borderStyle.borderWidth,
                        borderColor: borderStyle.borderColor,
                        borderStyle: borderStyle.dashed ? 'dashed' : 'solid',
                    } : null),
                }}>
                    <PrefRow
                        icon="moon"
                        label="Modo oscuro"
                        right={
                            <Switch
                                value={isDarkMode}
                                onValueChange={setDarkMode}
                                trackColor={{ false: theme.borderSoft, true: theme.primarySoft }}
                                thumbColor={isDarkMode ? theme.primary : theme.surface}
                                style={{ transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }] }}
                            />
                        }
                    />
                    <PrefRow
                        icon="notifications-outline"
                        label="Notificaciones"
                        onPress={() => setIsNotificationsSheetVisible(true)}
                        right={<Ionicons name="chevron-forward" size={18} color={theme.textFaint} />}
                    />
                    {/* Sprint 9.11: desde el registro es obligatoria, pero las
                        cuentas anteriores la traen vacía y necesitan un lugar
                        donde completarla. */}
                    {/* Sprint 9.12: en escritorio se llega tocando a la pareja
                        en el riel; acá para que también exista en el teléfono. */}
                    {userData?.partnerId && (
                        <PrefRow
                            icon="person-circle-outline"
                            label="Ficha de la pareja"
                            subcopy="Tallas, gustos y notas que solo ves tú"
                            onPress={() => plan === 'premium' ? router.push('/partner') : setIsPartnerPaywallVisible(true)}
                            right={plan === 'free' ? <PremiumBadge /> : <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />}
                        />
                    )}
                    {/* Sprint 9.24: el espejo de la ficha de la pareja. Acá
                        declaro lo mío, y es gratis a propósito — lo que declaro
                        alimenta la ficha de la OTRA persona, que sí es
                        premium. */}
                    <PrefRow
                        icon="shirt-outline"
                        label="Mis tallas"
                        subcopy={userData?.partnerId
                            ? `${myMeasurementsFilled} de ${myMeasurementFields.length} · las ve tu pareja`
                            : `${myMeasurementsFilled} de ${myMeasurementFields.length} completadas`}
                        onPress={() => router.push('/measurements')}
                        right={<Ionicons name="chevron-forward" size={18} color={theme.textFaint} />}
                    />
                    {/* Solo lectura, y a propósito. La fecha de nacimiento
                        decide cuándo se abre la ventana de descuento de
                        cumpleaños: si se pudiera editar, bastaría moverla dos
                        días para gatillar la oferta cuando uno quisiera. Se
                        pide obligatoria al crear la cuenta y desde ahí no se
                        toca. */}
                    <PrefRow
                        icon="balloon-outline"
                        label="Fecha de nacimiento"
                        subcopy={formatDate(birthDate ?? LEGACY_BIRTH_DATE)}
                    />
                    {/* Sprint 10.1: solo existe para el equipo. Quien no
                        tenga el permiso ni siquiera ve la fila, y aunque
                        llegara a la ruta a mano, las reglas no le dan nada. */}
                    {isAdmin && (
                        <PrefRow
                            icon="stats-chart-outline"
                            label="Panel del equipo"
                            subcopy="Métricas de Conexión Diaria"
                            onPress={() => router.push('/admin')}
                            right={<Ionicons name="chevron-forward" size={18} color={theme.textFaint} />}
                        />
                    )}
                    {/* Sprint 10.2: la bienvenida se salta con un toque, así
                        que tiene que haber forma de volver a verla. */}
                    {!!userData?.partnerId && (
                        <PrefRow
                            icon="sparkles-outline"
                            label="Ver la bienvenida"
                            subcopy="Un repaso de lo que pueden hacer los dos"
                            onPress={() => router.push('/welcome')}
                            right={<Ionicons name="chevron-forward" size={18} color={theme.textFaint} />}
                        />
                    )}
                    <PrefRow
                        icon="color-palette-outline"
                        label="Personalizar tema"
                        subcopy={plan === 'premium' ? `${activeThemeName} · ${activeFontName}` : undefined}
                        isLast
                        onPress={() => plan === 'premium' ? router.push('/theme-editor') : setIsPaywallVisible(true)}
                        right={plan === 'free' ? <PremiumBadge /> : <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />}
                    />
                </View>

                {/* Zona delicada */}
                {userData?.partnerId && (
                    <>
                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.danger, marginBottom: spacing.s10 }}>
                            ZONA DELICADA
                        </Text>
                        <TouchableOpacity
                            onPress={() => setIsDisconnectConfirmVisible(true)}
                            style={{
                                flexDirection: 'row', alignItems: 'center', gap: spacing.s12,
                                borderWidth: 1, borderColor: '#F2C4CE', backgroundColor: theme.dangerBg,
                                borderRadius: radii.field, padding: spacing.s14, marginBottom: spacing.s22,
                            }}
                        >
                            <Ionicons name="heart-dislike-outline" size={20} color={theme.danger} />
                            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 14.5, color: theme.danger }}>
                                Desconectar de mi pareja
                            </Text>
                        </TouchableOpacity>
                    </>
                )}

                <Button title="Cerrar sesión" variant="ghost" onPress={handleLogout} />
            </ScrollView>
            </DesktopContentWrap>

            {/* Bottom sheet de notificaciones */}
            <Modal visible={isNotificationsSheetVisible} transparent animationType="slide" onRequestClose={() => setIsNotificationsSheetVisible(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,22,46,0.5)' }}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setIsNotificationsSheetVisible(false)} accessibilityElementsHidden importantForAccessibility="no" />
                    <View style={{ backgroundColor: theme.surface, borderTopLeftRadius: radii.sheetTop, borderTopRightRadius: radii.sheetTop, padding: spacing.s22, gap: spacing.s14 }}>
                        <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.borderSoft }} />
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, color: theme.text }}>Notificaciones</Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.s8 }}>
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text, flex: 1 }}>Mensajes nuevos</Text>
                            <Switch
                                value={userData?.notificationPrefs?.newMessages !== false}
                                onValueChange={(value) => handleToggleNotificationPref('newMessages', value)}
                                trackColor={{ false: theme.borderSoft, true: theme.primarySoft }}
                                thumbColor={userData?.notificationPrefs?.newMessages !== false ? theme.primary : theme.surface}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.s8 }}>
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text, flex: 1 }}>
                                &quot;Te extraño&quot; de tu pareja
                            </Text>
                            <Switch
                                value={userData?.notificationPrefs?.missYou !== false}
                                onValueChange={(value) => handleToggleNotificationPref('missYou', value)}
                                trackColor={{ false: theme.borderSoft, true: theme.primarySoft }}
                                thumbColor={userData?.notificationPrefs?.missYou !== false ? theme.primary : theme.surface}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.s8 }}>
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text, flex: 1 }}>
                                Reacciones y comentarios del álbum
                            </Text>
                            <Switch
                                value={userData?.notificationPrefs?.albumActivity !== false}
                                onValueChange={(value) => handleToggleNotificationPref('albumActivity', value)}
                                trackColor={{ false: theme.borderSoft, true: theme.primarySoft }}
                                thumbColor={userData?.notificationPrefs?.albumActivity !== false ? theme.primary : theme.surface}
                            />
                        </View>

                        <Button title="Listo" onPress={() => setIsNotificationsSheetVisible(false)} style={{ marginTop: spacing.s8 }} />
                    </View>
                </View>
            </Modal>

            <PaywallSheet
                visible={isPaywallVisible}
                onClose={() => setIsPaywallVisible(false)}
                onUpgradePress={() => { setIsPaywallVisible(false); handleUpgrade(); }}
                icon="color-palette"
                title="Personaliza su tema"
                description="Elige el color, la tipografía y el borde de la pareja con Conexión Total."
                benefits={['10 estilos de borde exclusivos', 'Fondo y texto a su gusto', 'Se aplica para los dos']}
            />

            <PaywallSheet
                visible={isPartnerPaywallVisible}
                onClose={() => setIsPartnerPaywallVisible(false)}
                onUpgradePress={() => { setIsPartnerPaywallVisible(false); handleUpgrade(); }}
                icon="gift"
                title="Llega preparado a la fecha"
                description="Anota sus tallas, sus gustos y las ideas de regalo en una ficha que solo ves tú, y tenlas a mano cuando se acerque la fecha."
                benefits={['Tallas y gustos guardados, privados de verdad', 'Sus deseos a la vista antes del cumpleaños', 'Recordatorios de calendario']}
            />

            <ConfirmDestructiveModal
                visible={isDisconnectConfirmVisible}
                icon="heart-dislike"
                title="¿Desconectar?"
                message="Se desvincularán de su pareja. Esta acción no se puede deshacer."
                confirmLabel="Sí, desconectar"
                onConfirm={handleDisconnect}
                onCancel={() => setIsDisconnectConfirmVisible(false)}
            />
        </SafeAreaView>
    );
};

export default ConfigScreen;
