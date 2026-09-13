import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet,
    ActivityIndicator, TextInput, TouchableOpacity,
    Alert,
    Modal, ScrollView, FlatList,
    Animated,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
// import { onAuthStateChanged, User } from 'firebase/auth'; // <--- Ya no es necesario
import {
    doc, DocumentData, writeBatch, onSnapshot,
    updateDoc, collection, query, orderBy, Timestamp, setDoc,
    increment,
    limit // --- AÑADIDO: Importamos 'limit' para el paywall ---
} from 'firebase/firestore';
import { db, functions } from '../../src/config/firebaseConfig';
import { httpsCallable } from 'firebase/functions';
import { sendEmailVerification } from 'firebase/auth';
import { themes, fontFamilies, spacing, radii } from '../../src/config/theme'; // Importamos la definición base de 'themes'
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

// --- Hooks de Contexto ---
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { registerPushToken } from '../../src/services/notifications';
// Alias: este archivo ya importa el 'Button' nativo de react-native para
// las secciones que 7.3b todavía no re-skinea (historial, extrañómetro).
import { Button as AppButton } from '../../src/components/Button';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { TextField } from '../../src/components/TextField';

// --- Constantes de Emojis (Free vs Premium) ---
const MOODS_BASE = [
    { emoji: '😊', name: 'Feliz' }, { emoji: '🥰', name: 'Amado/a' },
    { emoji: '😴', name: 'Cansado/a' }, { emoji: '😎', name: 'Genial' },
    { emoji: '😜', name: 'Juguetón/a' }, { emoji: '😢', name: 'Triste' },
    { emoji: '🤔', name: 'Pensativo/a' }, { emoji: '😐', name: 'Neutral' },
];

const MOODS_PREMIUM_ADDON = [
    // Afectivos y Estándar
    { emoji: '🥳', name: 'Festivo/a' }, { emoji: '🤩', name: 'Asombrado/a' },
    { emoji: '😌', name: 'Relajado/a' }, { emoji: '✨', name: 'Especial' },
    { emoji: '😇', name: 'Angelical' }, { emoji: '🤗', name: 'Abrazo' },
    { emoji: '💖', name: 'Radiante' }, { emoji: '🥺', name: 'Tierno/a' },
    { emoji: '🙏', name: 'Agradecido/a' }, { emoji: '🧘', name: 'Zen' },
    { emoji: '💪', name: 'Motivado/a' }, { emoji: '🤓', name: 'Estudioso/a' },
    // Picantes (Adultos)
    { emoji: '😏', name: 'Coqueto/a' }, { emoji: '😈', name: 'Travieso/a' },
    { emoji: '🔥', name: 'Ardiente' }, { emoji: '🥵', name: 'Acalorado/a' },
    { emoji: '🤤', name: 'Antojado/a' }, { emoji: '🫦', name: 'Mordelón/a' },
    { emoji: '🌶️', name: 'Picante' }, { emoji: '😉', name: 'Cómplice' },
    { emoji: '🍒', name: 'Atrevido/a' }, { emoji: '💥', name: 'Explosivo/a' },
];

// Títulos de toast para los códigos de error que puede lanzar la Cloud
// Function 'pairWithCode' (ver functions/src/pairing.ts, hallazgo F-02). El
// detalle va en el mensaje de la propia HttpsError, que sí llega al cliente.
const PAIRING_ERROR_TITLES: Record<string, string> = {
    'functions/not-found': 'Código Inválido',
    'functions/invalid-argument': 'Código Inválido',
    'functions/failed-precondition': 'No se puede conectar',
    'functions/unauthenticated': 'Sesión expirada',
};

const getTodayDateKey = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Eyebrow del hero de aniversario ("JUNTOS DESDE EL 14 DE FEB, 2023") —
// Sprint 7.3a. Es un texto ilustrativo, no un campo numérico, así que no
// aplica la convención dd/mm/aaaa del resto de la app.
const MESES_ABREV = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const formatAnniversaryEyebrow = (date: Date): string =>
    `JUNTOS DESDE EL ${date.getDate()} DE ${MESES_ABREV[date.getMonth()]}, ${date.getFullYear()}`;

// --- Estilos Dinámicos ---
const getStyles = (theme: typeof themes.light, fontFamily: string | undefined, borderStyle: any) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.background
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: theme.background,
        gap: 15
    },
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: theme.background, gap: 15 },
    title: { fontFamily: fontFamilies.display, fontSize: 30, color: theme.text, textAlign: 'center' },
    subtitle: { fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center' },

    // --- Sprint 7.3b: Inicio sin pareja vinculada ---
    noPartnerContainer: { flexGrow: 1, alignItems: 'center', padding: spacing.s20, gap: spacing.s16, backgroundColor: theme.bg },
    inviteCard: { width: '100%', backgroundColor: theme.surface, borderRadius: radii.cardLg, padding: spacing.s22, alignItems: 'center', gap: spacing.s10 },
    inviteIconBox: { width: 74, height: 74, borderRadius: radii.card, backgroundColor: theme.primaryTint, alignItems: 'center', justifyContent: 'center' },
    inviteCardTitle: { fontFamily: fontFamilies.display, fontSize: 21, color: theme.text },
    inviteCardCopy: { fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 20, color: theme.textMuted, textAlign: 'center', maxWidth: 250 },
    fieldLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.textMuted, alignSelf: 'flex-start', marginTop: spacing.s8 },
    codeBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderWidth: 1, borderStyle: 'dashed', borderColor: '#B9B4E4', borderRadius: radii.field + 2, paddingVertical: spacing.s12, paddingHorizontal: spacing.s16 },
    codeText: { fontFamily: fontFamilies.actionBold, fontSize: 24, letterSpacing: 5, color: theme.primary },
    copyPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.s6, backgroundColor: theme.primaryTint, borderRadius: radii.chip + 4, paddingVertical: spacing.s6, paddingHorizontal: spacing.s10 },
    copyPillText: { fontFamily: fontFamilies.bodyBold, fontSize: 12, color: theme.primary },
    // A-02: aviso de correo sin verificar (bloquea el emparejamiento en el
    // servidor, ver functions/src/pairing.ts). Colores fijos de advertencia,
    // no del tema, para que se distinga del resto de la pantalla en claro y oscuro.
    verifyBanner: { backgroundColor: 'rgba(255, 193, 7, 0.15)', borderColor: '#FFC107', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%', gap: 8 },
    verifyBannerText: { color: theme.text, fontSize: 14, fontFamily: fontFamily },
    verifyBannerActions: { flexDirection: 'row', justifyContent: 'space-between' },
    verifyBannerLink: { color: theme.primary, fontWeight: 'bold', fontSize: 13, fontFamily: fontFamily },

    // --- Sprint 7.3a: hero de aniversario ---
    heroCard: { width: '100%', borderRadius: radii.card, padding: spacing.s20, gap: spacing.s6 },
    heroEyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.1, color: '#FFFFFF', opacity: 0.85 },
    heroNumber: { fontFamily: fontFamilies.display, fontSize: 32, lineHeight: 36, color: '#FFFFFF' },

    // --- Sprint 7.3a: selector rápido de ánimo ---
    quickMoodLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.textMuted, marginTop: spacing.s16 },
    quickMoodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: spacing.s10, width: '100%' },
    quickMoodCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.borderSoft },
    quickMoodCircleSelected: { borderColor: theme.primary, borderWidth: 2 },
    quickMoodEmoji: { fontSize: 20 },
    quickMoodLockCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryTint, borderWidth: 1, borderColor: theme.borderStrong, borderStyle: 'dashed' },
    quickMoodMoreCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryTint },

    // --- Sprint 7.3a: ánimos actuales, lado a lado ---
    currentMoodsRow: { flexDirection: 'row', gap: spacing.s10, width: '100%', marginTop: spacing.s16 },
    currentMoodCard: { flex: 1, backgroundColor: theme.surface, borderRadius: radii.card - 2, padding: spacing.s12, gap: 3, borderWidth: 1, borderColor: theme.borderSoft },
    currentMoodEmoji: { fontSize: 22 },
    currentMoodName: { fontFamily: fontFamilies.bodyBold, fontSize: 13, color: theme.text },
    currentMoodStatus: { fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textMuted },

    // --- Sprint 7.3a: modal de ánimo (bottom sheet) ---
    moodSheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,22,46,0.5)' },
    moodSheetContainer: { backgroundColor: theme.surface, borderTopLeftRadius: radii.sheetTop, borderTopRightRadius: radii.sheetTop, borderBottomLeftRadius: radii.sheetBottom, borderBottomRightRadius: radii.sheetBottom, padding: spacing.s22, gap: spacing.s10 },
    moodSheetHandle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.borderSoft, marginBottom: spacing.s8 },
    moodSheetEmoji: { fontSize: 34, textAlign: 'center' },
    moodSheetTitle: { fontFamily: fontFamilies.display, fontSize: 22, textAlign: 'center', color: theme.text },
    moodSheetSubcopy: { fontFamily: fontFamilies.body, fontSize: 13, textAlign: 'center', color: theme.textMuted, marginBottom: spacing.s8 },
    moodSheetTextarea: { minHeight: 74, borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field, backgroundColor: theme.inputBackground, color: theme.text, fontFamily: fontFamilies.body, fontSize: 14, padding: spacing.s12, textAlignVertical: 'top' },
    moodSheetCounter: { fontFamily: fontFamilies.body, fontSize: 11, color: theme.textFaint, alignSelf: 'flex-end', marginTop: spacing.s4 },
    moodSheetButtons: { flexDirection: 'row', gap: spacing.s10, marginTop: spacing.s12 },

    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: {
        width: '90%',
        maxHeight: '70%',
        backgroundColor: theme.background,
        borderRadius: 20,
        padding: 20
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 15, textAlign: 'center', fontFamily: fontFamily },
    emojiScrollView: { maxHeight: 150 },
    emojiSelector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    emojiButton: { padding: 8 },
    emojiInSelector: { fontSize: 36 },
    // --- Sprint 7.3b: historial del extrañómetro (dentro del sheet) ---
    historyTableHeader: { flexDirection: 'row', paddingBottom: spacing.s10, width: '100%' },
    historyHeaderText: { fontFamily: fontFamilies.bodyBold, fontSize: 10.5, letterSpacing: 0.7, color: theme.textFaint },
    historyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: radii.chip + 4, paddingVertical: spacing.s10 + 1, paddingHorizontal: spacing.s4, marginBottom: spacing.s6 },
    historyRowText: { fontFamily: fontFamilies.body, fontSize: 13, color: theme.text },
    historyReceivedText: { color: theme.affection, fontFamily: fontFamilies.bodyBold },
    historyPaywallRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s10, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.borderStrong, backgroundColor: theme.primaryTint, borderRadius: radii.chip + 4, padding: spacing.s12 },
    historyPaywallTitle: { fontFamily: fontFamilies.bodyBold, fontSize: 13, color: theme.text },
    historyPaywallSubtitle: { fontFamily: fontFamilies.body, fontSize: 11.5, color: theme.textMuted },
    historyPaywallCta: { fontFamily: fontFamilies.bodyBold, fontSize: 12.5, color: theme.primary },

    historyFlatList: {
        width: '100%',
        maxHeight: 300
    },
    emptyHistoryText: {
        color: theme.placeholder,
        marginTop: 20,
        textAlign: 'center',
        fontSize: 14,
        fontFamily: fontFamily
    },
    // --- Sprint 7.3b: tarjeta del extrañómetro ---
    missYouCard: { width: '100%', backgroundColor: theme.surface, borderRadius: radii.card, borderWidth: 1, borderColor: theme.borderSoft, paddingVertical: spacing.s22, alignItems: 'center', gap: spacing.s12 },
    missYouCountsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s20 },
    missYouCountItem: { alignItems: 'center', gap: 2 },
    missYouPrimaryCount: { fontFamily: fontFamilies.display, fontSize: 40, lineHeight: 40, color: theme.affection },
    missYouSecondaryCount: { fontFamily: fontFamilies.bodySemiBold, fontSize: 22, color: theme.textFaint },
    missYouCountLabel: { fontFamily: fontFamilies.bodySemiBold, fontSize: 10.5, color: theme.textMuted },
    missYouDivider: { width: 1, height: 36, backgroundColor: theme.borderSoft },
    historyLink: { fontFamily: fontFamilies.bodyBold, fontSize: 12.5, color: theme.primary },
});

// --- Componente Principal ---
const Home: React.FC = () => {
    const router = useRouter();
    
    // --- Usando Hooks de Contexto ---
    const { user, userData, partnerData, relationshipData, plan, isLoading } = usePlan();
    const { theme, fontFamily, borderStyle } = useTheme();

    // Generamos los estilos dinámicamente
    const styles = getStyles(theme, fontFamily, borderStyle);

    // --- Estados Locales (Solo para UI e historial) ---
    const [missYouHistory, setMissYouHistory] = useState<DocumentData[]>([]);
    const [partnerCode, setPartnerCode] = useState('');
    const [isMoodSelectorVisible, setIsMoodSelectorVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isStatusPromptVisible, setIsStatusPromptVisible] = useState(false);
    const [statusInput, setStatusInput] = useState('');
    const [selectedMood, setSelectedMood] = useState<{ emoji: string, name: string } | null>(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [relationshipDuration, setRelationshipDuration] = useState<string | null>(null);
    const [anniversaryEyebrow, setAnniversaryEyebrow] = useState<string | null>(null);
    const [isMoodPaywallVisible, setIsMoodPaywallVisible] = useState(false);
    const [isHistoryPaywallVisible, setIsHistoryPaywallVisible] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(true);
    const [isResendingVerification, setIsResendingVerification] = useState(false);
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // A-02: 'user.emailVerified' puede estar desactualizado si la persona
    // verificó el correo en otra pestaña o dispositivo — Firebase Auth no lo
    // refresca solo. Se pide una vez al entrar a Inicio.
    useEffect(() => {
        if (!user) return;
        user.reload()
            .then(() => setIsEmailVerified(user.emailVerified))
            .catch(() => setIsEmailVerified(user.emailVerified));
    }, [user]);

    const handleResendVerification = useCallback(async () => {
        if (!user) return;
        setIsResendingVerification(true);
        try {
            await sendEmailVerification(user);
            Toast.show({ type: 'success', text1: 'Correo enviado', text2: 'Revisa tu bandeja de entrada.' });
        } catch (error) {
            console.error(error);
            Toast.show({ type: 'error', text1: 'No se pudo enviar el correo' });
        }
        setIsResendingVerification(false);
    }, [user]);

    const handleCheckVerification = useCallback(async () => {
        if (!user) return;
        try {
            await user.reload();
            setIsEmailVerified(user.emailVerified);
            if (!user.emailVerified) {
                Toast.show({ type: 'info', text1: 'Todavía no', text2: 'No encontramos la verificación. Revisa tu correo.' });
            }
        } catch (error) {
            console.error(error);
        }
    }, [user]);

    // Registrar el token de push apenas hay pareja conectada. No pide
    // permiso de nuevo si ya estaba concedido.
    //
    // F-06: el token ya no vive en 'userData' (se movió a una subcolección
    // privada, ver src/services/notifications.ts), así que este efecto no
    // puede usarlo como guarda de "ya está registrado". En su lugar, una
    // bandera en useRef evita registrar más de una vez por sesión.
    const hasRegisteredPushRef = useRef(false);
    useEffect(() => {
        if (!user || !userData?.partnerId || hasRegisteredPushRef.current) return;
        hasRegisteredPushRef.current = true;
        registerPushToken(user.uid);
    }, [user, userData?.partnerId]);

    // Función para resetear contadores
    const checkAndResetMissYouCounter = useCallback(async (relationshipId: string, currentData: DocumentData) => {
        const today = getTodayDateKey();
        const lastResetDate = currentData?.lastResetDate;

        if (!lastResetDate || lastResetDate !== today) {
            console.log('Reseteando Extrañómetro para el nuevo día:', today);

            try {
                const relationshipRef = doc(db, 'relationships', relationshipId);
                const currentCounters = currentData?.missYouCounters || {};

                if (lastResetDate && (Object.values(currentCounters).some((val: any) => val > 0))) {
                    const historyRef = doc(db, 'relationships', relationshipId, 'missYouHistory', lastResetDate);
                    await setDoc(historyRef, currentCounters);
                    console.log('Historial guardado para:', lastResetDate, currentCounters);
                }

                await updateDoc(relationshipRef, {
                    missYouCounters: {},
                    lastResetDate: today
                });

                console.log('Contadores reseteados para hoy:', today);
            } catch (error) {
                console.error('Error al resetear Extrañómetro:', error);
            }
        }
    }, []);

    // --- Efectos ---

    // useEffect para cargar el Historial (ACTUALIZADO CON LÍMITE FREEMIUM)
    const missYouPartnerId = userData?.partnerId as string | undefined;

    useEffect(() => {
        if (!user || !missYouPartnerId) {
            setMissYouHistory([]);
            return;
        }
        const relationshipId = [user.uid, missYouPartnerId].sort().join('_');
        const historyCollectionRef = collection(db, 'relationships', relationshipId, 'missYouHistory');
        
        // --- LÓGICA DE LÍMITE FREEMIUM ---
        let q;
        if (plan === 'premium') {
            // Premium: historial ilimitado en la práctica, pero con un techo
            // razonable (un año) — sin esto, la colección crece sin límite.
            q = query(historyCollectionRef, orderBy('__name__', 'desc'), limit(365));
        } else {
            // Free: Carga solo los últimos 3 días
            q = query(historyCollectionRef, orderBy('__name__', 'desc'), limit(3));
        }
        // --- FIN LÓGICA DE LÍMITE ---

        const unsubscribeHistory = onSnapshot(q, (querySnapshot) => {
            setMissYouHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            console.error("Error history listener:", error);
            setMissYouHistory([]);
        });
        return () => unsubscribeHistory();
    }, [user, missYouPartnerId, plan]);

    // useEffect para el intervalo de reset
    useEffect(() => {
        if (!user || !userData || !userData.partnerId || !relationshipData) return;
        const relationshipId = [user.uid, userData.partnerId].sort().join('_');
        const intervalId = setInterval(() => {
            checkAndResetMissYouCounter(relationshipId, relationshipData);
        }, 60000);
        return () => clearInterval(intervalId);
    }, [user, userData, relationshipData, checkAndResetMissYouCounter]);

    // useEffect para la duración de la relación
    useEffect(() => {
        if (userData?.relationshipStartDate) {
            const startDate = (userData.relationshipStartDate as Timestamp).toDate();
             const now = new Date();
             let years = now.getFullYear() - startDate.getFullYear();
             let months = now.getMonth() - startDate.getMonth();
             let days = now.getDate() - startDate.getDate();
             if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
             if (months < 0) { years -= 1; months += 12; }
             // Sprint 7.3a: el "Juntos por " ya lo dice el eyebrow del hero
             // ("JUNTOS DESDE EL..."), así que este texto queda solo con la
             // cifra — antes llevaba el prefijo repetido.
             let durationString = "";
             if (years > 0) durationString += `${years} ${years === 1 ? 'año' : 'años'}${months > 0 || days > 0 ? ', ' : ''}`;
             if (months > 0) durationString += `${months} ${months === 1 ? 'mes' : 'meses'}${days > 0 ? ' y ' : ''}`;
             if (days > 0) durationString += `${days} ${days === 1 ? 'día' : 'días'}`;
             if (years === 0 && months === 0 && days === 0) durationString = "¡Empezaron hoy!";
            setRelationshipDuration(durationString);
            setAnniversaryEyebrow(formatAnniversaryEyebrow(startDate));
        } else {
            setRelationshipDuration(null);
            setAnniversaryEyebrow(null);
        }
    }, [userData?.relationshipStartDate]);

    // --- Funciones de Manejo de Eventos ---
    const handleCopyCode = useCallback(async () => {
        if (userData?.invitationCode) {
            await Clipboard.setStringAsync(userData.invitationCode);
            Toast.show({ type: 'success', text1: '¡Código Copiado!' });
        }
    }, [userData]);

    const handleConnectPartner = useCallback(async () => {
        const rawCode = partnerCode.trim();
        if (!rawCode || !user) return;

        try {
            // El emparejamiento lo resuelve y lo escribe el servidor: es la
            // única forma de validar de verdad el código de invitación
            // (hallazgo F-02). Ver functions/src/pairing.ts.
            const pairWithCode = httpsCallable<{ code: string }, { partnerUid: string }>(functions, 'pairWithCode');
            await pairWithCode({ code: rawCode });

            setPartnerCode('');
            Toast.show({ type: 'success', text1: '¡Conexión Exitosa!' });

            await registerPushToken(user.uid);

        } catch (error: any) {
            const title = PAIRING_ERROR_TITLES[error?.code as string] ?? 'Error al conectar';
            const detail = typeof error?.message === 'string' ? error.message : undefined;
            Toast.show({ type: 'error', text1: title, text2: detail });
            console.error(error);
        }
    }, [partnerCode, user]);

    const openMoodSelector = useCallback(() => { setIsMoodSelectorVisible(true); }, []);

    const handleSelectMood = useCallback((mood: { emoji: string, name: string }) => {
        setIsMoodSelectorVisible(false);
        setSelectedMood(mood);
        setStatusInput(userData?.currentMood?.status || '');
        setIsStatusPromptVisible(true);
    }, [userData]);

    const handleSaveStatus = useCallback(async () => {
        if (!user || !selectedMood) return;
        const userDocRef = doc(db, 'users', user.uid);
        try {
            await updateDoc(userDocRef, {
                currentMood: { emoji: selectedMood.emoji, name: selectedMood.name, status: statusInput.trim() }
            });
            Toast.show({ type: 'success', text1: 'Ánimo actualizado' });
        } catch (error) { console.error("Error al actualizar el estado:", error); Toast.show({ type: 'error', text1: 'Error al guardar' }); }
        setIsStatusPromptVisible(false);
        setStatusInput('');
        setSelectedMood(null);
    }, [user, selectedMood, statusInput]);

    const showDatePicker = useCallback(() => { setDatePickerVisibility(true); }, []);
    const hideDatePicker = useCallback(() => { setDatePickerVisibility(false); }, []);

    const handleConfirmDate = useCallback(async (date: Date) => {
        hideDatePicker();
        if (!user || !userData?.partnerId) return;
        const startDateTimestamp = Timestamp.fromDate(date);
        const userDocRef = doc(db, 'users', user.uid);
        const partnerDocRef = doc(db, 'users', userData.partnerId);
        try {
            const batch = writeBatch(db);
            batch.update(userDocRef, { relationshipStartDate: startDateTimestamp });
            batch.update(partnerDocRef, { relationshipStartDate: startDateTimestamp });
            await batch.commit();
            Toast.show({ type: 'success', text1: '¡Fecha de inicio guardada!' });
        } catch { Toast.show({ type: 'error', text1: 'Error al guardar la fecha' }); }
    }, [user, userData, hideDatePicker]);

    // Rebote al tocar (Sprint 7.3b, ver README del bundle de diseño):
    // scale .92 -> 1.06 -> 1, 220ms en total.
    const pulseHeart = () => {
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 0.92, duration: 80, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1.06, duration: 80, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        ]).start();
    };

    const handleSendMissYou = useCallback(async () => {
        if (!userData || !userData.partnerId || !user) return;
        pulseHeart();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const currentUserUid = user.uid;
        const chatId = [currentUserUid, userData.partnerId].sort().join('_');
        const today = getTodayDateKey();
        const relationshipDocRef = doc(db, 'relationships', chatId);
        const historyDocRef = doc(db, 'relationships', chatId, 'missYouHistory', today);
        // 'missYouPings' es solo para que la Cloud Function tenga un evento
        // de creación limpio del cual dispararse (Sprint 5.2) — los
        // contadores de arriba no sirven para eso: son un update, no dicen
        // "esto es un ping nuevo" sin comparar contra el valor anterior.
        const pingDocRef = doc(collection(db, 'relationships', chatId, 'missYouPings'));
        try {
            const batch = writeBatch(db);
            batch.set(relationshipDocRef, {
                missYouCounters: { [currentUserUid]: increment(1) },
                lastResetDate: today
            }, { merge: true });
            batch.set(historyDocRef, { [currentUserUid]: increment(1) }, { merge: true });
            batch.set(pingDocRef, { from: currentUserUid, createdAt: Timestamp.now() });
            await batch.commit();
        } catch (error) {
            console.error("Error al enviar 'miss you':", error);
            Toast.show({ type: 'error', text1: 'Error al enviar' });
        }
    }, [userData, user, pulseAnim]);

    // --- Renderizado ---

    if (isLoading) {
        return <View style={[styles.container, { backgroundColor: theme.background }]}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    if (userData && !userData.partnerId) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.noPartnerContainer}>
                    <Text style={styles.title}>Hola, {userData.displayName}</Text>
                    <Text style={styles.subtitle}>Falta alguien aquí.</Text>

                    {!isEmailVerified && (
                        <View style={styles.verifyBanner}>
                            <Text style={styles.verifyBannerText}>
                                Verifica tu correo antes de conectar con tu pareja.
                            </Text>
                            <View style={styles.verifyBannerActions}>
                                <TouchableOpacity onPress={handleResendVerification} disabled={isResendingVerification}>
                                    <Text style={styles.verifyBannerLink}>Reenviar correo</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCheckVerification}>
                                    <Text style={styles.verifyBannerLink}>Ya lo verifiqué</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={styles.inviteCard}>
                        <View style={styles.inviteIconBox}>
                            <Ionicons name="heart-outline" size={38} color={theme.primary} />
                        </View>
                        <Text style={styles.inviteCardTitle}>Vincula a tu pareja</Text>
                        <Text style={styles.inviteCardCopy}>
                            Comparte tu código, o ingresa el suyo, para empezar a compartir este espacio.
                        </Text>

                        <Text style={styles.fieldLabel}>Tu código</Text>
                        <View style={styles.codeBox}>
                            <Text style={styles.codeText}>{userData?.invitationCode ?? '——————'}</Text>
                            <TouchableOpacity style={styles.copyPill} onPress={handleCopyCode}>
                                <Feather name="copy" size={14} color={theme.primary} />
                                <Text style={styles.copyPillText}>Copiar</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.fieldLabel}>Código de tu pareja</Text>
                        <TextField
                            value={partnerCode}
                            onChangeText={setPartnerCode}
                            placeholder="– – – – – –"
                            autoCapitalize="characters"
                            maxLength={6}
                            textAlign="center"
                        />
                        <AppButton title="Conectar" onPress={handleConnectPartner} style={{ width: '100%' }} />
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    if (user && userData && userData.partnerId) {
        const myId = user.uid;
        const partnerId = userData.partnerId;
        const sentCount = relationshipData?.missYouCounters?.[myId] || 0;
        const receivedCount = relationshipData?.missYouCounters?.[partnerId] || 0;
        
        // --- LÓGICA DE EMOJIS (FREEMIUM) ---
        // Sprint 7.3a: los 8 emojis base ya se eligen directo desde la fila
        // rápida (quickMoodRow); este modal ahora solo muestra los 22
        // adicionales premium ("ver más").
        const moodListToShow = MOODS_PREMIUM_ADDON;
        const historyDataToShow = missYouHistory; // El 'useEffect' ya ha aplicado el límite

        return (
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContainer}>

                    <Modal
                        animationType="fade"
                        transparent={true}
                        visible={isMoodSelectorVisible}
                        onRequestClose={() => setIsMoodSelectorVisible(false)}
                    >
                        <TouchableOpacity
                            style={styles.modalOverlay}
                            activeOpacity={1}
                            onPressOut={() => setIsMoodSelectorVisible(false)}
                        >
                            <TouchableOpacity style={[styles.modalContainer, {maxHeight: '40%', backgroundColor: theme.background}]} activeOpacity={1}>
                                <Text style={[styles.modalTitle, {color: theme.text, fontFamily: fontFamily}]}>Más ánimos</Text>
                                <ScrollView style={styles.emojiScrollView}>
                                    <View style={styles.emojiSelector}>
                                        {/* --- MOSTRANDO LISTA DINÁMICA DE EMOJIS --- */}
                                        {moodListToShow.map((mood) => (
                                            <TouchableOpacity
                                                key={mood.emoji}
                                                style={styles.emojiButton}
                                                onPress={() => handleSelectMood(mood)}
                                            >
                                                <Text style={styles.emojiInSelector}>{mood.emoji}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Modal>

                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={isStatusPromptVisible}
                        onRequestClose={() => setIsStatusPromptVisible(false)}
                    >
                        <View style={styles.moodSheetOverlay}>
                            <View style={styles.moodSheetContainer}>
                                <View style={styles.moodSheetHandle} />
                                <Text style={styles.moodSheetEmoji}>{selectedMood?.emoji}</Text>
                                <Text style={styles.moodSheetTitle}>{selectedMood?.name}</Text>
                                <Text style={styles.moodSheetSubcopy}>
                                    {partnerData?.displayName || 'Tu pareja'} lo verá al instante
                                </Text>
                                <TextInput
                                    style={styles.moodSheetTextarea}
                                    value={statusInput}
                                    onChangeText={setStatusInput}
                                    placeholder="Añade un breve mensaje (opcional)"
                                    placeholderTextColor={theme.placeholder}
                                    maxLength={80}
                                    multiline
                                />
                                <Text style={styles.moodSheetCounter}>{statusInput.length}/80</Text>
                                <View style={styles.moodSheetButtons}>
                                    <AppButton
                                        title="Cancelar"
                                        onPress={() => setIsStatusPromptVisible(false)}
                                        variant="outline"
                                        style={{ flex: 1 }}
                                    />
                                    <AppButton
                                        title="Guardar ánimo"
                                        onPress={handleSaveStatus}
                                        style={{ flex: 1.4 }}
                                    />
                                </View>
                            </View>
                        </View>
                    </Modal>

                    <Modal
                        animationType="slide"
                        transparent={true}
                        visible={isHistoryVisible}
                        onRequestClose={() => setIsHistoryVisible(false)}
                    >
                        <View style={styles.moodSheetOverlay}>
                            <View style={[styles.moodSheetContainer, { maxHeight: '78%' }]}>
                                <View style={styles.moodSheetHandle} />
                                <Text style={styles.moodSheetTitle}>Historial del extrañómetro</Text>
                                <View style={styles.historyTableHeader}>
                                    <Text style={[styles.historyHeaderText, { flex: 2 }]}>FECHA</Text>
                                    <Text style={[styles.historyHeaderText, { flex: 1, textAlign: 'center' }]}>RECIBIDOS</Text>
                                    <Text style={[styles.historyHeaderText, { flex: 1, textAlign: 'center' }]}>ENVIADOS</Text>
                                </View>
                                <FlatList
                                    style={styles.historyFlatList}
                                    data={historyDataToShow} // --- MOSTRANDO DATOS LIMITADOS/COMPLETOS ---
                                    keyExtractor={item => item.id}
                                    showsVerticalScrollIndicator={true}
                                    nestedScrollEnabled={true}
                                    renderItem={({ item }) => (
                                        <View style={styles.historyRow}>
                                            <Text style={[styles.historyRowText, { flex: 2 }]} numberOfLines={1}>{item.id}</Text>
                                            <Text style={[styles.historyRowText, styles.historyReceivedText, { flex: 1, textAlign: 'center' }]}>{item[partnerId] || 0}</Text>
                                            <Text style={[styles.historyRowText, { flex: 1, textAlign: 'center' }]}>{item[myId] || 0}</Text>
                                        </View>
                                    )}
                                    ListEmptyComponent={<Text style={[styles.emptyHistoryText, {fontFamily: fontFamily}]}>Aún no hay historial.</Text>}
                                    ListFooterComponent={plan === 'free' ? (
                                        <TouchableOpacity style={styles.historyPaywallRow} onPress={() => setIsHistoryPaywallVisible(true)}>
                                            <Ionicons name="lock-closed" size={16} color={theme.primary} />
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.historyPaywallTitle}>Historial completo</Text>
                                                <Text style={styles.historyPaywallSubtitle}>Free muestra los últimos 3 días</Text>
                                            </View>
                                            <Text style={styles.historyPaywallCta}>Desbloquear</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                />
                                <AppButton title="Cerrar" onPress={() => setIsHistoryVisible(false)} variant="outline" style={{ marginTop: spacing.s12 }} />
                            </View>
                        </View>
                    </Modal>

                    <PaywallSheet
                        visible={isHistoryPaywallVisible}
                        onClose={() => setIsHistoryPaywallVisible(false)}
                        onUpgradePress={() => { setIsHistoryPaywallVisible(false); router.push('/(tabs)/config'); }}
                        icon="time"
                        title="Desbloquea el historial completo"
                        description="Mira cuánto se extrañaron desde el primer día, no solo los últimos 3."
                        benefits={[
                            'Historial ilimitado del extrañómetro',
                            '22 emojis adicionales, incluida una categoría atrevida',
                            'Personalización de tema para los dos',
                        ]}
                    />

                    <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        onConfirm={handleConfirmDate}
                        onCancel={hideDatePicker}
                        maximumDate={new Date()}
                        locale="es_ES"
                    />

                    {/* Sprint 7.3a: hero de aniversario — jerarquía máxima de la pantalla. */}
                    <LinearGradient
                        colors={theme.heroGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.heroCard, { borderWidth: theme.heroBorder === 'transparent' ? 0 : 1, borderColor: theme.heroBorder }]}
                    >
                        <TouchableOpacity
                            onPress={relationshipDuration ? showDatePicker : undefined}
                            onLongPress={relationshipDuration ? () => Alert.alert(
                                "Restablecer Fecha",
                                "¿Quieren cambiar su fecha de inicio?",
                                [
                                    { text: 'Cancelar' },
                                    { text: 'OK', onPress: showDatePicker }
                                ]
                            ) : undefined}
                            disabled={!relationshipDuration}
                        >
                            {relationshipDuration ? (
                                <>
                                    <Text style={styles.heroEyebrow}>{anniversaryEyebrow}</Text>
                                    <Text style={styles.heroNumber}>{relationshipDuration}</Text>
                                </>
                            ) : (
                                <AppButton title="Elegir fecha" onPress={showDatePicker} variant="outline" style={{ borderColor: '#FFFFFF' }} />
                            )}
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Sprint 7.3a: selector rápido de ánimo — tocar un círculo abre
                        directo el modal de mensaje (ya no hay un paso intermedio). */}
                    <Text style={styles.quickMoodLabel}>¿Cómo te sientes hoy?</Text>
                    <View style={styles.quickMoodRow}>
                        {MOODS_BASE.map((mood) => {
                            const isSelected = userData.currentMood?.emoji === mood.emoji;
                            return (
                                <TouchableOpacity
                                    key={mood.emoji}
                                    style={[styles.quickMoodCircle, isSelected && styles.quickMoodCircleSelected]}
                                    onPress={() => handleSelectMood(mood)}
                                >
                                    <Text style={styles.quickMoodEmoji}>{mood.emoji}</Text>
                                </TouchableOpacity>
                            );
                        })}
                        {plan === 'premium' ? (
                            <TouchableOpacity style={styles.quickMoodMoreCircle} onPress={openMoodSelector}>
                                <Ionicons name="add" size={20} color={theme.primary} />
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={styles.quickMoodLockCircle} onPress={() => setIsMoodPaywallVisible(true)}>
                                <Ionicons name="lock-closed" size={16} color={theme.primary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Sprint 7.3a: ánimos actuales, lado a lado. */}
                    <View style={styles.currentMoodsRow}>
                        <View style={styles.currentMoodCard}>
                            <Text style={styles.currentMoodEmoji}>{userData.currentMood?.emoji || '😐'}</Text>
                            <Text style={styles.currentMoodName}>{userData.currentMood?.name || 'Tu ánimo'}</Text>
                            {!!userData.currentMood?.status && (
                                <Text style={styles.currentMoodStatus}>&quot;{userData.currentMood.status}&quot;</Text>
                            )}
                        </View>
                        <View style={styles.currentMoodCard}>
                            <Text style={styles.currentMoodEmoji}>{partnerData?.currentMood?.emoji || '😐'}</Text>
                            <Text style={styles.currentMoodName}>{partnerData?.currentMood?.name || 'Su ánimo'}</Text>
                            {!!partnerData?.currentMood?.status && (
                                <Text style={styles.currentMoodStatus}>&quot;{partnerData.currentMood.status}&quot;</Text>
                            )}
                        </View>
                    </View>

                    <PaywallSheet
                        visible={isMoodPaywallVisible}
                        onClose={() => setIsMoodPaywallVisible(false)}
                        onUpgradePress={() => { setIsMoodPaywallVisible(false); router.push('/(tabs)/config'); }}
                        icon="happy"
                        title="Desbloquea 22 emojis más"
                        description="Más formas de decir cómo te sientes, incluida una categoría atrevida."
                        benefits={[
                            '22 emojis adicionales, incluida una categoría atrevida',
                            'Historial completo del extrañómetro',
                            'Personalización de tema para los dos',
                        ]}
                    />

                    {/* Sprint 7.3b: el corazón de la tarjeta ES el botón de enviar —
                        ya no hay un botón "¡Te extraño!" aparte debajo. */}
                    <View style={styles.missYouCard}>
                        <Pressable onPress={handleSendMissYou}>
                            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                <Ionicons name="heart" size={82} color={theme.affection} />
                            </Animated.View>
                        </Pressable>
                        <View style={styles.missYouCountsRow}>
                            <View style={styles.missYouCountItem}>
                                <Text style={styles.missYouPrimaryCount}>{receivedCount}</Text>
                                <Text style={styles.missYouCountLabel}>te extrañaron hoy</Text>
                            </View>
                            <View style={styles.missYouDivider} />
                            <View style={styles.missYouCountItem}>
                                <Text style={styles.missYouSecondaryCount}>{sentCount}</Text>
                                <Text style={styles.missYouCountLabel}>extrañaste tú</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setIsHistoryVisible(true)}>
                            <Text style={styles.historyLink}>Ver historial</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
             <View style={styles.container}>
                {user ? (
                     <ActivityIndicator size="large" color={theme.primary} />
                 ) : (
                    <Text style={{color: theme.placeholder}}>Inicia sesión para continuar.</Text>
                 )}
             </View>
        </SafeAreaView>
    );
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, 
    shouldShowList: true,   
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});


export default Home;