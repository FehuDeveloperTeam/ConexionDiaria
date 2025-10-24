import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme,
    TextInput, Button, FlatList,
    KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { 
    collection, addDoc, onSnapshot, query, orderBy, doc, 
    DocumentData, serverTimestamp, updateDoc 
} from 'firebase/firestore';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';

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
        flexDirection: 'row', // Para alinear input y botón
        alignItems: 'center',
    },
    input: { 
        flex: 1, // Para que ocupe el espacio
        color: theme.text, 
        fontSize: 16, 
        paddingVertical: 10, // Padding vertical
    },
    listContainer: { flex: 1 },
    taskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.inputBackground,
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderColor: theme.borderColor,
        borderWidth: 1,
    },
    taskText: {
        fontSize: 16,
        color: theme.text,
        marginLeft: 15,
    },
    taskTextCompleted: {
        fontSize: 16,
        color: theme.placeholder,
        marginLeft: 15,
        textDecorationLine: 'line-through', // Tachar texto
    },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
});

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
        if (!user) return; // Salir si no hay usuario

        let unsubscribeUser: () => void = () => {};
        let unsubscribeTasks: () => void = () => {};

        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            unsubscribeTasks(); // Limpiar listener de tareas si el perfil cambia

            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);

                if (data.partnerId) {
                    const chatId = [user.uid, data.partnerId].sort().join('_');
                    const tasksCollectionRef = collection(db, 'relationships', chatId, 'tasks');
                    // Ordenamos por completado (ascendente) y luego fecha (descendente)
                    const q = query(tasksCollectionRef, orderBy('isCompleted', 'asc'), orderBy('createdAt', 'desc'));
                    
                    unsubscribeTasks = onSnapshot(q, (snapshot) => {
                        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                        setLoading(false);
                    }, (error) => { console.error("Error fetching tasks:", error); setLoading(false); });
                } else {
                    setTasks([]); setLoading(false); // No pareja, no hay tareas
                }
            } else {
                auth.signOut(); setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });

        return () => { unsubscribeUser(); unsubscribeTasks(); };
    }, [user]);

    // 3. Función para añadir una nueva tarea
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
            });
            setNewTask(''); // Limpiar input
            Toast.show({ type: 'success', text1: 'Tarea añadida' });
        } catch (error) {
            console.error("Error al añadir la tarea:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar la tarea' });
        }
    }, [newTask, userData, user]);

    // 4. Función para marcar/desmarcar tarea
    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const taskDocRef = doc(db, 'relationships', chatId, 'tasks', taskId);
        
        try {
            await updateDoc(taskDocRef, {
                isCompleted: !currentStatus
            });
        } catch (error) {
            console.error("Error al actualizar la tarea:", error);
            Toast.show({ type: 'error', text1: 'Error al actualizar' });
        }
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
                            onSubmitEditing={handleAddTask} // Añadir con "Enter"
                        />
                        <Button title="Añadir" onPress={handleAddTask} color={theme.primary} disabled={newTask.trim() === ''} />
                    </View>
                    
                    <FlatList
                        style={styles.listContainer}
                        data={tasks}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.taskItem}
                                onPress={() => handleToggleTask(item.id, item.isCompleted)}
                            >
                                <Ionicons 
                                    name={item.isCompleted ? "checkbox" : "square-outline"} 
                                    size={24} 
                                    color={item.isCompleted ? theme.placeholder : theme.primary} 
                                />
                                <Text style={item.isCompleted ? styles.taskTextCompleted : styles.taskText}>
                                    {item.text}
                                </Text>
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={<Text style={styles.placeholderText}>¡Empiecen añadiendo una tarea!</Text>}
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default TasksScreen;