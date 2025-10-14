import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Button, useColorScheme,
    ActivityIndicator, TextInput, TouchableOpacity,
    Alert, Modal, ScrollView, FlatList
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, DocumentData, writeBatch, onSnapshot, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const MOODS = [
    { emoji: '😊', name: 'Feliz' }, { emoji: '🥰', name: 'Amado/a' },
    { emoji: '😴', name: 'Cansado/a' }, { emoji: '😎', name: 'Genial' },
    { emoji: '😜', name: 'Juguetón/a' }, { emoji: '😢', name: 'Triste' },
    { emoji: '🤔', name: 'Pensativo/a' }, { emoji: '😐', name: 'Neutral' },
];

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
    modalContainer: { width: '90%', maxHeight: '70%', backgroundColor: theme.background, borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 20 },
    emojiScrollView: { maxHeight: 150 },
    emojiSelector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    emojiButton: { padding: 8 },
    emojiInSelector: { fontSize: 36 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: theme.primary, paddingBottom: 10, marginBottom: 5, width: '100%' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.borderColor, paddingVertical: 10, width: '100%' },
    headerText: { fontWeight: 'bold', color: theme.text },
    columnContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    columnText: { color: theme.text },
    statusInput: { height: 40, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, color: theme.text, backgroundColor: theme.inputBackground, marginBottom: 20 },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
});

const Home: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
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

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setLoading(false);
                router.replace('/login');
            }
        });
        return unsubscribeAuth;
    }, [router]);

    useEffect(() => {
        if (!user) return;

        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserData(docSnap.data());
            } else {
                signOut(auth);
            }
            setLoading(false);
        });

        return () => unsubscribeUser();
    }, [user]);
    
    useEffect(() => {
        if (!userData?.partnerId || !user?.uid) {
            setPartnerData(null);
            setRelationshipData(null);
            setMissYouHistory([]);
            return;
        };

        const relationshipId = [user.uid, userData.partnerId].sort().join('_');
        
        const unsubscribeRelationship = onSnapshot(doc(db, 'relationships', relationshipId), (relSnap) => {
            setRelationshipData(relSnap.data() || {});
        });

        const unsubscribePartner = onSnapshot(doc(db, 'users', userData.partnerId), (partnerSnap) => {
            setPartnerData(partnerSnap.data() || null);
        });

        const historyCollectionRef = collection(db, 'relationships', relationshipId, 'missYouHistory');
        const q = query(historyCollectionRef, orderBy('__name__', 'desc'));
        const unsubscribeHistory = onSnapshot(q, (querySnapshot) => {
            setMissYouHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubscribeRelationship();
            unsubscribePartner();
            unsubscribeHistory();
        };
    }, [userData, user]);

    const handleLogout = async () => { await signOut(auth); };
    
    const handleCopyCode = async () => {
        if (user?.uid) {
            await Clipboard.setStringAsync(user.uid);
            Toast.show({ type: 'success', text1: '¡Código Copiado!' });
        }
    };
    
    const handleConnectPartner = async () => {
        const code = partnerCode.trim();
        if (!code || !user) return;
        if (code === user.uid) return Toast.show({ type: 'error', text1: '¡Oops!', text2: 'No puedes conectarte contigo mismo.' });
        const partnerDocRef = doc(db, 'users', code);
        const partnerDocSnap = await getDoc(partnerDocRef);
        if (!partnerDocSnap.exists()) return Toast.show({ type: 'error', text1: 'Código Inválido' });
        if (partnerDocSnap.data().partnerId) return Toast.show({ type: 'info', text1: 'Lo sentimos', text2: 'Esa persona ya está conectada.' });
        try {
            const batch = writeBatch(db);
            const currentUserRef = doc(db, 'users', user.uid);
            batch.update(currentUserRef, { partnerId: code });
            batch.update(partnerDocRef, { partnerId: user.uid });
            await batch.commit();
            Toast.show({ type: 'success', text1: '¡Conexión Exitosa!' });
        } catch (error) { Toast.show({ type: 'error', text1: 'Error al conectar' }); }
    };

    const openMoodSelector = () => { setIsMoodSelectorVisible(true); };

    const handleSelectMood = (mood: { emoji: string, name: string }) => {
        setIsMoodSelectorVisible(false);
        setSelectedMood(mood);
        setStatusInput(userData?.currentMood?.status || '');
        setIsStatusPromptVisible(true);
    };

    const handleSaveStatus = async () => {
        if (!auth.currentUser || !selectedMood) return;
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        try {
            await updateDoc(userDocRef, {
                currentMood: { emoji: selectedMood.emoji, name: selectedMood.name, status: statusInput.trim() }
            });
        } catch (error) { console.error("Error al actualizar el estado:", error); }
        setIsStatusPromptVisible(false);
        setStatusInput('');
    };

    if (loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    if (userData && !userData.partnerId) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>¡Hola, {userData.displayName}!</Text>
                <Text style={styles.subtitle}>Para empezar, conecta con tu pareja.</Text>
                <Text style={styles.infoText}>Tu código de conexión:</Text>
                <View style={styles.codeBox}><Text style={styles.codeText}>{user?.uid}</Text><TouchableOpacity onPress={handleCopyCode}><Feather name="copy" size={24} color={theme.primary} /></TouchableOpacity></View>
                <TextInput style={styles.input} placeholder="Introduce el código de tu pareja" placeholderTextColor={theme.placeholder} value={partnerCode} onChangeText={setPartnerCode} />
                <Button title="Conectar" onPress={handleConnectPartner} color={theme.primary} />
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }
    
    if (user && userData && userData.partnerId) {
        const myId = user.uid;
        const partnerId = userData.partnerId;
        const sentCount = relationshipData?.missYouCounters?.[myId] || 0;
        const receivedCount = relationshipData?.missYouCounters?.[partnerId] || 0;
        return (
            <View style={styles.container}>
                <Modal animationType="fade" transparent={true} visible={isMoodSelectorVisible} onRequestClose={() => setIsMoodSelectorVisible(false)}><TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPressOut={() => setIsMoodSelectorVisible(false)}><TouchableOpacity style={styles.modalContainer} activeOpacity={1}><Text style={styles.modalTitle}>¿Cómo te sientes hoy?</Text><ScrollView style={styles.emojiScrollView}><View style={styles.emojiSelector}>{MOODS.map((mood) => (<TouchableOpacity key={mood.emoji} style={styles.emojiButton} onPress={() => handleSelectMood(mood)}><Text style={styles.emojiInSelector}>{mood.emoji}</Text></TouchableOpacity>))}</View></ScrollView></TouchableOpacity></TouchableOpacity></Modal>
                <Modal animationType="fade" transparent={true} visible={isStatusPromptVisible} onRequestClose={() => setIsStatusPromptVisible(false)}><View style={styles.modalOverlay}><View style={styles.modalContainer}><Text style={styles.modalTitle}>¿Te sientes {selectedMood?.name.toLowerCase()}?</Text><Text style={styles.subtitle}>Añade un breve mensaje</Text><TextInput style={styles.statusInput} value={statusInput} onChangeText={setStatusInput} placeholder="Opcional..." placeholderTextColor={theme.placeholder} maxLength={25} /><View style={styles.modalButtons}><Button title="Cancelar" onPress={() => setIsStatusPromptVisible(false)} color="grey" /><Button title="Guardar" onPress={handleSaveStatus} color={theme.primary} /></View></View></View></Modal>
                <Modal animationType="slide" transparent={true} visible={isHistoryVisible} onRequestClose={() => setIsHistoryVisible(false)}><View style={styles.modalOverlay}><View style={styles.modalContainer}><Text style={styles.modalTitle}>Historial Extrañómetro</Text><View style={styles.tableHeader}><View style={styles.columnContainer}><Text style={styles.headerText}>Fecha</Text></View><View style={styles.columnContainer}><Text style={styles.headerText}>Recibidos</Text></View><View style={styles.columnContainer}><Text style={styles.headerText}>Enviados</Text></View></View><FlatList data={missYouHistory} keyExtractor={item => item.id} renderItem={({ item }) => (<View style={styles.tableRow}><View style={styles.columnContainer}><Text style={styles.columnText}>{item.id}</Text></View><View style={styles.columnContainer}><Text style={styles.columnText}>{item[partnerId] || 0}</Text></View><View style={styles.columnContainer}><Text style={styles.columnText}>{item[myId] || 0}</Text></View></View>)} ListEmptyComponent={<Text style={{ color: theme.placeholder, marginTop: 20 }}>Aún no hay historial.</Text>} /><Button title="Cerrar" onPress={() => setIsHistoryVisible(false)} color={theme.primary} /></View></View></Modal>

                <Text style={styles.title}>Conexión Diaria</Text>
                <View style={styles.moodsRow}>
                    <TouchableOpacity style={styles.moodContainer} onPress={openMoodSelector}><Text style={styles.moodName}>{userData.currentMood?.name || 'Tu Ánimo'}</Text><View style={styles.moodCircle}><Text style={styles.moodEmoji}>{userData.currentMood?.emoji || '😐'}</Text></View><Text style={styles.moodStatus}>{userData.currentMood?.status ? `"${userData.currentMood.status}"` : ''}</Text><Text style={styles.moodDisplayName}>{userData.displayName}</Text></TouchableOpacity>
                    <View style={styles.moodContainer}><Text style={styles.moodName}>{partnerData?.currentMood?.name || 'Su Ánimo'}</Text><View style={styles.moodCircle}><Text style={styles.moodEmoji}>{partnerData?.currentMood?.emoji || '😐'}</Text></View><Text style={styles.moodStatus}>{partnerData?.currentMood?.status ? `"${partnerData.currentMood.status}"` : ''}</Text><Text style={styles.moodDisplayName}>{partnerData?.displayName || '...'}</Text></View>
                </View>
                <View style={styles.missYouContainer}><Text style={styles.subtitle}>Extrañómetro</Text><View style={styles.countersRow}><View style={styles.counterItem}><Ionicons name="heart" size={32} color={theme.primary} /><Text style={styles.receivedText}>{receivedCount}</Text></View><View style={styles.counterItem}><Ionicons name="heart-outline" size={18} color={theme.placeholder} /><Text style={styles.sentText}>{sentCount}</Text></View></View><TouchableOpacity onPress={() => setIsHistoryVisible(true)}><Text style={styles.historyLink}>Ver historial</Text></TouchableOpacity></View>
                <View style={{ flexDirection: 'row', gap: 15 }}><Link href="/(tabs)/chat" asChild><Button title="Ir al Chat" color={theme.primary} /></Link><Link href="/(tabs)/notes" asChild><Button title="Ver Notas" color={theme.primary} /></Link></View>
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }
    
    return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
};

export default Home;