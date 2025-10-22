import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme,
    TextInput, Button, FlatList,
    KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig'; // Verifica tu ruta
import { themes } from '../../src/config/theme'; // Verifica tu ruta
import { collection, addDoc, onSnapshot, query, orderBy, doc, DocumentData, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth'; // Aseguramos onAuthStateChanged
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

// --- Estilos ---
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    inputContainer: { padding: 10, backgroundColor: theme.inputBackground, borderRadius: 12, marginBottom: 20, borderColor: theme.borderColor, borderWidth: 1 },
    input: { color: theme.text, fontSize: 16, minHeight: 60, maxHeight: 120, textAlignVertical: 'top' },
    notesList: { flex: 1 },
    noteItemTouchable: { // Contenedor clickeable
        marginBottom: 15,
    },
    noteItem: { backgroundColor: '#FFFACD', borderRadius: 8, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
    noteText: { fontSize: 16, color: '#333' },
    noteFooter: { marginTop: 10, alignItems: 'flex-end' },
    noteAuthor: { fontSize: 12, fontStyle: 'italic', color: '#555' },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { width: '90%', backgroundColor: theme.background, borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 20 },
    modalInput: { height: 100, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, padding: 10, color: theme.text, backgroundColor: theme.inputBackground, marginBottom: 20, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
});

// Interface para la nota en edición
interface EditingNote { id: string; text: string; }

const NotesScreen: React.FC = () => {
    // --- Hooks ---
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    // --- Estados ---
    const [user, setUser] = useState<FirebaseUser | null>(null); // Usuario de Auth
    const [userData, setUserData] = useState<DocumentData | null>(null); // Perfil de Firestore del usuario
    const [notes, setNotes] = useState<DocumentData[]>([]); // Lista de notas
    const [newNote, setNewNote] = useState(''); // Texto de la nueva nota
    const [loading, setLoading] = useState(true); // Estado general de carga
    const [isEditModalVisible, setIsEditModalVisible] = useState(false); // Visibilidad del modal de edición
    const [editingNote, setEditingNote] = useState<EditingNote | null>(null); // Nota actual en edición
    const [editedText, setEditedText] = useState(''); // Texto editado en el modal

    // --- Efectos para Carga de Datos ---

    // 1. useEffect: Maneja estado de autenticación
    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser); // Actualiza el estado 'user'
            if (!currentUser) {
                // Si no hay usuario, limpiar todo y redirigir
                setUserData(null);
                setNotes([]);
                setLoading(false);
                router.replace('/(tabs)/login');
            }
            // Si hay usuario, esperamos al siguiente useEffect para cargar datos y setLoading
        });
        return () => unsubscribeAuth(); // Limpiar listener de auth
    }, [router]);

    // 2. useEffect: Carga perfil y notas una vez que 'user' está disponible
    useEffect(() => {
        if (!user) return; // Salir si no hay usuario autenticado

        // Limpiar listeners anteriores al cambiar de usuario o estado
        let unsubscribeUser: () => void = () => {};
        let unsubscribeNotes: () => void = () => {};

        setLoading(true); // Indicar inicio de carga de datos específicos del usuario
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            unsubscribeNotes(); // Limpiar listener de notas si el perfil cambia

            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                if (data.partnerId) {
                    // Si tiene pareja, configurar listener de notas
                    const chatId = [user.uid, data.partnerId].sort().join('_');
                    const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
                    const q = query(notesCollectionRef, orderBy('createdAt', 'desc'));
                    unsubscribeNotes = onSnapshot(q, (snapshot) => {
                        setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        setLoading(false); // Parar carga al tener notas (o lista vacía)
                    }, (error) => { console.error("Error fetching notes:", error); setLoading(false); });
                } else {
                    // No tiene pareja, limpiar notas y parar carga
                    setNotes([]);
                    setLoading(false);
                }
            } else {
                auth.signOut(); // Perfil no existe
                setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });

        // Limpieza al desmontar o si 'user' cambia
        return () => {
            unsubscribeUser();
            unsubscribeNotes();
        };
    }, [user]); // Depende DIRECTAMENTE del estado 'user'

    // --- Funciones de Manejo ---

    // Añadir una nueva nota
    const handleAddNote = useCallback(async () => {
        const noteText = newNote.trim();
        if (noteText === '' || !userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
        try {
            await addDoc(notesCollectionRef, { text: noteText, authorId: user.uid, authorName: userData.displayName, createdAt: serverTimestamp() });
            setNewNote('');
            Toast.show({ type: 'success', text1: 'Nota añadida' });
        } catch (error) { Toast.show({ type: 'error', text1: 'Error al guardar la nota' }); }
    }, [newNote, userData, user]);

    // Eliminar una nota (confirmación incluida)
    const handleDeleteNote = (noteId: string) => {
        Alert.alert("Confirmar Eliminación", "¿Estás seguro?",
            [ { text: "Cancelar", style: "cancel" }, {
                text: "Eliminar", style: "destructive",
                onPress: async () => {
                    if (!userData || !userData.partnerId || !user) return;
                    const chatId = [user.uid, userData.partnerId].sort().join('_');
                    const noteDocRef = doc(db, 'relationships', chatId, 'notes', noteId);
                    try { await deleteDoc(noteDocRef); Toast.show({ type: 'success', text1: 'Nota eliminada' }); }
                    catch (error) { Toast.show({ type: 'error', text1: 'Error al eliminar' }); }
                }
            }]
        );
    };

    // Abrir el modal de edición
    const openEditModal = (note: DocumentData) => {
        setEditingNote({ id: note.id, text: note.text });
        setEditedText(note.text);
        setIsEditModalVisible(true);
    };

    // Guardar los cambios de la edición
    const handleUpdateNote = async () => {
        if (!editingNote || editedText.trim() === '' || !userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const noteDocRef = doc(db, 'relationships', chatId, 'notes', editingNote.id);
        try {
            await updateDoc(noteDocRef, { text: editedText.trim() });
            setIsEditModalVisible(false); setEditingNote(null);
            Toast.show({ type: 'success', text1: 'Nota actualizada' });
        } catch (error) { Toast.show({ type: 'error', text1: 'Error al actualizar' }); }
    };

    // Función para manejar la pulsación larga en una nota
    const handleNoteLongPress = (item: DocumentData) => {
        // Verificar si el usuario actual (del estado) es el autor
        if (user?.uid === item.authorId) {
            Alert.alert( "Opciones de Nota", item.text.substring(0, 50) + (item.text.length > 50 ? '...' : ''),
                [
                    { text: "Editar", onPress: () => openEditModal(item) },
                    { text: "Eliminar", onPress: () => handleDeleteNote(item.id), style: "destructive" },
                    { text: "Cancelar", style: "cancel" },
                ],
                { cancelable: true }
            );
        }
        // Si no es el autor, no hacer nada
    };

    // --- Renderizado ---
    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }
    
    // Vista "No conectado"
    if (userData && !userData.partnerId) {
         return (
             <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                     <Text style={styles.title}>Muro de Notas</Text>
                     <Text style={styles.placeholderText}>Conéctate con tu pareja para empezar a dejar notas.</Text>
                </View>
             </SafeAreaView>
        );
    }

    // Fallback si algo falló y falta información crucial
     if (!user || !userData) {
         return <View style={styles.loadingContainer}><Text style={{color: theme.placeholder}}>Cargando...</Text></View>;
     }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.container}>
                    <Text style={styles.title}>Muro de Notas</Text>
                    {/* Input y Botón Añadir */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Escribe una nota para tu amor..."
                            placeholderTextColor={theme.placeholder}
                            value={newNote}
                            onChangeText={setNewNote}
                            multiline
                            maxLength={200}
                        />
                        <Button title="Dejar Nota" onPress={handleAddNote} color={theme.primary} disabled={newNote.trim() === ''} />
                    </View>
                    {/* Lista de Notas */}
                    <FlatList
                        style={styles.notesList}
                        data={notes}
                        keyExtractor={item => item.id}
                        // Pasamos 'user' a extraData para asegurar re-renderizado si cambia
                        extraData={user}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.noteItemTouchable}
                                onLongPress={() => handleNoteLongPress(item)} // Llama a la función de pulsación larga
                                delayLongPress={500}
                            >
                                <View style={styles.noteItem}>
                                    {/* Ya no hay botones inline aquí */}
                                    <Text style={styles.noteText}>{item.text}</Text>
                                    <View style={styles.noteFooter}>
                                        <Text style={styles.noteAuthor}>- {item.authorName}</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.placeholderText}>Aún no hay notas...</Text>}
                    />
                </View>
            </KeyboardAvoidingView>
            {/* --- Modal para Editar Nota --- */}
            <Modal animationType="fade" transparent={true} visible={isEditModalVisible} onRequestClose={() => setIsEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Editar Nota</Text>
                        <TextInput style={styles.modalInput} value={editedText} onChangeText={setEditedText} multiline maxLength={200} />
                        <View style={styles.modalButtons}>
                            <Button title="Cancelar" onPress={() => setIsEditModalVisible(false)} color="grey" />
                            <Button title="Guardar Cambios" onPress={handleUpdateNote} color={theme.primary} />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default NotesScreen;