import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, SectionList, ScrollView,
    TouchableOpacity, Modal, TextInput, Alert, Linking, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { themes } from '../../src/config/theme';
import { db } from '../../src/config/firebaseConfig';
import {
    collection, addDoc, onSnapshot, Timestamp, query, doc,
    serverTimestamp, updateDoc, orderBy, deleteDoc, limit
} from 'firebase/firestore';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

// --- Constantes ---
const WISH_TYPES = ['Aniversario', 'Cumpleaños', 'Navidad', 'San Valentín', 'Solo porque sí', 'Otro'];

// --- Estilos ---
const getStyles = (theme: typeof themes.light, fontFamily: string | undefined) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20, fontFamily: fontFamily },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50, fontFamily: fontFamily },
    
    // Lista
    sectionHeader: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.primary,
        backgroundColor: theme.background,
        paddingTop: 20,
        paddingBottom: 10,
        fontFamily: fontFamily,
    },
    itemContainer: {
        backgroundColor: theme.inputBackground,
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderColor: theme.borderColor,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemContent: {
        flex: 1,
        marginLeft: 15,
    },
    itemTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.text,
        fontFamily: fontFamily,
    },
    itemLink: {
        fontSize: 13,
        color: theme.link,
        fontFamily: fontFamily,
        marginTop: 4,
    },
    itemType: {
        fontSize: 12,
        color: theme.placeholder,
        fontFamily: fontFamily,
        marginTop: 6,
        fontStyle: 'italic',
    },
    itemActions: {
        flexDirection: 'row',
        gap: 8,
        marginLeft: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 6,
        backgroundColor: theme.placeholder + '20',
    },
    deleteButton: {
        backgroundColor: '#FF525220',
    },
    
    // Checkbox
    checkbox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        borderColor: theme.placeholder,
    },
    checkboxInner: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: theme.primary,
    },
    checkboxInnerChecked: {
        backgroundColor: theme.placeholder,
    },
    itemTitleChecked: {
        textDecorationLine: 'line-through',
        color: theme.placeholder,
    },

    // FAB (Botón de Añadir)
    fab: {
        position: 'absolute',
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    
    // Modal
    modalOverlay: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: 'rgba(0, 0, 0, 0.6)' 
    },
    modalContainer: { 
        width: '90%', 
        maxHeight: '80%', 
        backgroundColor: theme.background, 
        borderRadius: 20, 
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modalTitle: { 
        fontSize: 20, 
        fontWeight: 'bold', 
        color: theme.text, 
        marginBottom: 20, 
        textAlign: 'center', 
        fontFamily: fontFamily 
    },
    modalInput: { 
        minHeight: 50, 
        width: '100%', 
        borderColor: theme.borderColor, 
        borderWidth: 1, 
        borderRadius: 8, 
        padding: 10, 
        fontSize: 16, 
        color: theme.text, 
        backgroundColor: theme.inputBackground, 
        marginBottom: 15, 
        fontFamily: fontFamily 
    },
    modalLabel: { 
        fontSize: 16, 
        color: theme.placeholder, 
        marginBottom: 8, 
        fontFamily: fontFamily 
    },
    pickerContainer: { 
        borderWidth: 1, 
        borderColor: theme.borderColor, 
        borderRadius: 8, 
        marginBottom: 20, 
        backgroundColor: theme.inputBackground 
    },
    picker: { color: theme.text },
    modalButtons: { 
        flexDirection: 'row', 
        justifyContent: 'space-around', 
        width: '100%', 
        marginTop: 10 
    },
    modalButton: {
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
        minWidth: 100,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: theme.placeholder + '30',
    },
    saveButton: {
        backgroundColor: theme.primary,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: fontFamily,
    },
    cancelButtonText: {
        color: theme.text,
    },
    saveButtonText: {
        color: theme.white,
    },
    
    // Filtro
    filterContainer: {
        marginBottom: 10,
        padding: 10,
        backgroundColor: theme.inputBackground,
        borderRadius: 8,
    },
    filterLabel: {
        fontSize: 14,
        color: theme.placeholder,
        fontFamily: fontFamily,
        marginBottom: 5,
        textAlign: 'center'
    },
    
    // Feedback visual
    successFeedback: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        backgroundColor: '#4CAF50',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 1000,
    },
    errorFeedback: {
        position: 'absolute',
        top: 50,
        left: 20,
        right: 20,
        backgroundColor: '#F44336',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 1000,
    },
    feedbackText: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
        marginLeft: 12,
        flex: 1,
        fontFamily: fontFamily,
    },
});

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

// Componente de Feedback Visual
const FeedbackMessage: React.FC<{
    message: string;
    type: 'success' | 'error';
    visible: boolean;
}> = ({ message, type, visible }) => {
    const [fadeAnim] = useState(new Animated.Value(0));
    const { theme, fontFamily } = useTheme();
    const styles = getStyles(theme, fontFamily);

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.delay(2000),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    return (
        <Animated.View
            style={[
                type === 'success' ? styles.successFeedback : styles.errorFeedback,
                { opacity: fadeAnim }
            ]}
        >
            <Ionicons
                name={type === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color="#FFF"
            />
            <Text style={styles.feedbackText}>{message}</Text>
        </Animated.View>
    );
};

const WishlistScreen: React.FC = () => {
    const router = useRouter();
    const { plan, user, userData, partnerData, isLoading } = usePlan();
    const { theme, fontFamily } = useTheme();
    const styles = getStyles(theme, fontFamily);

    const [allItems, setAllItems] = useState<WishItem[]>([]);
    const [filterType, setFilterType] = useState<string>('Todos');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingItem, setEditingItem] = useState<WishItem | null>(null);
    
    // Estados del Modal
    const [newTitle, setNewTitle] = useState('');
    const [newLink, setNewLink] = useState('');
    const [newType, setNewType] = useState(WISH_TYPES[0]);

    // Feedback visual
    const [feedback, setFeedback] = useState<{
        visible: boolean;
        message: string;
        type: 'success' | 'error';
    }>({
        visible: false,
        message: '',
        type: 'success',
    });

    // Función para mostrar feedback
    const showFeedback = (message: string, type: 'success' | 'error') => {
        setFeedback({ visible: true, message, type });
        setTimeout(() => {
            setFeedback({ visible: false, message: '', type: 'success' });
        }, 2500);
    };

    // Cargar la lista de deseos. Depende del uid de la pareja (string
    // plano), no de 'userData' completo, para no resuscribirse de más ante
    // cambios ajenos (ánimo, isOnline, etc.).
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
            showFeedback('Error al cargar la lista', 'error');
        });

        return () => unsubscribe();
    }, [user, partnerId]);

    // Lógica para separar y filtrar las listas
    const sectionData = useMemo(() => {
        if (!user || !partnerData) return [];

        let partnerList = allItems.filter(item => item.authorId === partnerData.uid);
        let myList = allItems.filter(item => item.authorId === user.uid);

        if (filterType !== 'Todos') {
            partnerList = partnerList.filter(item => item.type === filterType);
            myList = myList.filter(item => item.type === filterType);
        }

        return [
            { title: `Lista de ${partnerData.displayName}`, data: partnerList },
            { title: "Mi Lista", data: myList },
        ];
    }, [allItems, user, partnerData, filterType]);

    // --- Manejadores ---

    const openAddItemModal = () => {
        // Paywall Check
        if (plan === 'free' && allItems.length >= 10) {
            Alert.alert(
                "Límite Gratuito Alcanzado",
                "Has alcanzado el límite de 10 deseos. ¡Actualiza a Conexión Total para deseos ilimitados!",
                [
                    { text: "OK" },
                    { text: "Actualizar", onPress: () => router.push('/(tabs)/config') }
                ]
            );
            return;
        }
        
        // Resetear y abrir modal
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
        if (!user || !userData || !userData.partnerId) {
            Alert.alert('Error', 'No se pudo obtener la información del usuario');
            return;
        }
        
        if (newTitle.trim() === '') {
            showFeedback('El título no puede estar vacío', 'error');
            return;
        }

        setIsSaving(true);
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const wishlistRef = collection(db, 'relationships', chatId, 'wishlist');

        try {
            if (editingItem) {
                // Actualizar item existente
                const itemRef = doc(db, 'relationships', chatId, 'wishlist', editingItem.id);
                await updateDoc(itemRef, {
                    title: newTitle.trim(),
                    link: newLink.trim() || null,
                    type: newType,
                });
                showFeedback('Deseo actualizado', 'success');
            } else {
                // Crear nuevo item
                const docData = {
                    title: newTitle.trim(),
                    link: newLink.trim() || null,
                    type: newType,
                    authorId: user.uid,
                    authorName: userData.displayName || 'Usuario',
                    isCompleted: false,
                    createdAt: serverTimestamp(),
                };
                
                await addDoc(wishlistRef, docData);
                showFeedback('Deseo añadido', 'success');
            }
            
            setIsModalVisible(false);
            setNewTitle('');
            setNewLink('');
            setNewType(WISH_TYPES[0]);
            setEditingItem(null);
        } catch (error) {
            console.error("Error saving wish: ", error);
            showFeedback('Error al guardar el deseo', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleItem = async (item: WishItem) => {
        if (!user || !userData?.partnerId) return;
        
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const itemRef = doc(db, 'relationships', chatId, 'wishlist', item.id);

        try {
            await updateDoc(itemRef, {
                isCompleted: !item.isCompleted
            });
            // No mostrar feedback para toggle, es acción silenciosa
        } catch (error) {
            console.error("Error toggling item: ", error);
            showFeedback('Error al actualizar', 'error');
        }
    };

    const handleDeleteItem = (item: WishItem) => {
        // Solo el autor puede eliminar
        if (item.authorId !== user?.uid) {
            showFeedback('Solo puedes eliminar tus propios deseos', 'error');
            return;
        }

        Alert.alert(
            "Eliminar Deseo",
            `¿Estás seguro de que quieres eliminar "${item.title}"?`,
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Eliminar", 
                    style: "destructive",
                    onPress: async () => {
                        if (!userData?.partnerId) return;
                        
                        const chatId = [user!.uid, userData.partnerId].sort().join('_');
                        const itemRef = doc(db, 'relationships', chatId, 'wishlist', item.id);

                        try {
                            await deleteDoc(itemRef);
                            showFeedback('Deseo eliminado', 'success');
                        } catch (error) {
                            console.error("Error deleting item: ", error);
                            showFeedback('Error al eliminar', 'error');
                        }
                    }
                }
            ]
        );
    };

    const handleLinkPress = (link: string) => {
        let url = link;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        Linking.openURL(url).catch(() => 
            showFeedback('No se pudo abrir el enlace', 'error')
        );
    };

    // --- Renderizado ---

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }
    
    if (!userData?.partnerId) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.container, {justifyContent: 'center'}]}>
                    <Text style={styles.title}>Lista de Deseos</Text>
                    <Text style={styles.placeholderText}>
                        Conéctate con tu pareja para crear su lista de deseos.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Text style={styles.title}>Lista de Deseos</Text>

                {/* Filtro */}
                <View style={styles.filterContainer}>
                    <Text style={styles.filterLabel}>Filtrar por categoría</Text>
                    <Picker
                        selectedValue={filterType}
                        onValueChange={(itemValue) => setFilterType(itemValue)}
                        style={styles.picker}
                    >
                        <Picker.Item label="Ver Todos" value="Todos" />
                        {WISH_TYPES.map(type => (
                            <Picker.Item key={type} label={type} value={type} />
                        ))}
                    </Picker>
                </View>

                {/* Lista de Deseos */}
                <SectionList
                    sections={sectionData}
                    keyExtractor={(item) => item.id}
                    renderSectionHeader={({ section: { title } }) => (
                        <Text style={styles.sectionHeader}>{title}</Text>
                    )}
                    renderItem={({ item }) => {
                        const isOwner = item.authorId === user?.uid;
                        
                        return (
                            <View style={styles.itemContainer}>
                                <TouchableOpacity
                                    style={[styles.checkbox, item.isCompleted && styles.checkboxChecked]}
                                    onPress={() => handleToggleItem(item)}
                                >
                                    {item.isCompleted && (
                                        <View style={[styles.checkboxInner, styles.checkboxInnerChecked]} />
                                    )}
                                </TouchableOpacity>
                                
                                <View style={styles.itemContent}>
                                    <Text style={[styles.itemTitle, item.isCompleted && styles.itemTitleChecked]}>
                                        {item.title}
                                    </Text>
                                    {item.link && (
                                        <TouchableOpacity onPress={() => handleLinkPress(item.link!)}>
                                            <Text style={styles.itemLink} numberOfLines={1}>
                                                {item.link}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    <Text style={styles.itemType}>{item.type}</Text>
                                </View>

                                {/* Botones de acción - solo para el dueño */}
                                {isOwner && (
                                    <View style={styles.itemActions}>
                                        <TouchableOpacity
                                            style={styles.actionButton}
                                            onPress={() => openEditItemModal(item)}
                                        >
                                            <Ionicons name="pencil" size={18} color={theme.text} />
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => handleDeleteItem(item)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={styles.placeholderText}>
                            Aún no hay deseos en esta lista.
                        </Text>
                    }
                />
            </View>

            {/* Botón Flotante de Añadir */}
            <TouchableOpacity style={styles.fab} onPress={openAddItemModal}>
                <Ionicons name="add" size={32} color={theme.white} />
            </TouchableOpacity>

            {/* Modal para Añadir/Editar Deseo */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isModalVisible}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>
                                {editingItem ? 'Editar Deseo' : 'Añadir un Deseo'}
                            </Text>
                            
                            <Text style={styles.modalLabel}>Nombre del Deseo</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="Ej. Bolso SHEIN, Airpods Pro..."
                                placeholderTextColor={theme.placeholder}
                                value={newTitle}
                                onChangeText={setNewTitle}
                                editable={!isSaving}
                            />
                            
                            <Text style={styles.modalLabel}>Enlace (Opcional)</Text>
                            <TextInput
                                style={styles.modalInput}
                                placeholder="https://..."
                                placeholderTextColor={theme.placeholder}
                                value={newLink}
                                onChangeText={setNewLink}
                                autoCapitalize="none"
                                keyboardType="url"
                                editable={!isSaving}
                            />
                            
                            <Text style={styles.modalLabel}>Categoría</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={newType}
                                    onValueChange={(itemValue) => setNewType(itemValue)}
                                    style={styles.picker}
                                    enabled={!isSaving}
                                >
                                    {WISH_TYPES.map(type => (
                                        <Picker.Item key={type} label={type} value={type} />
                                    ))}
                                </Picker>
                            </View>

                            <View style={styles.modalButtons}>
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => {
                                        setIsModalVisible(false);
                                        setEditingItem(null);
                                    }}
                                    disabled={isSaving}
                                >
                                    <Text style={[styles.buttonText, styles.cancelButtonText]}>
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={handleSaveItem}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator size="small" color={theme.white} />
                                    ) : (
                                        <Text style={[styles.buttonText, styles.saveButtonText]}>
                                            {editingItem ? 'Actualizar' : 'Guardar'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Feedback Visual - Reemplazo de Toast */}
            <FeedbackMessage
                message={feedback.message}
                type={feedback.type}
                visible={feedback.visible}
            />
        </SafeAreaView>
    );
};

export default WishlistScreen;