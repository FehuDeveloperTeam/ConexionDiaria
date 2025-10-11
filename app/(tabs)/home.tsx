import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, Button, useColorScheme, 
    ActivityIndicator, TextInput, TouchableOpacity, 
    Alert, Modal, ScrollView 
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, DocumentData, writeBatch, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import * as Clipboard from 'expo-clipboard';
import { Feather, Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

// Lista universal de estados de ánimo
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
    missYouContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.inputBackground, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 50, borderWidth: 1, borderColor: theme.borderColor, gap: 10, marginVertical: 20 },
    missYouText: { fontSize: 20, fontWeight: 'bold', color: theme.primary },
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
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { width: '80%', backgroundColor: theme.background, borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 20 },
    emojiScrollView: { maxHeight: 150 },
    emojiSelector: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
    emojiButton: { padding: 8 },
    emojiInSelector: { fontSize: 36 },
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
    const [loading, setLoading] = useState(true);
    const [partnerCode, setPartnerCode] = useState('');
    const [isMoodSelectorVisible, setIsMoodSelectorVisible] = useState(false);

    // --- LÓGICA DE LISTENERS CORREGIDA Y OPTIMIZADA ---
    useEffect(() => {
        // Listener principal para el estado de autenticación
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser); // Actualizamos el usuario de Auth
            if (!currentUser) {
                // Si no hay usuario, limpiamos todo y paramos de cargar
                setLoading(false);
            }
        });
        return unsubscribeAuth; // Limpiamos al salir
    }, []);

    useEffect(() => {
        // Si no hay usuario, no hacemos nada más
        if (!user) {
            // Si el estado de no-usuario ya se confirmó, redirigimos
            if (!loading) router.replace('/login');
            return;
        }

        // Si hay usuario, escuchamos su perfil en Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                // Si el usuario tiene pareja, iniciamos los otros listeners
                let unsubscribeRelationship: () => void = () => {};
                let unsubscribePartner: () => void = () => {};

                if (data.partnerId) {
                    const relationshipId = [user.uid, data.partnerId].sort().join('_');
                    const relationshipDocRef = doc(db, 'relationships', relationshipId);
                    unsubscribeRelationship = onSnapshot(relationshipDocRef, (relSnap) => {
                        setRelationshipData(relSnap.data() || { missYouCount: 0 });
                    });

                    const partnerDocRef = doc(db, 'users', data.partnerId);
                    unsubscribePartner = onSnapshot(partnerDocRef, (partnerSnap) => {
                        setPartnerData(partnerSnap.data() || null);
                    });
                } else {
                    // Si no tiene pareja, limpiamos los datos
                    setPartnerData(null);
                    setRelationshipData(null);
                }
                
                // ¡CORRECCIÓN CLAVE! Paramos de cargar solo después de tener el perfil del usuario
                setLoading(false);

                // Devolvemos la función que limpia los listeners de la pareja
                return () => {
                    unsubscribeRelationship();
                    unsubscribePartner();
                };
            } else {
                signOut(auth); // El perfil no existe, deslogueamos
            }
        });

        return () => unsubscribeUser(); // Limpia el listener del usuario
    }, [user, loading]); // Este efecto reacciona al usuario de Auth

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
        } catch (error) {
            Toast.show({ type: 'error', text1: 'Error al conectar' });
        }
    };

    const openMoodSelector = () => { setIsMoodSelectorVisible(true); };

    const handleSelectMood = (selectedMood: { emoji: string, name: string }) => {
        setIsMoodSelectorVisible(false);
        Alert.prompt(
            `¿Te sientes ${selectedMood.name.toLowerCase()}?`, 'Añade un breve mensaje (opcional)',
            [{ text: 'Cancelar' }, {
                text: 'Guardar',
                onPress: async (status: string | undefined) => {
                    const userDocRef = doc(db, 'users', auth.currentUser!.uid);
                    await updateDoc(userDocRef, {
                        currentMood: { emoji: selectedMood.emoji, name: selectedMood.name, status: status || '' }
                    });
                },
            }], 'plain-text', userData?.currentMood?.status || ''
        );
    };

    if (loading) {
        return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    if (userData && userData.partnerId) {
        return (
            <View style={styles.container}>
                <Modal animationType="fade" transparent={true} visible={isMoodSelectorVisible} onRequestClose={() => setIsMoodSelectorVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContainer}>
                            <Text style={styles.modalTitle}>¿Cómo te sientes hoy?</Text>
                            <ScrollView style={styles.emojiScrollView}>
                                <View style={styles.emojiSelector}>
                                    {MOODS.map((mood) => (
                                        <TouchableOpacity key={mood.emoji} style={styles.emojiButton} onPress={() => handleSelectMood(mood)}>
                                            <Text style={styles.emojiInSelector}>{mood.emoji}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
                <Text style={styles.title}>Conexión Diaria</Text>
                <View style={styles.moodsRow}>
                    <TouchableOpacity style={styles.moodContainer} onPress={openMoodSelector}>
                        <Text style={styles.moodName}>{userData.currentMood?.name || 'Tu Ánimo'}</Text>
                        <View style={styles.moodCircle}><Text style={styles.moodEmoji}>{userData.currentMood?.emoji || '😐'}</Text></View>
                        <Text style={styles.moodStatus}>{userData.currentMood?.status ? `"${userData.currentMood.status}"` : ''}</Text>
                        <Text style={styles.moodDisplayName}>{userData.displayName}</Text>
                    </TouchableOpacity>
                    <View style={styles.moodContainer}>
                        <Text style={styles.moodName}>{partnerData?.currentMood?.name || 'Su Ánimo'}</Text>
                        <View style={styles.moodCircle}><Text style={styles.moodEmoji}>{partnerData?.currentMood?.emoji || '😐'}</Text></View>
                        <Text style={styles.moodStatus}>{partnerData?.currentMood?.status ? `"${partnerData.currentMood.status}"` : ''}</Text>
                        <Text style={styles.moodDisplayName}>{partnerData?.displayName || '...'}</Text>
                    </View>
                </View>
                <View style={styles.missYouContainer}>
                    <Ionicons name="heart" size={24} color={theme.primary} />
                    <Text style={styles.missYouText}>{relationshipData?.missYouCount || 0}</Text>
                </View>
                <Link href="/chat" asChild><Button title="Ir al Chat" color={theme.primary} /></Link>
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }

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
                <TextInput style={styles.input} placeholder="Introduce el código de tu pareja" placeholderTextColor={theme.placeholder} value={partnerCode} onChangeText={setPartnerCode} />
                <Button title="Conectar" onPress={handleConnectPartner} color={theme.primary} />
                <Button title="Cerrar Sesión" onPress={handleLogout} color="grey" />
            </View>
        );
    }
    
    return <View style={styles.container}><ActivityIndicator size="large" color={theme.primary} /></View>;
};

export default Home;