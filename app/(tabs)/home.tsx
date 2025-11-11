import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, Button, useColorScheme,
    ActivityIndicator, TextInput, TouchableOpacity,
    Alert, // Keep Alert import
    Modal, ScrollView, FlatList,
    Animated,
    Pressable,
    Platform // <- Add Platform import
} from 'react-native';
import { useRouter } from 'expo-router';
// import { onAuthStateChanged, User } from 'firebase/auth'; // <--- Ya no es necesario
import {
    doc, getDoc, DocumentData, writeBatch, onSnapshot,
    updateDoc, collection, query, orderBy, Timestamp, setDoc,
    increment,
    limit // --- AÑADIDO: Importamos 'limit' para el paywall ---
} from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme'; // Importamos la definición base de 'themes'
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale/es';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications'; 

// --- Hooks de Contexto ---
import { usePlan } from '../../src/contexts/planContext'; 
import { useTheme } from '../../src/contexts/themeContext';

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

const MOODS_PREMIUM_FULL = [...MOODS_BASE, ...MOODS_PREMIUM_ADDON];

const getTodayDateKey = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

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
    input: { height: 50, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, color: theme.text, backgroundColor: theme.inputBackground, textAlign: 'center' },
    infoText: { fontSize: 16, color: theme.text, fontFamily: fontFamily },
    moodsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 20 },
    moodContainer: { alignItems: 'center', gap: 5, width: 120 },
    moodCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.borderColor, marginBottom: 5 },
    moodEmoji: { fontSize: 40 },
    moodName: { fontSize: 14, fontWeight: 'bold', color: theme.primary, fontFamily: fontFamily },
    moodDisplayName: { fontSize: 16, fontWeight: '600', color: theme.text, fontFamily: fontFamily },
    moodStatus: { fontSize: 12, fontStyle: 'italic', color: theme.placeholder, textAlign: 'center', height: 40, fontFamily: fontFamily },
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
    statusInput: { height: 40, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, color: theme.text, backgroundColor: theme.inputBackground, marginBottom: 20, fontFamily: fontFamily },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
    relationshipCounterContainer: { 
        alignItems: 'center', 
        marginVertical: 15, 
        padding: 15, 
        backgroundColor: theme.inputBackground, 
        width: '90%',
        ...borderStyle 
    },
    counterText: { fontSize: 18, color: theme.text, textAlign: 'center', lineHeight: 24, fontFamily: fontFamily },
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
    const pulseAnim = useRef(new Animated.Value(1)).current;

    // Función para solicitar permisos
    const requestNotificationPermissions = async () => {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Permiso Denegado',
                'Para recibir recordatorios de eventos, necesitas habilitar las notificaciones en los ajustes de tu teléfono.',
                [{ text: 'Entendido' }]
            );
            return false;
        }
        if (Platform.OS === 'android') {
             await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }
        return true;
    };

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
    useEffect(() => {
        if (!user || !userData || !userData.partnerId) {
            setMissYouHistory([]);
            return;
        }
        const relationshipId = [user.uid, userData.partnerId].sort().join('_');
        const historyCollectionRef = collection(db, 'relationships', relationshipId, 'missYouHistory');
        
        // --- LÓGICA DE LÍMITE FREEMIUM ---
        let q;
        if (plan === 'premium') {
            // Premium: Carga todo el historial
            q = query(historyCollectionRef, orderBy('__name__', 'desc'));
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
    }, [user, userData, plan]); // <-- Añadido 'plan' a las dependencias

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
             let durationString = "Juntos por ";
             if (years > 0) durationString += `${years} ${years === 1 ? 'año' : 'años'}${months > 0 || days > 0 ? ', ' : ''}`;
             if (months > 0) durationString += `${months} ${months === 1 ? 'mes' : 'meses'}${days > 0 ? ' y ' : ''}`;
             if (days > 0) durationString += `${days} ${days === 1 ? 'día' : 'días'}`;
             if (years === 0 && months === 0 && days === 0) durationString = "¡Empezaron hoy!";
            setRelationshipDuration(durationString);
        } else {
            setRelationshipDuration(null);
        }
    }, [userData?.relationshipStartDate]);

    // --- Funciones de Manejo de Eventos ---
    const handleCopyCode = useCallback(async () => {
        if (user?.uid) {
            await Clipboard.setStringAsync(user.uid);
            Toast.show({ type: 'success', text1: '¡Código Copiado!' });
        }
    }, [user]);

    const handleConnectPartner = useCallback(async () => {
        const code = partnerCode.trim();
        if (!code || !user) return;
        if (code === user.uid) return Toast.show({ type: 'error', text1: '¡Oops!', text2: 'No puedes conectarte contigo mismo.' });
        const partnerDocRef = doc(db, 'users', code);
        try {
            const partnerDocSnap = await getDoc(partnerDocRef);
            if (!partnerDocSnap.exists()) return Toast.show({ type: 'error', text1: 'Código Inválido' });
            if (partnerDocSnap.data().partnerId) return Toast.show({ type: 'info', text1: 'Lo sentimos', text2: 'Esa persona ya está conectada.' });

            const batch = writeBatch(db);
            const currentUserRef = doc(db, 'users', user.uid);
            batch.update(currentUserRef, { partnerId: code });
            batch.update(partnerDocRef, { partnerId: user.uid });

            await batch.commit();

            setPartnerCode('');
            Toast.show({ type: 'success', text1: '¡Conexión Exitosa!' });

            await requestNotificationPermissions();

        } catch (error) { Toast.show({ type: 'error', text1: 'Error al conectar' }); console.error(error); }
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
        } catch (error) { Toast.show({ type: 'error', text1: 'Error al guardar la fecha' }); }
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
        try {
            const batch = writeBatch(db);
            batch.set(relationshipDocRef, {
                missYouCounters: { [currentUserUid]: increment(1) },
                lastResetDate: today
            }, { merge: true });
            batch.set(historyDocRef, { [currentUserUid]: increment(1) }, { merge: true });
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
                    <Text style={styles.infoText}>Tu código de conexión:</Text>
                    <View style={styles.codeBox}>
                        <Text style={styles.codeText}>{user?.uid}</Text>
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
                        autoCapitalize="none"
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
        const moodListToShow = plan === 'premium' ? MOODS_PREMIUM_FULL : MOODS_BASE;
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
                                <Text style={[styles.modalTitle, {color: theme.text, fontFamily: fontFamily}]}>¿Cómo te sientes hoy?</Text>
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
                        animationType="fade"
                        transparent={true}
                        visible={isStatusPromptVisible}
                        onRequestClose={() => setIsStatusPromptVisible(false)}
                    >
                        <View style={styles.modalOverlay}>
                            <View style={[styles.modalContainer, {height: 'auto', maxHeight: '50%', backgroundColor: theme.background}]}>
                                <Text style={[styles.modalTitle, {color: theme.text, fontFamily: fontFamily}]}>
                                    ¿Te sientes {selectedMood?.name.toLowerCase()}?
                                </Text>
                                <Text style={[styles.subtitle, {color: theme.text, fontFamily: fontFamily}]}>Añade un breve mensaje</Text>
                                <TextInput
                                    style={[styles.statusInput, {color: theme.text, backgroundColor: theme.inputBackground, borderColor: theme.borderColor, fontFamily: fontFamily}]}
                                    value={statusInput}
                                    onChangeText={setStatusInput}
                                    placeholder="Opcional..."
                                    placeholderTextColor={theme.placeholder}
                                    maxLength={25}
                                />
                                <View style={styles.modalButtons}>
                                    <Button
                                        title="Cancelar"
                                        onPress={() => setIsStatusPromptVisible(false)}
                                        color="grey"
                                    />
                                    <Button
                                        title="Guardar"
                                        onPress={handleSaveStatus}
                                        color={theme.primary}
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

                    <Text style={styles.title}>Conexión Diaria</Text>

                    {relationshipDuration ? (
                        <TouchableOpacity
                            style={styles.relationshipCounterContainer}
                            onPress={showDatePicker}
                            onLongPress={() => Alert.alert(
                                "Restablecer Fecha",
                                "¿Quieren cambiar su fecha de inicio?",
                                [
                                    { text: 'Cancelar' },
                                    { text: 'OK', onPress: showDatePicker }
                                ]
                            )}
                        >
                            <Text style={styles.counterText}>{relationshipDuration}</Text>
                        </TouchableOpacity>
                    ) : (
                        <Button
                            title="Establecer Fecha de Inicio"
                            onPress={showDatePicker}
                            color={theme.primary}
                        />
                    )}

                    <View style={styles.moodsRow}>
                        <TouchableOpacity style={styles.moodContainer} onPress={openMoodSelector}>
                            <Text style={styles.moodName}>
                                {userData.currentMood?.name || 'Tu Ánimo'}
                            </Text>
                            <View style={styles.moodCircle}>
                                <Text style={styles.moodEmoji}>
                                    {userData.currentMood?.emoji || '😐'}
                                </Text>
                            </View>
                            <Text style={styles.moodStatus}>
                                {userData.currentMood?.status ? `"${userData.currentMood.status}"` : ''}
                            </Text>
                            <Text style={styles.moodDisplayName}>{userData.displayName}</Text>
                        </TouchableOpacity>

                        <View style={styles.moodContainer}>
                            <Text style={styles.moodName}>
                                {partnerData?.currentMood?.name || 'Su Ánimo'}
                            </Text>
                            <View style={styles.moodCircle}>
                                <Text style={styles.moodEmoji}>
                                    {partnerData?.currentMood?.emoji || '😐'}
                                </Text>
                            </View>
                            <Text style={styles.moodStatus}>
                                {partnerData?.currentMood?.status ? `"${partnerData.currentMood.status}"` : ''}
                            </Text>
                            <Text style={styles.moodDisplayName}>
                                {partnerData?.displayName || '...'}
                            </Text>
                        </View>
                    </View>

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