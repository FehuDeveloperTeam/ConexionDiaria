// Sprint 7.5 — re-skin de Notas según el sistema de diseño: notas adhesivas
// rotadas con paleta propia, menú contextual flotante y modal de edición
// compartiendo el lenguaje visual del resto de la app.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TextInput, SectionList, ActivityIndicator,
    KeyboardAvoidingView, Platform, Modal, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db, storage } from '../../src/config/firebaseConfig';
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
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { formatDate } from '../../src/services/dateFormat';
import { useSingleAudioPlayer, formatAudioDuration } from '../../src/hooks/useSingleAudioPlayer';
import { useAudioRecording } from '../../src/screens/chat/hooks/useAudioRecording';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { storageLimitFor } from '../../src/config/plans';

interface EditingNote { id: string; text: string; }

// Sprint 9.8 — mismo modelo que Deseos: lo archivado no ocupa cupo, así
// nadie tiene que borrar una nota para poder escribir otra. Como una nota no
// tiene un estado natural de "cumplida" (a diferencia del "regalado" de un
// deseo), archivar es una acción explícita del usuario.
const FREE_LIMIT = 10;
const ARCHIVE_FREE_VISIBLE = 10;

const NotesScreen: React.FC = () => {
    const { theme, isDarkMode: isDark, fontFamilies } = useTheme();
    const router = useRouter();

    const { user, userData, plan, relationshipData } = usePlan();
    const [notes, setNotes] = useState<DocumentData[]>([]);
    const [newNote, setNewNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [editingNote, setEditingNote] = useState<EditingNote | null>(null);
    const [editedText, setEditedText] = useState('');
    const [contextMenuNote, setContextMenuNote] = useState<DocumentData | null>(null);
    const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
    const [isPaywallVisible, setIsPaywallVisible] = useState(false);
    const [isUploadingVoice, setIsUploadingVoice] = useState(false);
    const audioPlayer = useSingleAudioPlayer();

    const partnerId = userData?.partnerId as string | undefined;

    // Las notas creadas antes de esta sesión no traen el campo 'archived';
    // al llegar indefinido cuentan como activas, así que no hace falta migrar.
    const activeNotes = useMemo(() => notes.filter(note => !note.archived), [notes]);
    const archivedNotes = useMemo(() => notes.filter(note => note.archived), [notes]);
    const limitReached = plan === 'free' && activeNotes.length >= FREE_LIMIT;

    const noteSections = useMemo(() => {
        const sections = [{ title: 'Notas', isArchive: false, hiddenCount: 0, data: activeNotes }];

        if (archivedNotes.length > 0) {
            const visible = plan === 'free' ? archivedNotes.slice(0, ARCHIVE_FREE_VISIBLE) : archivedNotes;
            sections.push({
                title: 'Archivadas',
                isArchive: true,
                hiddenCount: archivedNotes.length - visible.length,
                data: visible,
            });
        }

        return sections;
    }, [activeNotes, archivedNotes, plan]);

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

    // Archivar y desarchivar son escrituras sobre la nota, y las reglas de
    // Firestore solo dejan actualizar al autor (a diferencia de Tareas y
    // Deseos, donde cualquiera de los dos puede). Por eso la acción se ofrece
    // únicamente sobre las notas propias.
    const handleToggleArchived = useCallback(async (note: DocumentData) => {
        if (!user || !userData?.partnerId) return;

        // Devolver una nota a la lista activa puede pasarse del tope; sin este
        // control el archivo sería una puerta trasera para el plan free.
        if (note.archived && plan === 'free' && activeNotes.length >= FREE_LIMIT) {
            setIsPaywallVisible(true);
            return;
        }

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const noteDocRef = doc(db, 'relationships', chatId, 'notes', note.id);
        try {
            await updateDoc(noteDocRef, { archived: !note.archived });
            Toast.show({ type: 'success', text1: note.archived ? 'Nota de vuelta en el muro' : 'Nota archivada' });
        } catch {
            Toast.show({ type: 'error', text1: 'Error al archivar' });
        }
    }, [user, userData, plan, activeNotes.length]);

    // Sprint 9.15 — notas de voz. Se sube a
    // relationships/{rel}/notesAudio/, cubierto por la regla comodín de
    // Storage que ya existe, y la contabilidad de almacenamiento la cuenta
    // igual que un adjunto del chat, que es lo correcto: ocupa lo mismo.
    const uploadVoiceNote = useCallback(async (uri: string, durationMillis?: number) => {
        if (!user || !userData?.partnerId) return;

        try {
            setIsUploadingVoice(true);
            const response = await fetch(uri);
            const blob = await response.blob();

            const chatId = [user.uid, userData.partnerId].sort().join('_');
            const filename = `${Crypto.randomUUID()}.m4a`;
            const storageRef = ref(storage, `relationships/${chatId}/notesAudio/${filename}`);
            const uploadTask = uploadBytesResumable(storageRef, blob);

            await new Promise<void>((resolve, reject) => {
                uploadTask.on('state_changed', undefined, reject, () => resolve());
            });

            const url = await getDownloadURL(uploadTask.snapshot.ref);
            await addDoc(collection(db, 'relationships', chatId, 'notes'), {
                text: '',
                audio: url,
                audioDuration: durationMillis ?? null,
                authorId: user.uid,
                authorName: userData.displayName,
                createdAt: serverTimestamp(),
            });

            Toast.show({ type: 'success', text1: 'Nota de voz añadida' });
        } catch (error) {
            console.error('Error subiendo la nota de voz:', error);
            Toast.show({ type: 'error', text1: 'No se pudo guardar la nota de voz' });
        } finally {
            setIsUploadingVoice(false);
        }
    }, [user, userData]);

    const {
        isRecording,
        recordingDuration,
        startRecording,
        stopRecording,
        cancelRecording,
        formatRecordingTime,
    } = useAudioRecording({
        plan,
        usedStorage: relationshipData?.usedStorage || 0,
        maxStorage: storageLimitFor(plan),
        uploadAudio: uploadVoiceNote,
        onNeedUpgrade: () => setIsPaywallVisible(true),
    });

    const handleStartVoiceNote = () => {
        // Dos motivos distintos para no dejar grabar, y cada uno abre el
        // paywall con su propio texto: la función es premium, y además el
        // cupo de notas se respeta igual que con las escritas.
        if (plan !== 'premium' || limitReached) {
            setIsPaywallVisible(true);
            return;
        }
        startRecording();
    };

    const handleAddNote = useCallback(async () => {
        const noteText = newNote.trim();
        if (noteText === '' || !userData || !userData.partnerId || !user) return;

        if (limitReached) {
            setIsPaywallVisible(true);
            return;
        }

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
        try {
            await addDoc(notesCollectionRef, { text: noteText, authorId: user.uid, authorName: userData.displayName, createdAt: serverTimestamp() });
            setNewNote('');
            Toast.show({ type: 'success', text1: 'Nota añadida' });
        } catch { Toast.show({ type: 'error', text1: 'Error al guardar la nota' }); }
    }, [newNote, userData, user, limitReached]);

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
                    <Text style={{
                        fontFamily: fontFamilies.bodySemiBold,
                        fontSize: 12,
                        color: limitReached ? theme.premium : theme.textMuted,
                    }}>
                        {plan === 'free'
                            ? (limitReached ? `${activeNotes.length} de ${FREE_LIMIT} activas · límite alcanzado` : `${activeNotes.length} de ${FREE_LIMIT} activas del plan free`)
                            : `${activeNotes.length} activas`}
                    </Text>
                </View>

                <SectionList
                    style={{ flex: 1, minHeight: 0 }}
                    contentContainerStyle={{ paddingTop: spacing.s4, paddingBottom: spacing.s22 }}
                    sections={noteSections}
                    keyExtractor={item => item.id}
                    extraData={user}
                    stickySectionHeadersEnabled={false}
                    // La sección de activas no lleva encabezado: es el muro, y
                    // rotularlo sobraría. Solo se anuncia el archivo.
                    renderSectionHeader={({ section }) => (
                        section.isArchive ? (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                                marginHorizontal: spacing.s22, marginTop: spacing.s16, marginBottom: spacing.s14,
                            }}>
                                <Ionicons name="archive-outline" size={15} color={theme.textFaint} />
                                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 13, color: theme.textMuted }}>
                                    {section.title}
                                </Text>
                                <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                                    {section.data.length}
                                </Text>
                            </View>
                        ) : null
                    )}
                    renderSectionFooter={({ section }) => (
                        section.isArchive && section.hiddenCount > 0 ? (
                            <TouchableOpacity
                                onPress={() => setIsPaywallVisible(true)}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                                    marginHorizontal: spacing.s22, marginTop: spacing.s4,
                                    borderWidth: 1, borderStyle: 'dashed', borderColor: theme.primary,
                                    backgroundColor: theme.primaryTint, borderRadius: radii.card, padding: spacing.s14,
                                }}
                            >
                                <Ionicons name="lock-closed" size={16} color={theme.premium} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.text }}>
                                        {section.hiddenCount} {section.hiddenCount === 1 ? 'nota más' : 'notas más'} en el archivo
                                    </Text>
                                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                                        Free guarda las {ARCHIVE_FREE_VISIBLE} más recientes
                                    </Text>
                                </View>
                                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 12, color: theme.primary }}>
                                    Ver todo
                                </Text>
                            </TouchableOpacity>
                        ) : null
                    )}
                    renderItem={({ item, index, section }) => {
                        const palette = noteColors[index % noteColors.length];
                        const rotation = noteRotations[index % noteRotations.length];
                        const bg = isDark ? palette.dark.bg : palette.light.bg;
                        const textColor = isDark ? theme.text : palette.light.text;
                        const authorColor = isDark ? theme.textFaint : palette.light.author;
                        const depthProps = isDark
                            ? { borderWidth: 1, borderColor: palette.dark.border }
                            : shadows.stickyNote;

                        // 'createdAt' viene de serverTimestamp(), así que en el
                        // instante posterior a crear la nota todavía llega nulo:
                        // hasta que el servidor lo resuelve se muestra solo el autor.
                        const created = item.createdAt?.toDate ? item.createdAt.toDate() : null;
                        const createdLabel = created ? formatDate(created) : null;

                        const isOwn = item.authorId === user.uid;

                        return (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onLongPress={() => setContextMenuNote(item)}
                                delayLongPress={400}
                                style={{
                                    marginHorizontal: spacing.s22,
                                    marginBottom: spacing.s14,
                                    // Lo archivado se muestra derecho y atenuado: una nota
                                    // guardada ya no está pegada en el muro.
                                    transform: section.isArchive ? [] : [{ rotate: rotation }],
                                    opacity: section.isArchive ? 0.62 : 1,
                                }}
                            >
                                <View style={{ backgroundColor: bg, borderRadius: 14, padding: spacing.s16, ...depthProps }}>
                                    {item.audio ? (
                                        <TouchableOpacity
                                            onPress={() => audioPlayer.toggle(item.id, item.audio)}
                                            disabled={audioPlayer.loadingId === item.id}
                                            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}
                                        >
                                            <View style={{
                                                width: 34, height: 34, borderRadius: 17,
                                                backgroundColor: theme.primary,
                                                alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {audioPlayer.loadingId === item.id ? (
                                                    <ActivityIndicator size="small" color={theme.white} />
                                                ) : (
                                                    <Ionicons
                                                        name={audioPlayer.playingId === item.id ? 'pause' : 'play'}
                                                        size={17}
                                                        color={theme.white}
                                                    />
                                                )}
                                            </View>
                                            <View style={{ flex: 1, gap: spacing.s6 }}>
                                                <View style={{ height: 3, backgroundColor: theme.borderSoft, borderRadius: 1.5, overflow: 'hidden' }}>
                                                    <View style={{
                                                        height: '100%',
                                                        width: `${(audioPlayer.progress[item.id] || 0) * 100}%`,
                                                        backgroundColor: theme.primary,
                                                    }} />
                                                </View>
                                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 11.5, color: authorColor }}>
                                                    {item.audioDuration ? formatAudioDuration(item.audioDuration) : 'Nota de voz'}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22.5, color: textColor }}>
                                            {item.text}
                                        </Text>
                                    )}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.s10 }}>
                                        {/* Editar, archivar y eliminar son escrituras, y las
                                            reglas de Firestore solo se las permiten al autor
                                            de la nota. Antes se ofrecía "Editar" sobre las
                                            notas de la pareja y el servidor rechazaba el
                                            cambio sin explicación. */}
                                        <RowActions
                                            onEdit={isOwn ? () => openEditModal(item) : undefined}
                                            onArchive={isOwn ? () => handleToggleArchived(item) : undefined}
                                            isArchived={!!item.archived}
                                            onDelete={isOwn ? () => setDeletingNoteId(item.id) : undefined}
                                        />
                                        <Text style={{
                                            fontFamily: fontFamilies.body,
                                            fontStyle: 'italic',
                                            fontSize: 11.5,
                                            color: authorColor,
                                            textAlign: 'right',
                                            flex: 1,
                                        }}>
                                            — {item.authorName}{createdLabel ? ` · ${createdLabel}` : ''}
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
                    {isRecording && (
                        <>
                            <TouchableOpacity
                                onPress={cancelRecording}
                                style={{ width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
                                accessibilityLabel="Descartar la grabación"
                            >
                                <Ionicons name="trash-outline" size={22} color={theme.danger} />
                            </TouchableOpacity>

                            <View style={{
                                flex: 1, flexDirection: 'row', alignItems: 'center',
                                backgroundColor: theme.dangerBg, borderRadius: radii.pill,
                                paddingHorizontal: spacing.s14, height: 44, gap: spacing.s10,
                            }}>
                                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.danger }} />
                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13, color: theme.danger }}>
                                    {formatRecordingTime(recordingDuration)}
                                </Text>
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.danger, opacity: 0.8 }}>
                                    Grabando…
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={stopRecording}
                                style={{
                                    width: 42, height: 42, borderRadius: 14,
                                    backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center',
                                }}
                                accessibilityLabel="Guardar la nota de voz"
                            >
                                <Ionicons name="checkmark" size={24} color={theme.white} />
                            </TouchableOpacity>
                        </>
                    )}

                    {!isRecording && (
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
                    )}
                    {/* Con el campo vacío el botón graba; al escribir pasa a
                        guardar. La barra no crece con dos botones que nunca
                        sirven a la vez. */}
                    {!isRecording && (newNote.trim() === '' ? (
                        <TouchableOpacity
                            onPress={handleStartVoiceNote}
                            disabled={isUploadingVoice}
                            style={{
                                width: 42, height: 42, borderRadius: 14,
                                backgroundColor: plan === 'premium' ? theme.primary : theme.surfaceAlt,
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {isUploadingVoice ? (
                                <ActivityIndicator size="small" color={plan === 'premium' ? theme.white : theme.textFaint} />
                            ) : (
                                <Ionicons
                                    name={plan === 'premium' ? 'mic' : 'lock-closed'}
                                    size={plan === 'premium' ? 22 : 18}
                                    color={plan === 'premium' ? theme.white : theme.textFaint}
                                />
                            )}
                        </TouchableOpacity>
                    ) : (
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
                    ))}
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
                        {/* Las tres son escrituras, y las reglas de Firestore solo
                            dejan actualizar una nota a quien la escribió. */}
                        {contextMenuNote?.authorId === user.uid && (
                            <>
                                <ContextMenuRow
                                    icon="create-outline"
                                    label="Editar"
                                    onPress={() => {
                                        if (contextMenuNote) openEditModal(contextMenuNote);
                                        setContextMenuNote(null);
                                    }}
                                />
                                <ContextMenuRow
                                    icon={contextMenuNote?.archived ? 'arrow-undo-outline' : 'archive-outline'}
                                    label={contextMenuNote?.archived ? 'Devolver al muro' : 'Archivar'}
                                    onPress={() => {
                                        if (contextMenuNote) handleToggleArchived(contextMenuNote);
                                        setContextMenuNote(null);
                                    }}
                                />
                                <ContextMenuRow
                                    icon="trash-outline"
                                    label="Eliminar"
                                    color={theme.danger}
                                    onPress={() => {
                                        setDeletingNoteId(contextMenuNote?.id ?? null);
                                        setContextMenuNote(null);
                                    }}
                                />
                            </>
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

            <PaywallSheet
                visible={isPaywallVisible}
                onClose={() => setIsPaywallVisible(false)}
                onUpgradePress={() => { setIsPaywallVisible(false); router.push('/(tabs)/config'); }}
                icon="document-text"
                title="Notas ilimitadas"
                description={`El plan free deja ${FREE_LIMIT} notas en el muro y guarda las ${ARCHIVE_FREE_VISIBLE} archivadas más recientes. Archivar libera espacio sin borrar nada.`}
                benefits={['Notas ilimitadas en el muro', 'Archivo completo, sin perder ninguna', 'Historial completo del chat']}
            />
        </SafeAreaView>
    );
};

export default NotesScreen;
