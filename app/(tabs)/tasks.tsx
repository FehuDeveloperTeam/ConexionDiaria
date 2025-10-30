import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme,
    TextInput, Button, FlatList,
    KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity,
    Modal, // 1. Añadimos Modal
    Alert  // 2. Añadimos Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { 
    collection, addDoc, onSnapshot, query, orderBy, doc, 
    DocumentData, serverTimestamp, updateDoc, deleteDoc // 3. Añadimos deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { usePlan } from '../../src/contexts/planContext';

// --- Estilos (Añadimos estilos para el modal y detalles de la tarea) ---
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    inputContainer: { 
        padding: 10, 
        backgroundColor: theme.inputBackground, 
        borderRadius: 12, 
        marginBottom: 20, 
        borderColor: theme.borderColor, 
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: { 
        flex: 1, 
        color: theme.text, 
        fontSize: 16, 
        paddingVertical: 10,
    },
    listContainer: { flex: 1 },
    
    // --- Estilos de Tarea Mejorados ---
    taskItemTouchable: { // Contenedor para onLongPress
        marginBottom: 10,
    },
    taskItem: {
        backgroundColor: theme.inputBackground,
        borderRadius: 8,
        padding: 15,
        borderColor: theme.borderColor,
        borderWidth: 1,
    },
    taskMainRow: { // Fila para el checkbox y el texto
        flexDirection: 'row',
        alignItems: 'center',
    },
    taskTextContainer: {
        flex: 1, // Para que el texto ocupe el espacio
        marginLeft: 15,
    },
    taskText: {
        fontSize: 16,
        color: theme.text,
    },
    taskTextCompleted: {
        fontSize: 16,
        color: theme.placeholder,
        textDecorationLine: 'line-through',
    },
    taskMeta: { // Texto de metadatos (quién y cuándo)
        fontSize: 12,
        color: theme.placeholder,
        fontStyle: 'italic',
        marginTop: 8,
        marginLeft: 39, // Alineado con el inicio del texto (24 + 15)
    },
    // --- Fin Estilos de Tarea Mejorados ---

    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    
    // --- Estilos de Modal (Inspirados en notes.tsx) ---
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { width: '90%', backgroundColor: theme.background, borderRadius: 20, padding: 20, alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 20 },
    modalInput: { height: 60, width: '100%', borderColor: theme.borderColor, borderWidth: 1, borderRadius: 8, padding: 10, color: theme.text, backgroundColor: theme.inputBackground, marginBottom: 20, textAlignVertical: 'top' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
});

// Interface para la tarea en edición
interface EditingTask { id: string; text: string; authorId: string; }

const TasksScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [tasks, setTasks] = useState<DocumentData[]>([]);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(true);

    // --- 4. Estados para el Modal de Edición ---
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
    const [editedText, setEditedText] = useState('');

    // (useEffect de Autenticación y Carga de Perfil/Tareas no cambia, sigue siendo perfecto)
    // 1. useEffect: Maneja estado de autenticación
    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null); setTasks([]); setLoading(false);
                router.replace('/login');
            }
        });
        return () => unsubscribeAuth();
    }, [router]);

    // 2. useEffect: Carga perfil y tareas
    useEffect(() => {
        if (!user) return; 

        let unsubscribeUser: () => void = () => {};
        let unsubscribeTasks: () => void = () => {};

        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            unsubscribeTasks(); 

            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                if (data.partnerId) {
                    const chatId = [user.uid, data.partnerId].sort().join('_');
                    const tasksCollectionRef = collection(db, 'relationships', chatId, 'tasks');
                    const q = query(tasksCollectionRef, orderBy('isCompleted', 'asc'), orderBy('createdAt', 'desc'));
                    
                    unsubscribeTasks = onSnapshot(q, (snapshot) => {
                        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        setLoading(false);
                    }, (error) => { console.error("Error fetching tasks:", error); setLoading(false); });
                } else {
                    setTasks([]); setLoading(false); 
                }
            } else {
                auth.signOut(); setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });

        return () => { unsubscribeUser(); unsubscribeTasks(); };
    }, [user]);

    // 3. Función para añadir una nueva tarea (Añadimos más metadatos)
    const handleAddTask = useCallback(async () => {
        const taskText = newTask.trim();
        if (taskText === '' || !userData || !userData.partnerId || !user) return;
        
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const tasksCollectionRef = collection(db, 'relationships', chatId, 'tasks');
        
        try {
            await addDoc(tasksCollectionRef, {
                text: taskText,
                isCompleted: false,
                authorId: user.uid,
                authorName: userData.displayName,
                createdAt: serverTimestamp(),
                completedBy: null, // Quién la completó
                completedByName: null,
                completedAt: null, // Cuándo se completó
            });
            setNewTask(''); 
            Toast.show({ type: 'success', text1: 'Tarea añadida' });
        } catch (error) {
            console.error("Error al añadir la tarea:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar la tarea' });
        }
    }, [newTask, userData, user]);

    // 4. Función para marcar/desmarcar (¡Ahora guarda quién y cuándo!)
    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const taskDocRef = doc(db, 'relationships', chatId, 'tasks', taskId);
        
        try {
            if (!currentStatus) {
                // Marcando como COMPLETA
                await updateDoc(taskDocRef, {
                    isCompleted: true,
                    completedBy: user.uid,
                    completedByName: userData.displayName,
                    completedAt: serverTimestamp()
                });
            } else {
                // Marcando como INCOMPLETA
                 await updateDoc(taskDocRef, {
                    isCompleted: false,
                    completedBy: null,
                    completedByName: null,
                    completedAt: null
                });
            }
        } catch (error) {
            console.error("Error al actualizar la tarea:", error);
            Toast.show({ type: 'error', text1: 'Error al actualizar' });
        }
    };

    // --- 5. NUEVAS FUNCIONES DE EDICIÓN Y BORRADO ---

    // Abrir el modal de edición
    const openEditModal = (task: DocumentData) => {
        setEditingTask({ id: task.id, text: task.text, authorId: task.authorId });
        setEditedText(task.text);
        setIsEditModalVisible(true);
    };

    // Guardar la edición
    const handleUpdateTask = async () => {
        if (!editingTask || editedText.trim() === '' || !userData || !userData.partnerId || !user) return;
        
        // Verificación de permisos
        if (user.uid !== editingTask.authorId) {
             Toast.show({ type: 'error', text1: 'Acción no permitida' });
             return;
        }

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const taskDocRef = doc(db, 'relationships', chatId, 'tasks', editingTask.id);
        
        try {
            await updateDoc(taskDocRef, { text: editedText.trim() });
            setIsEditModalVisible(false); setEditingTask(null);
            Toast.show({ type: 'success', text1: 'Tarea actualizada' });
        } catch (error) { Toast.show({ type: 'error', text1: 'Error al actualizar' }); }
    };

    // Eliminar la tarea
    const handleDeleteTask = async (taskId: string, authorId: string) => {
        // Verificación de permisos
        if (user?.uid !== authorId) {
            Toast.show({ type: 'error', text1: 'Solo el autor puede eliminar la tarea' });
            return;
        }
        
        // Confirmación
        Alert.alert("Confirmar Eliminación", "¿Seguro que quieres borrar esta tarea?",
            [ { text: "Cancelar", style: "cancel" }, {
                text: "Eliminar", style: "destructive",
                onPress: async () => {
                    if (!userData || !userData.partnerId || !user) return;
                    const chatId = [user.uid, userData.partnerId].sort().join('_');
                    const taskDocRef = doc(db, 'relationships', chatId, 'tasks', taskId);
                    try { 
                        await deleteDoc(taskDocRef); 
                        Toast.show({ type: 'success', text1: 'Tarea eliminada' }); 
                    }
                    catch (error) { Toast.show({ type: 'error', text1: 'Error al eliminar' }); }
                }
            }]
        );
    };

    // Menú de pulsación larga (Long Press)
    const handleTaskLongPress = (item: DocumentData) => {
        // Solo el autor puede editar o borrar
        if (user?.uid === item.authorId) {
            Alert.alert( "Opciones de Tarea", item.text.substring(0, 50) + '...',
                [
                    { text: "Editar", onPress: () => openEditModal(item) },
                    { text: "Eliminar", onPress: () => handleDeleteTask(item.id, item.authorId), style: "destructive" },
                    { text: "Cancelar", style: "cancel" },
                ],
                { cancelable: true }
            );
        }
        // Si no es el autor, no hacer nada en long press
    };

    // --- Renderizado ---
    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }
    
    if (userData && !userData.partnerId) {
         return (
             <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                     <Text style={styles.title}>Lista de Tareas</Text>
                     <Text style={styles.placeholderText}>Conéctate con tu pareja para crear tareas compartidas.</Text>
                </View>
             </SafeAreaView>
        );
    }

     if (!user || !userData) {
         return <View style={styles.loadingContainer}><Text style={{color: theme.placeholder}}>Cargando...</Text></View>;
     }

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={styles.container}>
                    <Text style={styles.title}>Lista de Tareas</Text>
                    
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Nueva tarea (ej. Comprar pan)"
                            placeholderTextColor={theme.placeholder}
                            value={newTask}
                            onChangeText={setNewTask}
                            onSubmitEditing={handleAddTask} 
                        />
                        <Button title="Añadir" onPress={handleAddTask} color={theme.primary} disabled={newTask.trim() === ''} />
                    </View>
                    
                    <FlatList
                        style={styles.listContainer}
                        data={tasks}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            // Construir el texto de metadatos
                            let metaText = `Añadida por: ${item.authorName}`;
                            if (item.isCompleted && item.completedByName) {
                                metaText += ` · Completada por: ${item.completedByName}`;
                            }

                            return (
                                <TouchableOpacity 
                                    style={styles.taskItemTouchable}
                                    // 6. Añadimos el menú de pulsación larga
                                    onLongPress={() => handleTaskLongPress(item)} 
                                    delayLongPress={500}
                                    // 7. Y mantenemos el toggle en la pulsación simple
                                    onPress={() => handleToggleTask(item.id, item.isCompleted)}
                                >
                                    <View style={styles.taskItem}>
                                        <View style={styles.taskMainRow}>
                                            <Ionicons 
                                                name={item.isCompleted ? "checkbox" : "square-outline"} 
                                                size={24} 
                                                color={item.isCompleted ? theme.placeholder : theme.primary} 
                                            />
                                            <View style={styles.taskTextContainer}>
                                                <Text style={item.isCompleted ? styles.taskTextCompleted : styles.taskText}>
                                                    {item.text}
                                                </Text>
                                            </View>
                                        </View>
                                        {/* 8. Mostramos los metadatos */}
                                        <Text style={styles.taskMeta}>
                                            {metaText}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )
                        }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.placeholderText}>¡Empiecen añadiendo una tarea!</Text>}
                    />
                </View>
            </KeyboardAvoidingView>

            {/* --- 9. MODAL PARA EDITAR TAREA --- */}
            <Modal animationType="fade" transparent={true} visible={isEditModalVisible} onRequestClose={() => setIsEditModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Editar Tarea</Text>
                        <TextInput style={styles.modalInput} value={editedText} onChangeText={setEditedText} multiline maxLength={100} />
                        <View style={styles.modalButtons}>
                            <Button title="Cancelar" onPress={() => setIsEditModalVisible(false)} color="grey" />
                            <Button title="Guardar Cambios" onPress={handleUpdateTask} color={theme.primary} />
                        </View>
                    </View>
                </View>
            </Modal>

        </SafeAreaView>
    );
};

export default TasksScreen;