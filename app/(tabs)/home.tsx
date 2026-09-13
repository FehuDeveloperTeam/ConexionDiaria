import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Button,
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
    title: { fontSize: 24, fontWeight: 'bold', color: theme.text, textAlign: 'center', fontFamily: fontFamily },
    subtitle: { fontSize: 18, color: theme.text, textAlign: 'center', marginBottom: 20, fontFamily: fontFamily },
    codeBox: { backgroundColor: theme.inputBackground, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    codeText: { fontSize: 16, color: theme.primary, fontWeight: 'bold', textAlign: 'center' },
    // A-02: aviso de correo sin verificar (bloquea el emparejamiento en el
    // servidor, ver functions/src/pairing.ts). Colores fijos de advertencia,
    // no del tema, para que se distinga del resto de la pantalla en claro y oscuro.
    verifyBanner: { backgroundColor: 'rgba(255, 193, 7, 0.15)', borderColor: '#FFC107', borderWidth: 1, borderRadius: 8, padding: 12, width: '100%', gap: 8 },
    verifyBannerText: { color: theme.text, fontSize: 14, fontFamily: fontFamily },
    verifyBannerActions: { flexDirection: 'row', justifyContent: 'space-between' },
    verifyBannerLink: { color: theme.primary, fontWeight: 'bold', fontSize: 13, fontFamily: fontFamily },
    input: { height: 50, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, color: theme.text, backgroundColor: theme.inputBackground, textAlign: 'center' },
    infoText: { fontSize: 16, color: theme.text, fontFamily: fontFamily },

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

    missYouContainer: { alignItems: 'center', marginVertical: 20, gap: 5 },
    countersRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 20 },
    counterItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    receivedText: { fontSize: 32, fontWeight: 'bold', color: theme.primary, fontFamily: fontFamily },
    sentText: { fontSize: 18, color: theme.placeholder, fontFamily: fontFamily },
    historyLink: { fontSize: 12, color: theme.link, marginTop: 10, fontFamily: fontFamily },
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
    tableHeader: {
        flexDirection: 'row',
        borderBottomWidth: 2,
        borderBottomColor: theme.primary,
        paddingBottom: 10,
        marginBottom: 10,
        width: '100%'
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: theme.borderColor,
        paddingVertical: 12,
        width: '100%',
        alignItems: 'center'
    },
    headerText: {
        fontWeight: 'bold',
        color: theme.text,
        textAlign: 'center',
        fontSize: 14,
        fontFamily: fontFamily
    },
    dateColumn: {
        flex: 2,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5
    },
    numberColumn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    columnText: {
        color: theme.text,
        textAlign: 'center',
        fontSize: 13,
        fontFamily: fontFamily
    },
    historyContentContainer: {
        flexShrink: 1,
        width: '100%'
    },
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
    closeButtonContainer: {
        marginTop: 15,
        width: '100%'
    },
    missYouButtonContainer: {
        marginTop: 15,
        marginBottom: 10,
        alignItems: 'center',
    },
    missYouButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    missYouButtonText: {
        color: theme.primary,
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
    }
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

    const pulseHeart = () => {
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.3, duration: 200, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1.0, duration: 200, useNativeDriver: true })
        ]).start();
    };

    const handleSendMissYou = useCallback(async () => {
        if (!userData || !userData.partnerId || !user) return;
        pulseHeart();
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
                <View style={styles.container}>
                    <Text style={styles.title}>¡Hola, {userData.displayName}!</Text>
                    <Text style={styles.subtitle}>Para empezar, conecta con tu pareja.</Text>

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

                    <Text style={styles.infoText}>Tu código de conexión:</Text>
                    <View style={styles.codeBox}>
                        <Text style={styles.codeText}>{userData?.invitationCode ?? '——————'}</Text>
                        <TouchableOpacity onPress={handleCopyCode}>
                            <Feather name="copy" size={24} color={theme.primary} />
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder="Introduce el código de tu pareja"
                        placeholderTextColor={theme.placeholder}
                        value={partnerCode}
                        onChangeText={setPartnerCode}
                        autoCapitalize="characters"
                        maxLength={6}
                    />
                    <Button title="Conectar" onPress={handleConnectPartner} color={theme.primary} />
                </View>
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
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContainer, {backgroundColor: theme.background}]}>
                                <Text style={[styles.modalTitle, {color: theme.text, fontFamily: fontFamily}]}>Historial Extrañómetro</Text>
                                <View style={styles.historyContentContainer}>
                                    <View style={styles.tableHeader}>
                                        <View style={styles.dateColumn}><Text style={[styles.headerText, {color: theme.text, fontFamily: fontFamily}]}>Fecha</Text></View>
                                        <View style={styles.numberColumn}><Text style={[styles.headerText, {color: theme.text, fontFamily: fontFamily}]}>Recibidos</Text></View>
                                        <View style={styles.numberColumn}><Text style={[styles.headerText, {color: theme.text, fontFamily: fontFamily}]}>Enviados</Text></View>
                                    </View>
                                    <FlatList
                                        style={styles.historyFlatList}
                                        data={historyDataToShow} // --- MOSTRANDO DATOS LIMITADOS/COMPLETOS ---
                                        keyExtractor={item => item.id}
                                        showsVerticalScrollIndicator={true}
                                        nestedScrollEnabled={true}
                                        renderItem={({ item }) => (
                                            <View style={[styles.tableRow, {borderBottomColor: theme.borderColor}]}>
                                                <View style={styles.dateColumn}><Text style={[styles.columnText, {color: theme.text, fontFamily: fontFamily}]} numberOfLines={1}>{item.id}</Text></View>
                                                <View style={styles.numberColumn}><Text style={[styles.columnText, {color: theme.text, fontFamily: fontFamily}]}>{item[partnerId] || 0}</Text></View>
                                                <View style={styles.numberColumn}><Text style={[styles.columnText, {color: theme.text, fontFamily: fontFamily}]}>{item[myId] || 0}</Text></View>
                                            </View>
                                        )}
                                        ListEmptyComponent={<Text style={[styles.emptyHistoryText, {fontFamily: fontFamily}]}>Aún no hay historial.</Text>}
                                        ListFooterComponent={plan === 'free' ? ( // --- PAYWALL EN EL HISTORIAL ---
                                            <TouchableOpacity onPress={() => router.push('/(tabs)/config')} style={{padding: 15, alignItems: 'center'}}>
                                                <Ionicons name="lock-closed" size={16} color={theme.primary} />
                                                <Text style={{color: theme.primary, fontFamily: fontFamily, textAlign: 'center', marginTop: 5}}>
                                                    Actualiza a Premium para ver el historial completo.
                                                </Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    />
                                </View>
                                <View style={styles.closeButtonContainer}>
                                    <Button
                                        title="Cerrar"
                                        onPress={() => setIsHistoryVisible(false)}
                                        color={theme.primary}
                                    />
                                </View>
                            </View>
                        </View>
                    </Modal>

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

                    <View style={styles.missYouContainer}>
                        <Text style={styles.subtitle}>Extrañómetro</Text>
                        <View style={styles.countersRow}>
                            <View style={styles.counterItem}>
                                <Ionicons name="heart" size={32} color={theme.primary} />
                                <Text style={styles.receivedText}>{receivedCount}</Text>
                            </View>
                            <View style={styles.counterItem}>
                                <Ionicons name="heart-outline" size={18} color={theme.placeholder} />
                                <Text style={styles.sentText}>{sentCount}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setIsHistoryVisible(true)}>
                            <Text style={styles.historyLink}>Ver historial</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.missYouButtonContainer}>
                        <Pressable onPress={handleSendMissYou}>
                            <Animated.View style={[
                                styles.missYouButton,
                                { transform: [{ scale: pulseAnim }] }
                            ]}>
                                <Ionicons name="heart" size={40} color={theme.white} />
                            </Animated.View>
                        </Pressable>
                        <Text style={styles.missYouButtonText}>¡Te extraño!</Text>
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