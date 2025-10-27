import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Button, useColorScheme,
    ActivityIndicator, TextInput, TouchableOpacity,
    Alert, Modal, ScrollView, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, DocumentData, writeBatch, onSnapshot, updateDoc, collection, query, orderBy, Timestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale/es';

// --- Constantes ---
const MOODS = [
    { emoji: '😊', name: 'Feliz' }, { emoji: '🥰', name: 'Amado/a' },
    { emoji: '😴', name: 'Cansado/a' }, { emoji: '😎', name: 'Genial' },
    { emoji: '😜', name: 'Juguetón/a' }, { emoji: '😢', name: 'Triste' },
    { emoji: '🤔', name: 'Pensativo/a' }, { emoji: '😐', name: 'Neutral' },
];

// Función para obtener la fecha en formato YYYY-MM-DD
const getTodayDateKey = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Estilos ---
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: theme.background, gap: 15 },
    title: { fontSize: 24, fontWeight: 'bold', color: theme.text, textAlign: 'center' },
    subtitle: { fontSize: 18, color: theme.text, textAlign: 'center', marginBottom: 20 },
    codeBox: { backgroundColor: theme.inputBackground, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: theme.borderColor, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    codeText: { fontSize: 16, color: theme.primary, fontWeight: 'bold', textAlign: 'center' },
    input: { height: 50, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, fontSize: 16, color: theme.text, backgroundColor: theme.inputBackground, textAlign: 'center' },
    infoText: { fontSize: 16, color: theme.text },
    moodsRow: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 20 },
    moodContainer: { alignItems: 'center', gap: 5, width: 120 },
    moodCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.borderColor, marginBottom: 5 },
    moodEmoji: { fontSize: 40 },
    moodName: { fontSize: 14, fontWeight: 'bold', color: theme.primary },
    moodDisplayName: { fontSize: 16, fontWeight: '600', color: theme.text },
    moodStatus: { fontSize: 12, fontStyle: 'italic', color: theme.placeholder, textAlign: 'center', height: 40 },
    missYouContainer: { alignItems: 'center', marginVertical: 20, gap: 5 },
    countersRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 20 },
    counterItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    receivedText: { fontSize: 32, fontWeight: 'bold', color: theme.primary },
    sentText: { fontSize: 18, color: theme.placeholder },
    historyLink: { fontSize: 12, color: theme.link, marginTop: 10 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { 
        width: '90%', 
        height: '60%',
        backgroundColor: theme.background, 
        borderRadius: 20, 
        padding: 20
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 15, textAlign: 'center' },
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
        fontSize: 14
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
        fontSize: 13
    },
    historyContentContainer: {
        flex: 1,
        width: '100%'
    },
    historyFlatList: {
        width: '100%',
        height: 300
    },
    emptyHistoryText: {
        color: theme.placeholder,
        marginTop: 20,
        textAlign: 'center',
        fontSize: 14
    },
    statusInput: { height: 40, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, color: theme.text, backgroundColor: theme.inputBackground, marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
    relationshipCounterContainer: { alignItems: 'center', marginVertical: 15, padding: 15, backgroundColor: theme.inputBackground, borderRadius: 10, borderWidth: 1, borderColor: theme.borderColor, width: '90%' },
    counterText: { fontSize: 18, color: theme.text, textAlign: 'center', lineHeight: 24 },
    closeButtonContainer: {
        marginTop: 15,
        width: '100%'
    }
});

// --- Componente Principal ---
const Home: React.FC = () => {
    // Hooks
    const router = useRouter();
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    
    // Estados
    const [user, setUser] = useState<User | null>(auth.currentUser); 
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [relationshipData, setRelationshipData] = useState<DocumentData | null>(null);
    const [partnerData, setPartnerData] = useState<DocumentData | null>(null);
    const [missYouHistory, setMissYouHistory] = useState<DocumentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [partnerCode, setPartnerCode] = useState('');
    const [isMoodSelectorVisible, setIsMoodSelectorVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isStatusPromptVisible, setIsStatusPromptVisible] = useState(false);
    const [statusInput, setStatusInput] = useState('');
    const [selectedMood, setSelectedMood] = useState<{ emoji: string, name: string } | null>(null);
    const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
    const [relationshipDuration, setRelationshipDuration] = useState<string | null>(null);

    // --- Función para verificar y reiniciar el Extrañómetro ---
    const checkAndResetMissYouCounter = useCallback(async (relationshipId: string, currentData: DocumentData) => {
        const today = getTodayDateKey();
        const lastResetDate = currentData?.lastResetDate;

        // Si no hay fecha de reset o es diferente a hoy, necesitamos resetear
        if (!lastResetDate || lastResetDate !== today) {
            console.log('Reseteando Extrañómetro para el nuevo día:', today);
            
            try {
                const relationshipRef = doc(db, 'relationships', relationshipId);
                const currentCounters = currentData?.missYouCounters || {};
                
                // Solo guardar en historial si hay contadores con valores
                if (lastResetDate && (Object.values(currentCounters).some((val: any) => val > 0))) {
                    // Guardar el historial del día anterior
                    const historyRef = doc(db, 'relationships', relationshipId, 'missYouHistory', lastResetDate);
                    await setDoc(historyRef, currentCounters);
                    console.log('Historial guardado para:', lastResetDate, currentCounters);
                }
                
                // Resetear los contadores para hoy
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

    // --- Efectos para cargar datos ---

    useEffect(() => {
        if (!user) return;

        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                if (!data.partnerId) {
                    setLoading(false);
                }
            } else {
                signOut(auth);
                setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); signOut(auth); setLoading(false); });
        
        return () => unsubscribeUser();
    }, [user]);

    // Efecto para cargar datos de Pareja y Relación con reset automático
    useEffect(() => {
        if (!user || !userData || !userData.partnerId) {
            setPartnerData(null); setRelationshipData(null); setMissYouHistory([]);
            if (userData !== null && !userData.partnerId) setLoading(false);
            return;
        }

        const relationshipId = [user.uid, userData.partnerId].sort().join('_');

        // Listener para la relación
        const unsubscribeRelationship = onSnapshot(doc(db, 'relationships', relationshipId), async (relSnap) => {
            const data = relSnap.data() || {};
            setRelationshipData(data);
            
            // Verificar y resetear si es necesario
            await checkAndResetMissYouCounter(relationshipId, data);
        });

        // Listener para el perfil de la pareja
        const unsubscribePartner = onSnapshot(doc(db, 'users', userData.partnerId), (partnerSnap) => {
            setPartnerData(partnerSnap.data() || null);
        });

        // Listener para el historial
        const historyCollectionRef = collection(db, 'relationships', relationshipId, 'missYouHistory');
        const q = query(historyCollectionRef, orderBy('__name__', 'desc'));
        const unsubscribeHistory = onSnapshot(q, (querySnapshot) => {
            setMissYouHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => { console.error("Error history listener:", error); setLoading(false); });

        return () => { unsubscribeRelationship(); unsubscribePartner(); unsubscribeHistory(); };
    }, [user, userData, checkAndResetMissYouCounter]);

    // Efecto para verificar reset cada minuto (detecta cambio de día)
    useEffect(() => {
        if (!user || !userData || !userData.partnerId || !relationshipData) return;

        const relationshipId = [user.uid, userData.partnerId].sort().join('_');
        
        // Verificar cada minuto si cambió el día
        const intervalId = setInterval(() => {
            checkAndResetMissYouCounter(relationshipId, relationshipData);
        }, 60000); // Cada 60 segundos

        return () => clearInterval(intervalId);
    }, [user, userData, relationshipData, checkAndResetMissYouCounter]);

    // Efecto 4: Calcular Duración de la Relación
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

    const handleLogout = useCallback(async () => {
        try {
            const user = auth.currentUser;
        if (user) {
            await setDoc(doc(db, 'users', user.uid), {
                isOnline: false,
                lastSeen: new Date(),
            }, { merge: true });
        }
            await signOut(auth);
            // Redirigir al landing después del logout
            router.replace('/');
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
            Toast.show({ type: 'error', text1: 'Error al cerrar sesión' });
        }
    }, [router]);

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

    // --- Renderizado ---

    if (loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    // Renderizado si NO está conectado con pareja
    if (userData && !userData.partnerId) {
        return (
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
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }
    
    // Renderizado si SÍ está conectado con pareja
    if (user && userData && userData.partnerId) {
        const myId = user.uid;
        const partnerId = userData.partnerId;
        const sentCount = relationshipData?.missYouCounters?.[myId] || 0;
        const receivedCount = relationshipData?.missYouCounters?.[partnerId] || 0;
        
        return (
            <View style={styles.container}>
                {/* Modal Selector de Ánimo */}
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
                        <TouchableOpacity style={styles.modalContainer} activeOpacity={1}>
                            <Text style={styles.modalTitle}>¿Cómo te sientes hoy?</Text>
                            <ScrollView style={styles.emojiScrollView}>
                                <View style={styles.emojiSelector}>
                                    {MOODS.map((mood) => (
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

                {/* Modal Prompt de Estado */}
                <Modal 
                    animationType="fade" 
                    transparent={true} 
                    visible={isStatusPromptVisible} 
                    onRequestClose={() => setIsStatusPromptVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>
                                ¿Te sientes {selectedMood?.name.toLowerCase()}?
                            </Text>
                            <Text style={styles.subtitle}>Añade un breve mensaje</Text>
                            <TextInput 
                                style={styles.statusInput} 
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

                {/* Modal Historial Extrañómetro */}
                <Modal 
                    animationType="slide" 
                    transparent={true} 
                    visible={isHistoryVisible} 
                    onRequestClose={() => setIsHistoryVisible(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>Historial Extrañómetro</Text>
                            
                            <View style={styles.historyContentContainer}>
                                {/* Header de la tabla */}
                                <View style={styles.tableHeader}>
                                    <View style={styles.dateColumn}>
                                        <Text style={styles.headerText}>Fecha</Text>
                                    </View>
                                    <View style={styles.numberColumn}>
                                        <Text style={styles.headerText}>Recibidos</Text>
                                    </View>
                                    <View style={styles.numberColumn}>
                                        <Text style={styles.headerText}>Enviados</Text>
                                    </View>
                                </View>

                                {/* FlatList con altura fija para iOS */}
                                <FlatList
                                    style={styles.historyFlatList}
                                    data={missYouHistory}
                                    keyExtractor={item => item.id}
                                    showsVerticalScrollIndicator={true}
                                    nestedScrollEnabled={true}
                                    renderItem={({ item }) => (
                                        <View style={styles.tableRow}>
                                            <View style={styles.dateColumn}>
                                                <Text style={styles.columnText} numberOfLines={1}>
                                                    {item.id}
                                                </Text>
                                            </View>
                                            <View style={styles.numberColumn}>
                                                <Text style={styles.columnText}>
                                                    {item[partnerId] || 0}
                                                </Text>
                                            </View>
                                            <View style={styles.numberColumn}>
                                                <Text style={styles.columnText}>
                                                    {item[myId] || 0}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    ListEmptyComponent={
                                        <Text style={styles.emptyHistoryText}>
                                            Aún no hay historial.
                                        </Text>
                                    }
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

                {/* DatePicker */}
                <DateTimePickerModal
                    isVisible={isDatePickerVisible}
                    mode="date"
                    onConfirm={handleConfirmDate}
                    onCancel={hideDatePicker}
                    maximumDate={new Date()}
                    locale="es_ES"
                />

                {/* Contenido Principal */}
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

                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }
    
    // Fallback final
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color={theme.primary} />
        </View>
    );
};

export default Home;