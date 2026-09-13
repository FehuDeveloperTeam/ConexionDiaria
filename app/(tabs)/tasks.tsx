// Sprint 7.5 — re-skin de Tareas según el sistema de diseño: secciones
// Pendientes/Completadas, casilla propia y modal de edición compartiendo
// el lenguaje visual del resto de la app.
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, SectionList,
    KeyboardAvoidingView, Platform, TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../src/config/firebaseConfig';
import { fontFamilies, radii, spacing } from '../../src/config/theme';
import {
    collection, addDoc, onSnapshot, query, orderBy, doc, limit,
    DocumentData, serverTimestamp, updateDoc, deleteDoc,
} from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ConfirmDestructiveModal } from '../../src/components/ConfirmDestructiveModal';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { useRouter } from 'expo-router';

interface EditingTask { id: string; text: string; authorId: string; }

const TasksScreen: React.FC = () => {
    const { theme, isDarkMode: isDark } = useTheme();
    const router = useRouter();

    const { user, userData } = usePlan();
    const [tasks, setTasks] = useState<DocumentData[]>([]);
    const [newTask, setNewTask] = useState('');
    const [loading, setLoading] = useState(true);

    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
    const [editedText, setEditedText] = useState('');
    const [contextMenuTask, setContextMenuTask] = useState<DocumentData | null>(null);
    const [deletingTask, setDeletingTask] = useState<DocumentData | null>(null);

    const partnerId = userData?.partnerId as string | undefined;

    useEffect(() => {
        if (!user || !partnerId) {
            setTasks([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const chatId = [user.uid, partnerId].sort().join('_');
        const tasksCollectionRef = collection(db, 'relationships', chatId, 'tasks');
        const q = query(tasksCollectionRef, orderBy('isCompleted', 'asc'), orderBy('createdAt', 'desc'), limit(300));

        const unsubscribeTasks = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => { console.error("Error fetching tasks:", error); setLoading(false); });

        return () => unsubscribeTasks();
    }, [user, partnerId]);

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
                completedBy: null,
                completedByName: null,
                completedAt: null,
            });
            setNewTask('');
            Toast.show({ type: 'success', text1: 'Tarea añadida' });
        } catch (error) {
            console.error("Error al añadir la tarea:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar la tarea' });
        }
    }, [newTask, userData, user]);

    const handleToggleTask = async (taskId: string, currentStatus: boolean) => {
        if (!userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const taskDocRef = doc(db, 'relationships', chatId, 'tasks', taskId);

        try {
            if (!currentStatus) {
                await updateDoc(taskDocRef, {
                    isCompleted: true,
                    completedBy: user.uid,
                    completedByName: userData.displayName,
                    completedAt: serverTimestamp(),
                });
            } else {
                await updateDoc(taskDocRef, {
                    isCompleted: false,
                    completedBy: null,
                    completedByName: null,
                    completedAt: null,
                });
            }
        } catch (error) {
            console.error("Error al actualizar la tarea:", error);
            Toast.show({ type: 'error', text1: 'Error al actualizar' });
        }
    };

    const openEditModal = (task: DocumentData) => {
        setEditingTask({ id: task.id, text: task.text, authorId: task.authorId });
        setEditedText(task.text);
        setIsEditModalVisible(true);
    };

    const handleUpdateTask = async () => {
        if (!editingTask || editedText.trim() === '' || !userData || !userData.partnerId || !user) return;

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const taskDocRef = doc(db, 'relationships', chatId, 'tasks', editingTask.id);

        try {
            await updateDoc(taskDocRef, { text: editedText.trim() });
            setIsEditModalVisible(false); setEditingTask(null);
            Toast.show({ type: 'success', text1: 'Tarea actualizada' });
        } catch { Toast.show({ type: 'error', text1: 'Error al actualizar' }); }
    };

    const confirmDeleteTask = async () => {
        if (!deletingTask || !userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const taskDocRef = doc(db, 'relationships', chatId, 'tasks', deletingTask.id);
        try {
            await deleteDoc(taskDocRef);
            Toast.show({ type: 'success', text1: 'Tarea eliminada' });
        } catch { Toast.show({ type: 'error', text1: 'Error al eliminar' }); }
        setDeletingTask(null);
    };

    // --- Renderizado ---
    if (loading) {
        return <FullScreenLoader />;
    }

    if (userData && !userData.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
                <EmptyState
                    icon="checkmark-circle-outline"
                    title="Nada que hacer... todavía"
                    message="Conéctate con tu pareja para crear tareas compartidas."
                    onConnectPress={() => router.push('/(tabs)/home')}
                />
            </SafeAreaView>
        );
    }

    if (!user || !userData) {
        return <FullScreenLoader />;
    }

    const pendingTasks = tasks.filter(t => !t.isCompleted);
    const completedTasks = tasks.filter(t => t.isCompleted);
    const todayStr = new Date().toDateString();
    const completedTodayCount = completedTasks.filter(
        t => t.completedAt?.toDate && t.completedAt.toDate().toDateString() === todayStr
    ).length;

    const sections = [
        { title: 'PENDIENTES', data: pendingTasks },
        { title: 'COMPLETADAS', data: completedTasks },
    ].filter(s => s.data.length > 0);

    const checkboxBorderColor = isDark ? '#4A4458' : '#C9C4EC';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={{ paddingHorizontal: spacing.s22, paddingTop: spacing.s16, paddingBottom: spacing.s10 }}>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.text }}>Tareas</Text>
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, marginTop: spacing.s4 }}>
                        {pendingTasks.length} pendientes · {completedTodayCount} hechas hoy
                    </Text>
                </View>

                <SectionList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingHorizontal: spacing.s22, paddingBottom: spacing.s22 }}
                    sections={sections}
                    keyExtractor={item => item.id}
                    extraData={user}
                    stickySectionHeadersEnabled={false}
                    renderSectionHeader={({ section }) => (
                        <Text style={{
                            fontFamily: fontFamilies.bodyBold,
                            fontSize: 11,
                            letterSpacing: 0.9,
                            textTransform: 'uppercase',
                            color: theme.textFaint,
                            marginTop: spacing.s16,
                            marginBottom: spacing.s10,
                        }}>
                            {section.title}
                        </Text>
                    )}
                    renderItem={({ item }) => {
                        let metaText = `agregó ${item.authorName}`;
                        if (item.isCompleted && item.completedByName) {
                            metaText += ` · completó ${item.completedByName}`;
                        }

                        return (
                            <TouchableOpacity
                                onPress={() => handleToggleTask(item.id, item.isCompleted)}
                                onLongPress={() => setContextMenuTask(item)}
                                delayLongPress={400}
                                activeOpacity={0.85}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'flex-start',
                                    gap: spacing.s12,
                                    backgroundColor: item.isCompleted ? theme.surfaceAlt : theme.surface,
                                    opacity: item.isCompleted ? 0.72 : 1,
                                    borderRadius: 18,
                                    padding: 15,
                                    marginBottom: spacing.s12,
                                }}
                            >
                                <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -9, marginTop: -9, marginBottom: -9 }}>
                                    {item.isCompleted ? (
                                        <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="checkmark" size={17} color={theme.white} />
                                        </View>
                                    ) : (
                                        <View style={{ width: 26, height: 26, borderRadius: 9, borderWidth: 2, borderColor: checkboxBorderColor }} />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontFamily: fontFamilies.bodySemiBold,
                                        fontSize: 15,
                                        color: item.isCompleted ? theme.textMuted : theme.text,
                                        textDecorationLine: item.isCompleted ? 'line-through' : 'none',
                                    }}>
                                        {item.text}
                                    </Text>
                                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 11.5, color: theme.textFaint, marginTop: spacing.s4 }}>
                                        {metaText}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textFaint, textAlign: 'center', marginTop: spacing.s26 * 2 }}>
                            ¡Empiecen añadiendo una tarea!
                        </Text>
                    }
                />

                {/* Input fijo abajo */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.s10,
                    paddingHorizontal: spacing.s22,
                    paddingVertical: spacing.s12,
                    borderTopWidth: 1,
                    borderTopColor: theme.borderSoft,
                    backgroundColor: theme.bg,
                }}>
                    <TextInput
                        style={{
                            flex: 1,
                            height: 44,
                            borderWidth: 1,
                            borderColor: theme.borderSoft,
                            borderRadius: radii.field,
                            paddingHorizontal: spacing.s14,
                            color: theme.text,
                            fontFamily: fontFamilies.body,
                            fontSize: 15,
                            backgroundColor: theme.inputBackground,
                        }}
                        placeholder="Nueva tarea (ej. Comprar pan)"
                        placeholderTextColor={theme.textFaint}
                        value={newTask}
                        onChangeText={setNewTask}
                        onSubmitEditing={handleAddTask}
                    />
                    <TouchableOpacity
                        onPress={handleAddTask}
                        disabled={newTask.trim() === ''}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            backgroundColor: newTask.trim() === '' ? theme.borderSoft : theme.primary,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Ionicons name="add" size={24} color={theme.white} />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
            </DesktopContentWrap>

            {/* Menú contextual flotante — Editar (ambos) / Eliminar (solo autor) */}
            <Modal visible={!!contextMenuTask} transparent animationType="fade" onRequestClose={() => setContextMenuTask(null)}>
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.35)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={1}
                    onPress={() => setContextMenuTask(null)}
                >
                    <View style={{
                        backgroundColor: theme.surface,
                        borderRadius: 14,
                        paddingVertical: spacing.s8,
                        minWidth: 190,
                        ...(isDark ? { borderWidth: 1, borderColor: theme.border } : {
                            shadowColor: '#1E1E3C', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.16, shadowRadius: 22, elevation: 10,
                        }),
                    }}>
                        <TouchableOpacity
                            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, paddingVertical: spacing.s12, paddingHorizontal: spacing.s16 }}
                            onPress={() => {
                                if (contextMenuTask) openEditModal(contextMenuTask);
                                setContextMenuTask(null);
                            }}
                        >
                            <Ionicons name="create-outline" size={18} color={theme.text} />
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.text }}>Editar</Text>
                        </TouchableOpacity>
                        {contextMenuTask?.authorId === user.uid && (
                            <TouchableOpacity
                                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, paddingVertical: spacing.s12, paddingHorizontal: spacing.s16 }}
                                onPress={() => {
                                    setDeletingTask(contextMenuTask);
                                    setContextMenuTask(null);
                                }}
                            >
                                <Ionicons name="trash-outline" size={18} color={theme.danger} />
                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.danger }}>Eliminar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modal de edición */}
            <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.s20 }}>
                    <View style={{ backgroundColor: theme.surface, borderRadius: radii.cardLg, padding: spacing.s22, width: '100%', maxWidth: 380, gap: spacing.s14 }}>
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, color: theme.text }}>Editar tarea</Text>
                        <TextInput
                            style={{
                                minHeight: 82,
                                borderWidth: 1.5,
                                borderColor: theme.primary,
                                borderRadius: radii.field,
                                padding: spacing.s12,
                                color: theme.text,
                                fontFamily: fontFamilies.body,
                                fontSize: 15,
                                textAlignVertical: 'top',
                            }}
                            value={editedText}
                            onChangeText={setEditedText}
                            multiline
                            maxLength={100}
                        />
                        <View style={{ flexDirection: 'row', gap: spacing.s10 }}>
                            <View style={{ flex: 1 }}>
                                <Button title="Cancelar" variant="outline" onPress={() => setIsEditModalVisible(false)} />
                            </View>
                            <View style={{ flex: 1.3 }}>
                                <Button title="Guardar" onPress={handleUpdateTask} disabled={editedText.trim() === ''} />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <ConfirmDestructiveModal
                visible={!!deletingTask}
                title="Eliminar tarea"
                message="Se borrará para los dos y no se puede deshacer."
                onConfirm={confirmDeleteTask}
                onCancel={() => setDeletingTask(null)}
            />
        </SafeAreaView>
    );
};

export default TasksScreen;
