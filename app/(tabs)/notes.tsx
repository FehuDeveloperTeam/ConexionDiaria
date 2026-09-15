// Sprint 7.5 — re-skin de Notas según el sistema de diseño: notas adhesivas
// rotadas con paleta propia, menú contextual flotante y modal de edición
// compartiendo el lenguaje visual del resto de la app.
import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, FlatList,
    KeyboardAvoidingView, Platform, Modal, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../src/config/firebaseConfig';
import { noteColors, noteRotations, radii, shadows, spacing } from '../../src/config/theme';
import { collection, addDoc, onSnapshot, query, orderBy, doc, limit, DocumentData, serverTimestamp, deleteDoc, updateDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ConfirmDestructiveModal } from '../../src/components/ConfirmDestructiveModal';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { ContextMenuRow } from '../../src/components/ContextMenuRow';
import { RowActions } from '../../src/components/RowActions';
import { useRouter } from 'expo-router';

interface EditingNote { id: string; text: string; }

const NotesScreen: React.FC = () => {
    const { theme, isDarkMode: isDark, fontFamilies } = useTheme();
    const router = useRouter();

    const { user, userData } = usePlan();
    const [notes, setNotes] = useState<DocumentData[]>([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingNote, setEditingNote] = useState<EditingNote | null>(null);
    const [editedText, setEditedText] = useState('');
    const [contextMenuNote, setContextMenuNote] = useState<DocumentData | null>(null);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

    const partnerId = userData?.partnerId as string | undefined;

    useEffect(() => {
        if (!user || !partnerId) {
            setNotes([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const chatId = [user.uid, partnerId].sort().join('_');
        const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
        const q = query(notesCollectionRef, orderBy('createdAt', 'desc'), limit(200));

        const unsubscribeNotes = onSnapshot(q, (snapshot) => {
            setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        }, (error) => { console.error("Error fetching notes:", error); setLoading(false); });

        return () => unsubscribeNotes();
    }, [user, partnerId]);

    const handleAddNote = useCallback(async () => {
        const noteText = newNote.trim();
        if (noteText === '' || !userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
        try {
            await addDoc(notesCollectionRef, { text: noteText, authorId: user.uid, authorName: userData.displayName, createdAt: serverTimestamp() });
            setNewNote('');
            Toast.show({ type: 'success', text1: 'Nota añadida' });
        } catch { Toast.show({ type: 'error', text1: 'Error al guardar la nota' }); }
    }, [newNote, userData, user]);

    const confirmDeleteNote = async () => {
        if (!deletingNoteId || !userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const noteDocRef = doc(db, 'relationships', chatId, 'notes', deletingNoteId);
        try {
            await deleteDoc(noteDocRef);
            Toast.show({ type: 'success', text1: 'Nota eliminada' });
        } catch { Toast.show({ type: 'error', text1: 'Error al eliminar' }); }
        setDeletingNoteId(null);
    };

    const openEditModal = (note: DocumentData) => {
        setEditingNote({ id: note.id, text: note.text });
        setEditedText(note.text);
        setIsEditModalVisible(true);
    };

    const handleUpdateNote = async () => {
        if (!editingNote || editedText.trim() === '' || !userData || !userData.partnerId || !user) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const noteDocRef = doc(db, 'relationships', chatId, 'notes', editingNote.id);
        try {
            await updateDoc(noteDocRef, { text: editedText.trim() });
            setIsEditModalVisible(false); setEditingNote(null);
            Toast.show({ type: 'success', text1: 'Nota actualizada' });
        } catch { Toast.show({ type: 'error', text1: 'Error al actualizar' }); }
    };

    // --- Renderizado ---
    if (loading) {
        return <FullScreenLoader />;
    }

    if (userData && !userData.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
                <EmptyState
                    icon="document-text-outline"
                    title="Aún no hay a quién escribirle"
                    message="Conéctate con tu pareja para empezar a dejar notas en su muro."
                    onConnectPress={() => router.push('/(tabs)/home')}
                />
            </SafeAreaView>
        );
    }

    if (!user || !userData) {
        return <FullScreenLoader />;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    paddingHorizontal: spacing.s22,
                    paddingTop: spacing.s16,
                    paddingBottom: spacing.s10,
                }}>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.text }}>Notas</Text>
                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.textMuted }}>
                        {notes.length} notas
                    </Text>
                </View>

                <FlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingTop: spacing.s4, paddingBottom: spacing.s22 }}
                    data={notes}
                    keyExtractor={item => item.id}
                    extraData={user}
                    renderItem={({ item, index }) => {
                        const palette = noteColors[index % noteColors.length];
                        const rotation = noteRotations[index % noteRotations.length];
                        const bg = isDark ? palette.dark.bg : palette.light.bg;
                        const textColor = isDark ? theme.text : palette.light.text;
                        const authorColor = isDark ? theme.textFaint : palette.light.author;
                        const depthProps = isDark
                            ? { borderWidth: 1, borderColor: palette.dark.border }
                            : shadows.stickyNote;

                        return (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onLongPress={() => setContextMenuNote(item)}
                                delayLongPress={400}
                                style={{
                                    marginHorizontal: spacing.s22,
                                    marginBottom: spacing.s14,
                                    transform: [{ rotate: rotation }],
                                }}
                            >
                                <View style={{ backgroundColor: bg, borderRadius: 14, padding: spacing.s16, ...depthProps }}>
                                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22.5, color: textColor }}>
                                        {item.text}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.s10 }}>
                                        <RowActions
                                            onEdit={() => openEditModal(item)}
                                            onDelete={item.authorId === user.uid ? () => setDeletingNoteId(item.id) : undefined}
                                        />
                                        <Text style={{
                                            fontFamily: fontFamilies.body,
                                            fontStyle: 'italic',
                                            fontSize: 11.5,
                                            color: authorColor,
                                            textAlign: 'right',
                                            flex: 1,
                                        }}>
                                            — {item.authorName}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textFaint, textAlign: 'center', marginTop: spacing.s26 * 2 }}>
                            Aún no hay notas...
                        </Text>
                    }
                />

                {/* Input fijo abajo */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
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
                            minHeight: 44,
                            maxHeight: 100,
                            borderWidth: 1,
                            borderColor: theme.borderSoft,
                            borderRadius: radii.field,
                            paddingHorizontal: spacing.s14,
                            paddingVertical: spacing.s10,
                            color: theme.text,
                            fontFamily: fontFamilies.body,
                            fontSize: 15,
                            backgroundColor: theme.inputBackground,
                        }}
                        placeholder="Escribe una nota…"
                        placeholderTextColor={theme.textFaint}
                        value={newNote}
                        onChangeText={setNewNote}
                        multiline
                        maxLength={200}
                    />
                    <TouchableOpacity
                        onPress={handleAddNote}
                        disabled={newNote.trim() === ''}
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 14,
                            backgroundColor: newNote.trim() === '' ? theme.borderSoft : theme.primary,
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
            <Modal visible={!!contextMenuNote} transparent animationType="fade" onRequestClose={() => setContextMenuNote(null)}>
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.35)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={1}
                    onPress={() => setContextMenuNote(null)}
                >
                    <View style={{
                        backgroundColor: theme.surface,
                        borderRadius: 14,
                        paddingVertical: spacing.s8,
                        minWidth: 190,
                        ...(isDark ? { borderWidth: 1, borderColor: theme.border } : shadows.contextMenu),
                    }}>
                        <ContextMenuRow
                            icon="create-outline"
                            label="Editar"
                            onPress={() => {
                                if (contextMenuNote) openEditModal(contextMenuNote);
                                setContextMenuNote(null);
                            }}
                        />
                        {contextMenuNote?.authorId === user.uid && (
                            <ContextMenuRow
                                icon="trash-outline"
                                label="Eliminar"
                                color={theme.danger}
                                onPress={() => {
                                    setDeletingNoteId(contextMenuNote?.id ?? null);
                                    setContextMenuNote(null);
                                }}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modal de edición */}
            <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={() => setIsEditModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.s20 }}>
                    <View style={{ backgroundColor: theme.surface, borderRadius: radii.cardLg, padding: spacing.s22, width: '100%', maxWidth: 380, gap: spacing.s14 }}>
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, color: theme.text }}>Editar nota</Text>
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
                            maxLength={200}
                        />
                        <View style={{ flexDirection: 'row', gap: spacing.s10 }}>
                            <View style={{ flex: 1 }}>
                                <Button title="Cancelar" variant="outline" onPress={() => setIsEditModalVisible(false)} />
                            </View>
                            <View style={{ flex: 1.3 }}>
                                <Button title="Guardar" onPress={handleUpdateNote} disabled={editedText.trim() === ''} />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <ConfirmDestructiveModal
                visible={!!deletingNoteId}
                title="Eliminar nota"
                message="Se borrará para los dos y no se puede deshacer."
                onConfirm={confirmDeleteNote}
                onCancel={() => setDeletingNoteId(null)}
            />
        </SafeAreaView>
    );
};

export default NotesScreen;
