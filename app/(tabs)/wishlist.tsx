// Sprint 7.6a — re-skin de Deseos según el sistema de diseño: chips de
// filtro, secciones por persona con avatar+inicial, badges de tipo y de
// "regalado", FAB, menú contextual flotante y paywall inline al llegar a
// 10 ítems (contando ambas listas).
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, SectionList, ScrollView,
    TouchableOpacity, Modal, TextInput, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { radii, shadows, spacing } from '../../src/config/theme';
import { db } from '../../src/config/firebaseConfig';
import {
    collection, addDoc, onSnapshot, Timestamp, query, doc,
    serverTimestamp, updateDoc, orderBy, deleteDoc, limit,
} from 'firebase/firestore';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button } from '../../src/components/Button';
import { EmptyState } from '../../src/components/EmptyState';
import { ConfirmDestructiveModal } from '../../src/components/ConfirmDestructiveModal';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { ContextMenuRow } from '../../src/components/ContextMenuRow';
import { useResponsive } from '../../src/hooks/useResponsive';

const WISH_TYPES = ['Aniversario', 'Cumpleaños', 'Navidad', 'San Valentín', 'Solo porque sí', 'Otro'];
const FREE_LIMIT = 10;
// Colores de avatar por persona (handoff) — no varían entre claro/oscuro.
const PARTNER_AVATAR = { bg: '#FFE9EF', text: '#C2374F' };
const GIFTED_BADGE = { bg: '#E6F3EA', text: '#2E6B47' };

interface WishItem {
    id: string;
    title: string;
    link?: string;
    type: string;
    authorId: string;
    authorName: string;
    isCompleted: boolean;
    createdAt: Timestamp;
}

const WishlistScreen: React.FC = () => {
    const router = useRouter();
    const { plan, user, userData, partnerData, isLoading } = usePlan();
    const { theme, isDarkMode: isDark, fontFamilies, borderStyle } = useTheme();
    const { isDesktop } = useResponsive();

    const [allItems, setAllItems] = useState<WishItem[]>([]);
    const [filterType, setFilterType] = useState<string>('Todos');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItem, setEditingItem] = useState<WishItem | null>(null);
    const [isPaywallVisible, setIsPaywallVisible] = useState(false);
    const [contextMenuItem, setContextMenuItem] = useState<WishItem | null>(null);
    const [deletingItem, setDeletingItem] = useState<WishItem | null>(null);

    const [newTitle, setNewTitle] = useState('');
    const [newLink, setNewLink] = useState('');
    const [newType, setNewType] = useState(WISH_TYPES[0]);

    const partnerId = userData?.partnerId as string | undefined;

    useEffect(() => {
        if (!user || !partnerId) {
            setAllItems([]);
            return;
        }

        const chatId = [user.uid, partnerId].sort().join('_');
        const wishlistRef = collection(db, 'relationships', chatId, 'wishlist');
        const q = query(wishlistRef, orderBy('createdAt', 'desc'), limit(200));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WishItem)));
        }, (error) => {
            console.error("Error fetching wishlist: ", error);
            Toast.show({ type: 'error', text1: 'Error al cargar la lista' });
        });

        return () => unsubscribe();
    }, [user, partnerId]);

    const sectionData = useMemo(() => {
        if (!user || !partnerData) return [];

        let partnerList = allItems.filter(item => item.authorId === partnerId);
        let myList = allItems.filter(item => item.authorId === user.uid);

        if (filterType !== 'Todos') {
            partnerList = partnerList.filter(item => item.type === filterType);
            myList = myList.filter(item => item.type === filterType);
        }

        return [
            { title: partnerData.displayName || 'Pareja', initial: (partnerData.displayName || '?').charAt(0).toUpperCase(), isMine: false, data: partnerList },
            { title: 'Mi lista', initial: (userData?.displayName || '?').charAt(0).toUpperCase(), isMine: true, data: myList },
        ];
    }, [allItems, user, partnerData, partnerId, filterType, userData?.displayName]);

    const limitReached = plan === 'free' && allItems.length >= FREE_LIMIT;

    const openAddItemModal = () => {
        if (limitReached) {
            setIsPaywallVisible(true);
            return;
        }
        setEditingItem(null);
        setNewTitle('');
        setNewLink('');
        setNewType(WISH_TYPES[0]);
        setIsModalVisible(true);
    };

    const openEditItemModal = (item: WishItem) => {
        setEditingItem(item);
        setNewTitle(item.title);
        setNewLink(item.link || '');
        setNewType(item.type);
        setIsModalVisible(true);
    };

    const handleSaveItem = async () => {
        if (!user || !userData || !userData.partnerId) return;

        if (newTitle.trim() === '') {
            Toast.show({ type: 'error', text1: 'El título no puede estar vacío' });
            return;
        }

        setIsSaving(true);
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const wishlistRef = collection(db, 'relationships', chatId, 'wishlist');

        try {
            if (editingItem) {
                const itemRef = doc(db, 'relationships', chatId, 'wishlist', editingItem.id);
                await updateDoc(itemRef, {
                    title: newTitle.trim(),
                    link: newLink.trim() || null,
                    type: newType,
                });
                Toast.show({ type: 'success', text1: 'Deseo actualizado' });
            } else {
                await addDoc(wishlistRef, {
                    title: newTitle.trim(),
                    link: newLink.trim() || null,
                    type: newType,
                    authorId: user.uid,
                    authorName: userData.displayName || 'Usuario',
                    isCompleted: false,
                    createdAt: serverTimestamp(),
                });
                Toast.show({ type: 'success', text1: 'Deseo añadido' });
            }

            setIsModalVisible(false);
            setEditingItem(null);
        } catch (error) {
            console.error("Error saving wish: ", error);
            Toast.show({ type: 'error', text1: 'Error al guardar el deseo' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleItem = async (item: WishItem) => {
        if (!user || !userData?.partnerId) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const itemRef = doc(db, 'relationships', chatId, 'wishlist', item.id);
        try {
            await updateDoc(itemRef, { isCompleted: !item.isCompleted });
        } catch (error) {
            console.error("Error toggling item: ", error);
            Toast.show({ type: 'error', text1: 'Error al actualizar' });
        }
    };

    const confirmDeleteItem = useCallback(async () => {
        if (!deletingItem || !user || !userData?.partnerId) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const itemRef = doc(db, 'relationships', chatId, 'wishlist', deletingItem.id);
        try {
            await deleteDoc(itemRef);
            Toast.show({ type: 'success', text1: 'Deseo eliminado' });
        } catch (error) {
            console.error("Error deleting item: ", error);
            Toast.show({ type: 'error', text1: 'Error al eliminar' });
        }
        setDeletingItem(null);
    }, [deletingItem, user, userData]);

    const handleLinkPress = (link: string) => {
        let url = link;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: 'No se pudo abrir el enlace' }));
    };

    // --- Renderizado ---

    if (isLoading) {
        return <FullScreenLoader />;
    }

    if (!userData?.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
                <EmptyState
                    icon="gift-outline"
                    title="Nada que desear... aún"
                    message="Conéctate con tu pareja para crear su lista de deseos."
                    onConnectPress={() => router.push('/(tabs)/home')}
                />
            </SafeAreaView>
        );
    }

    const contextMenuDepth = isDark
        ? { borderWidth: 1, borderColor: theme.border }
        : shadows.contextMenu;

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <View style={{ paddingHorizontal: spacing.s22, paddingTop: spacing.s16, paddingBottom: spacing.s10 }}>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.text }}>Deseos</Text>
                <Text style={{
                    fontFamily: fontFamilies.bodySemiBold,
                    fontSize: 12,
                    color: limitReached ? theme.premium : theme.textMuted,
                    marginTop: spacing.s4,
                }}>
                    {plan === 'free'
                        ? (limitReached ? `${allItems.length} de ${FREE_LIMIT} ítems · límite alcanzado` : `${allItems.length} de ${FREE_LIMIT} ítems del plan free`)
                        : `${allItems.length} ítems`}
                </Text>
            </View>

            {/* Filtro horizontal de categorías */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: spacing.s22, gap: spacing.s8, paddingBottom: spacing.s10, alignItems: 'center' }}
            >
                {['Todos', ...WISH_TYPES].map(type => {
                    const active = filterType === type;
                    return (
                        <TouchableOpacity
                            key={type}
                            onPress={() => setFilterType(type)}
                            style={{
                                paddingHorizontal: spacing.s14,
                                paddingVertical: spacing.s8,
                                borderRadius: radii.pill,
                                backgroundColor: active ? theme.primary : theme.surface,
                                borderWidth: active ? 0 : 1,
                                borderColor: theme.borderSoft,
                            }}
                        >
                            <Text style={{
                                fontFamily: fontFamilies.bodyBold,
                                fontSize: 12,
                                color: active ? theme.white : theme.textMuted,
                            }}>
                                {type}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <SectionList
                style={{ flex: 1, minHeight: 0 }}
                contentContainerStyle={{ paddingHorizontal: spacing.s22, paddingBottom: 140 }}
                sections={sectionData}
                keyExtractor={(item) => item.id}
                stickySectionHeadersEnabled={false}
                renderSectionHeader={({ section }) => (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, marginTop: spacing.s16, marginBottom: spacing.s10 }}>
                        <View style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: section.isMine ? theme.primarySoft : PARTNER_AVATAR.bg,
                        }}>
                            <Text style={{
                                fontFamily: fontFamilies.bodyBold,
                                fontSize: 12,
                                color: section.isMine ? theme.primary : PARTNER_AVATAR.text,
                            }}>
                                {section.initial}
                            </Text>
                        </View>
                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 13.5, color: theme.text }}>
                            {section.title}
                        </Text>
                        <View style={{ flex: 1, height: 1, backgroundColor: theme.divider }} />
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                            {section.data.length}
                        </Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onLongPress={() => setContextMenuItem(item)}
                        delayLongPress={400}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: spacing.s12,
                            backgroundColor: theme.surface,
                            borderRadius: 18,
                            padding: 15,
                            marginBottom: spacing.s10,
                            opacity: item.isCompleted ? 0.7 : 1,
                            // Sprint 8.6: estilo de borde de la pareja (probador de tema) —
                            // solo el borde, nunca el radio (la fila ya tiene el suyo propio).
                            ...(borderStyle.key !== 'default' ? {
                                borderWidth: borderStyle.borderWidth,
                                borderColor: borderStyle.borderColor,
                                borderStyle: borderStyle.dashed ? 'dashed' : 'solid',
                            } : null),
                        }}
                    >
                        <View style={{ flex: 1, gap: spacing.s6 }}>
                            <Text style={{
                                fontFamily: fontFamilies.bodySemiBold,
                                fontSize: 15,
                                color: theme.text,
                                textDecorationLine: item.isCompleted ? 'line-through' : 'none',
                            }}>
                                {item.title}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, flexWrap: 'wrap' }}>
                                <View style={{
                                    backgroundColor: theme.primaryTint,
                                    borderRadius: 8,
                                    paddingVertical: 3,
                                    paddingHorizontal: 8,
                                }}>
                                    <Text style={{ fontFamily: fontFamilies.bodyExtraBold, fontSize: 10, color: theme.primary }}>
                                        {item.type.toUpperCase()}
                                    </Text>
                                </View>
                                {item.isCompleted && (
                                    <View style={{ backgroundColor: GIFTED_BADGE.bg, borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 }}>
                                        <Text style={{ fontFamily: fontFamilies.bodyExtraBold, fontSize: 10, color: GIFTED_BADGE.text }}>
                                            REGALADO
                                        </Text>
                                    </View>
                                )}
                            </View>
                            {!!item.link && (
                                <TouchableOpacity onPress={() => handleLinkPress(item.link!)}>
                                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 15, color: theme.link }} numberOfLines={1}>
                                        {item.link}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => handleToggleItem(item)}
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 14,
                                borderWidth: 2,
                                borderColor: item.isCompleted ? theme.primary : theme.borderStrong,
                                backgroundColor: item.isCompleted ? theme.primary : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {item.isCompleted && <Ionicons name="checkmark" size={17} color={theme.white} />}
                        </TouchableOpacity>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textFaint, textAlign: 'center', marginTop: spacing.s26 }}>
                        Aún no hay deseos en esta lista.
                    </Text>
                }
                ListFooterComponent={
                    limitReached ? (
                        <View style={{
                            borderWidth: 1,
                            borderStyle: 'dashed',
                            borderColor: theme.primary,
                            backgroundColor: theme.primaryTint,
                            borderRadius: radii.card,
                            padding: spacing.s16,
                            marginTop: spacing.s10,
                            gap: spacing.s8,
                        }}>
                            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 14, color: theme.text }}>
                                Desbloquea deseos ilimitados
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textFaint, textDecorationLine: 'line-through' }}>
                                    US$9.99
                                </Text>
                                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 13, color: theme.premium }}>
                                    US$2.99 · -70% HOY
                                </Text>
                            </View>
                            <Button title="Desbloquear" onPress={() => setIsPaywallVisible(true)} style={{ marginTop: spacing.s4 }} />
                        </View>
                    ) : null
                }
            />

            {/* FAB — en escritorio no hay tab bar que despejar abajo */}
            <TouchableOpacity
                onPress={openAddItemModal}
                style={{
                    position: 'absolute',
                    right: 20,
                    bottom: isDesktop ? 24 : 118,
                    width: 58,
                    height: 58,
                    borderRadius: 20,
                    backgroundColor: theme.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(isDark ? { borderWidth: 1, borderColor: theme.border } : shadows.fab),
                }}
            >
                <Ionicons name={limitReached ? 'lock-closed' : 'add'} size={28} color={theme.white} />
            </TouchableOpacity>
            </DesktopContentWrap>

            {/* Menú contextual flotante — Editar (ambos) / Eliminar (solo autor) */}
            <Modal visible={!!contextMenuItem} transparent animationType="fade" onRequestClose={() => setContextMenuItem(null)}>
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.35)', justifyContent: 'center', alignItems: 'center' }}
                    activeOpacity={1}
                    onPress={() => setContextMenuItem(null)}
                >
                    <View style={{ backgroundColor: theme.surface, borderRadius: 14, paddingVertical: spacing.s8, minWidth: 190, ...contextMenuDepth }}>
                        <ContextMenuRow
                            icon="create-outline"
                            label="Editar"
                            onPress={() => {
                                if (contextMenuItem) openEditItemModal(contextMenuItem);
                                setContextMenuItem(null);
                            }}
                        />
                        {contextMenuItem?.authorId === user?.uid && (
                            <ContextMenuRow
                                icon="trash-outline"
                                label="Eliminar"
                                color={theme.danger}
                                onPress={() => {
                                    setDeletingItem(contextMenuItem);
                                    setContextMenuItem(null);
                                }}
                            />
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Modal para añadir/editar deseo */}
            <Modal animationType="fade" transparent visible={isModalVisible} onRequestClose={() => setIsModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.s20 }}>
                    <View style={{ backgroundColor: theme.surface, borderRadius: radii.cardLg, padding: spacing.s22, width: '100%', maxWidth: 400, gap: spacing.s14 }}>
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, color: theme.text }}>
                            {editingItem ? 'Editar deseo' : 'Añadir un deseo'}
                        </Text>

                        <TextInput
                            style={{
                                height: 50,
                                borderWidth: 1,
                                borderColor: theme.borderSoft,
                                borderRadius: radii.field,
                                paddingHorizontal: spacing.s16 - 1,
                                color: theme.text,
                                fontFamily: fontFamilies.body,
                                fontSize: 15,
                                backgroundColor: theme.inputBackground,
                            }}
                            placeholder="Ej. Bolso, Airpods Pro…"
                            placeholderTextColor={theme.textFaint}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            editable={!isSaving}
                        />

                        <TextInput
                            style={{
                                height: 50,
                                borderWidth: 1,
                                borderColor: theme.borderSoft,
                                borderRadius: radii.field,
                                paddingHorizontal: spacing.s16 - 1,
                                color: theme.text,
                                fontFamily: fontFamilies.body,
                                fontSize: 15,
                                backgroundColor: theme.inputBackground,
                            }}
                            placeholder="Enlace (opcional)"
                            placeholderTextColor={theme.textFaint}
                            value={newLink}
                            onChangeText={setNewLink}
                            autoCapitalize="none"
                            keyboardType="url"
                            editable={!isSaving}
                        />

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                            {WISH_TYPES.map(type => {
                                const active = newType === type;
                                return (
                                    <TouchableOpacity
                                        key={type}
                                        onPress={() => setNewType(type)}
                                        disabled={isSaving}
                                        style={{
                                            paddingHorizontal: spacing.s14,
                                            paddingVertical: spacing.s8,
                                            borderRadius: radii.pill,
                                            backgroundColor: active ? theme.primary : theme.surfaceAlt,
                                        }}
                                    >
                                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 12, color: active ? theme.white : theme.textMuted }}>
                                            {type}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={{ flexDirection: 'row', gap: spacing.s10, marginTop: spacing.s4 }}>
                            <View style={{ flex: 1 }}>
                                <Button
                                    title="Cancelar"
                                    variant="outline"
                                    disabled={isSaving}
                                    onPress={() => { setIsModalVisible(false); setEditingItem(null); }}
                                />
                            </View>
                            <View style={{ flex: 1.3 }}>
                                <Button
                                    title={editingItem ? 'Actualizar' : 'Guardar'}
                                    loading={isSaving}
                                    disabled={newTitle.trim() === ''}
                                    onPress={handleSaveItem}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            <ConfirmDestructiveModal
                visible={!!deletingItem}
                title="Eliminar deseo"
                message={deletingItem ? `Se borrará "${deletingItem.title}" para los dos.` : ''}
                onConfirm={confirmDeleteItem}
                onCancel={() => setDeletingItem(null)}
            />

            <PaywallSheet
                visible={isPaywallVisible}
                onClose={() => setIsPaywallVisible(false)}
                onUpgradePress={() => { setIsPaywallVisible(false); router.push('/(tabs)/config'); }}
                icon="gift"
                title="Deseos ilimitados"
                description="El plan free permite hasta 10 deseos entre los dos. Con Premium, sin límite."
                benefits={['Deseos ilimitados para ambos', 'Historial completo del chat', '25 GB de almacenamiento compartido']}
            />
        </SafeAreaView>
    );
};

export default WishlistScreen;
