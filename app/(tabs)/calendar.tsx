import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    Modal, TextInput, Alert, TouchableOpacity,
    ScrollView, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, onSnapshot, query, doc,
    DocumentData, serverTimestamp, Timestamp, deleteDoc, updateDoc
} from 'firebase/firestore';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import Toast from 'react-native-toast-message';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Ionicons } from '@expo/vector-icons';
import { usePlan } from '../../src/contexts/planContext';

// Configuración de idioma español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['D','L','M','X','J','V','S'],
};
LocaleConfig.defaultLocale = 'es';

// Feriados chilenos 2024-2025
const chileanHolidays: { [key: string]: string } = {
    '2024-01-01': 'Año Nuevo',
    '2024-03-29': 'Viernes Santo',
    '2024-03-30': 'Sábado Santo',
    '2024-05-01': 'Día del Trabajo',
    '2024-05-21': 'Día de las Glorias Navales',
    '2024-06-20': 'Día de los Pueblos Indígenas',
    '2024-06-29': 'San Pedro y San Pablo',
    '2024-07-16': 'Día de la Virgen del Carmen',
    '2024-08-15': 'Asunción de la Virgen',
    '2024-09-18': 'Día de la Independencia',
    '2024-09-19': 'Día de las Glorias del Ejército',
    '2024-09-20': 'Feriado adicional',
    '2024-10-12': 'Encuentro de Dos Mundos',
    '2024-10-31': 'Día de las Iglesias Evangélicas',
    '2024-11-01': 'Día de Todos los Santos',
    '2024-12-08': 'Inmaculada Concepción',
    '2024-12-25': 'Navidad',
    '2025-01-01': 'Año Nuevo',
    '2025-04-18': 'Viernes Santo',
    '2025-04-19': 'Sábado Santo',
    '2025-05-01': 'Día del Trabajo',
    '2025-05-21': 'Día de las Glorias Navales',
    '2025-06-20': 'Día de los Pueblos Indígenas',
    '2025-06-29': 'San Pedro y San Pablo',
    '2025-07-16': 'Día de la Virgen del Carmen',
    '2025-08-15': 'Asunción de la Virgen',
    '2025-09-18': 'Día de la Independencia',
    '2025-09-19': 'Día de las Glorias del Ejército',
    '2025-10-12': 'Encuentro de Dos Mundos',
    '2025-10-31': 'Día de las Iglesias Evangélicas',
    '2025-11-01': 'Día de Todos los Santos',
    '2025-12-08': 'Inmaculada Concepción',
    '2025-12-25': 'Navidad',
};

interface CalendarEvent {
    id: string;
    title: string;
    dateTime: Timestamp;
    description?: string;
    reminder: boolean;
    authorId: string;
    authorName: string;
    createdAt: Timestamp;
}

const toDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Modal de Upgrade Premium
const UpgradePremiumModal: React.FC<{
    visible: boolean;
    onClose: () => void;
}> = ({ visible, onClose }) => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{
                flex: 1,
                backgroundColor: 'rgba(0,0,0,0.7)',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 20,
            }}>
                <View style={{
                    backgroundColor: theme.background,
                    borderRadius: 20,
                    padding: 24,
                    width: '90%',
                    maxWidth: 400,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                }}>
                    {/* Icono */}
                    <View style={{
                        alignItems: 'center',
                        marginBottom: 20,
                    }}>
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: '#FFE5F0',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Ionicons name="notifications" size={40} color="#FF69B4" />
                        </View>
                    </View>

                    {/* Título */}
                    <Text style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: theme.text,
                        textAlign: 'center',
                        marginBottom: 12,
                    }}>
                        Recordatorios Premium
                    </Text>

                    {/* Descripción */}
                    <Text style={{
                        fontSize: 16,
                        color: theme.placeholder,
                        textAlign: 'center',
                        marginBottom: 20,
                        lineHeight: 24,
                    }}>
                        Los recordatorios y alarmas son una función exclusiva de Premium
                    </Text>

                    {/* Beneficios Premium */}
                    <View style={{
                        backgroundColor: colorScheme === 'dark' ? '#2A2A2A' : '#F8F8F8',
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 24,
                    }}>
                        <Text style={{
                            fontSize: 14,
                            fontWeight: '600',
                            color: theme.text,
                            marginBottom: 12,
                        }}>
                            Con Premium obtendrás:
                        </Text>
                        
                        <View style={{ gap: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: theme.text }}>
                                    Notificaciones personalizadas
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: theme.text }}>
                                    Recordatorios múltiples
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: theme.text }}>
                                    Alarmas de aniversarios
                                </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Ionicons name="checkmark-circle" size={20} color="#FF69B4" />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: theme.text }}>
                                    Nunca olvides una fecha especial
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Botones */}
                    <TouchableOpacity
                        style={{
                            backgroundColor: '#FF69B4',
                            borderRadius: 12,
                            paddingVertical: 14,
                            marginBottom: 12,
                            shadowColor: '#FF69B4',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 4,
                        }}
                        onPress={() => {
                            // TODO: Navegar a pantalla de compra Premium
                            Toast.show({
                                type: 'info',
                                text1: 'Próximamente',
                                text2: 'La pantalla de upgrade estará disponible pronto',
                            });
                            onClose();
                        }}
                    >
                        <Text style={{
                            color: '#FFF',
                            fontSize: 16,
                            fontWeight: '600',
                            textAlign: 'center',
                        }}>
                            Actualizar a Premium
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{
                            paddingVertical: 12,
                        }}
                        onPress={onClose}
                    >
                        <Text style={{
                            color: theme.placeholder,
                            fontSize: 14,
                            textAlign: 'center',
                        }}>
                            Ahora no
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 20 },
    
    // Anniversary Card
    anniversaryCard: {
        backgroundColor: theme.primary + '15',
        borderRadius: 12,
        padding: 15,
        marginVertical: 15,
        borderWidth: 2,
        borderColor: theme.primary,
        alignItems: 'center',
    },
    anniversaryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.primary,
        marginBottom: 5,
    },
    anniversaryDate: {
        fontSize: 14,
        color: theme.text,
        marginBottom: 3,
    },
    anniversaryCountdown: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.primary,
    },
    
    listHeader: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 20, marginBottom: 10 },
    sectionHeader: { fontSize: 16, fontWeight: '600', color: theme.text, marginTop: 25, marginBottom: 10 },
    eventItem: {
        backgroundColor: theme.inputBackground,
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        borderColor: theme.borderColor,
        borderWidth: 1,
    },
    eventTitle: { fontSize: 16, fontWeight: 'bold', color: theme.text },
    eventTimeText: { fontSize: 14, color: theme.text, marginTop: 5 },
    eventDescription: { fontSize: 14, color: theme.placeholder, marginTop: 5, fontStyle: 'italic' },
    eventAuthor: { fontSize: 12, fontStyle: 'italic', color: theme.placeholder, marginTop: 5 },
    eventDateBadge: {
        backgroundColor: theme.primary + '20',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginTop: 5,
    },
    eventDateText: {
        fontSize: 12,
        color: theme.primary,
        fontWeight: '600',
    },
    
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
    modalContainer: {
        width: '90%',
        maxHeight: '80%',
        backgroundColor: theme.background,
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 20, textAlign: 'center' },
    modalScrollView: { width: '100%' },
    modalSection: { marginBottom: 20, width: '100%' },
    modalLabel: { fontSize: 16, color: theme.placeholder, marginBottom: 8 },
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
        textAlignVertical: 'top',
    },
    dateTimePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.inputBackground,
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.borderColor,
    },
    dateTimePickerText: {
        fontSize: 16,
        color: theme.text,
    },
    reminderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    reminderDisabled: {
        opacity: 0.5,
    },
    premiumBadge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginLeft: 8,
    },
    premiumBadgeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#000',
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 20 },
    modalButtonsThree: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
    button: { flex: 1, marginHorizontal: 5 },
    floatingButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
});

const CalendarScreen: React.FC = () => {
    const colorScheme = useColorScheme();
    const theme = colorScheme === 'dark' ? themes.dark : themes.light;
    const styles = getStyles(theme);
    const router = useRouter();

    // Context de Plan
    const { user: contextUser, userData: contextUserData, plan, isLoading: planLoading } = usePlan();

    const [user, setUser] = useState<FirebaseUser | null>(null);
    const [userData, setUserData] = useState<DocumentData | null>(null);
    const [loading, setLoading] = useState(true);

    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));

    // Estados para el modal de evento
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventDateTime, setEventDateTime] = useState<Date>(new Date());
    const [eventReminder, setEventReminder] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    // Estados para el modal de detalles
    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

    // Estados para DateTimePicker - SOLUCIÓN AL PROBLEMA
    const [isDateTimePickerVisible, setDateTimePickerVisibility] = useState(false);
    const [dateTimePickerMode, setDateTimePickerMode] = useState<'date' | 'time'>('date');
    const [pendingDateTimeSelection, setPendingDateTimeSelection] = useState(false); // Nuevo estado

    // Estado para modal de upgrade
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    // Usar datos del contexto si están disponibles, sino usar estados locales
    useEffect(() => {
        if (contextUser) {
            setUser(contextUser);
        }
        if (contextUserData) {
            setUserData(contextUserData);
        }
    }, [contextUser, contextUserData]);

    useEffect(() => {
        if (!contextUser) {
            setLoading(true);
            const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
                if (!currentUser) {
                    setUserData(null); 
                    setAllEvents([]); 
                    setLoading(false);
                    router.replace('/login');
                }
            });
            return () => unsubscribeAuth();
        }
    }, [contextUser, router]);

    useEffect(() => {
        if (!user) return;
        let unsubscribeUser: () => void = () => {};
        let unsubscribeEvents: () => void = () => {};

        setLoading(true);
        const userDocRef = doc(db, 'users', user.uid);
        unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
            unsubscribeEvents();
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUserData(data);
                if (data.partnerId) {
                    const chatId = [user.uid, data.partnerId].sort().join('_');
                    const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');
                    const q = query(eventsCollectionRef);

                    unsubscribeEvents = onSnapshot(q, (snapshot) => {
                        const eventsList = snapshot.docs
                            .map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent))
                            .sort((a, b) => a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime());
                        setAllEvents(eventsList);
                        setLoading(false);
                    }, (error) => { console.error("Error fetching events:", error); setLoading(false); });
                } else {
                    setAllEvents([]); 
                    setLoading(false);
                }
            } else {
                auth.signOut(); 
                setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });

        return () => { unsubscribeUser(); unsubscribeEvents(); };
    }, [user]);

    // Calcular próximo aniversario
    const nextAnniversary = useMemo(() => {
        if (!userData?.relationshipStartDate) return null;
        
        const startDate = userData.relationshipStartDate.toDate();
        const today = new Date();
        const currentYear = today.getFullYear();
        
        let nextAnnivDate = new Date(currentYear, startDate.getMonth(), startDate.getDate());
        
        if (nextAnnivDate < today) {
            nextAnnivDate = new Date(currentYear + 1, startDate.getMonth(), startDate.getDate());
        }
        
        const yearsCount = nextAnnivDate.getFullYear() - startDate.getFullYear();
        const daysUntil = Math.ceil((nextAnnivDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
            date: nextAnnivDate,
            years: yearsCount,
            daysUntil: daysUntil,
        };
    }, [userData]);

    const markedDates = useMemo(() => {
        const markers: { [key: string]: any } = {};
        
        // Marcar eventos
        allEvents.forEach(event => {
            const dateString = toDateString(event.dateTime.toDate());
            markers[dateString] = { 
                marked: true, 
                dotColor: theme.primary,
                customStyles: {
                    container: {
                        backgroundColor: dateString === selectedDate ? theme.primary + '30' : 'transparent',
                    },
                    text: {
                        color: dateString === selectedDate ? theme.primary : theme.text,
                        fontWeight: dateString === selectedDate ? 'bold' : 'normal',
                    }
                }
            };
        });
        
        // Marcar feriados
        Object.keys(chileanHolidays).forEach(holiday => {
            if (!markers[holiday]) {
                markers[holiday] = {};
            }
            markers[holiday] = {
                ...markers[holiday],
                customStyles: {
                    ...markers[holiday].customStyles,
                    text: {
                        ...markers[holiday].customStyles?.text,
                        color: '#E74C3C',
                    }
                }
            };
        });
        
        // Marcar fecha de inicio de relación
        if (userData?.relationshipStartDate) {
            const startDateString = toDateString(userData.relationshipStartDate.toDate());
            if (!markers[startDateString]) {
                markers[startDateString] = {};
            }
            markers[startDateString] = {
                ...markers[startDateString],
                marked: true,
                dotColor: '#FFD700',
            };
        }
        
        // Marcar la fecha seleccionada
        if (!markers[selectedDate]) {
            markers[selectedDate] = {};
        }
        markers[selectedDate] = {
            ...markers[selectedDate],
            selected: true,
            selectedColor: theme.primary,
        };

        return markers;
    }, [allEvents, selectedDate, userData, theme]);

    const eventsForSelectedDate = useMemo(() => {
        return allEvents.filter(event => {
            const eventDateString = toDateString(event.dateTime.toDate());
            return eventDateString === selectedDate;
        });
    }, [allEvents, selectedDate]);

    const openEventModal = () => {
        setEventTitle('');
        setEventDescription('');
        setEventDateTime(new Date());
        setEventReminder(false);
        setEditingEventId(null);
        setIsEventModalVisible(true);
    };

    const openEditModal = (event: CalendarEvent) => {
        setEventTitle(event.title);
        setEventDescription(event.description || '');
        setEventDateTime(event.dateTime.toDate());
        setEventReminder(event.reminder);
        setEditingEventId(event.id);
        setIsDetailModalVisible(false);
        setIsEventModalVisible(true);
    };

    const closeEventModal = () => {
        setEventTitle('');
        setEventDescription('');
        setEventDateTime(new Date());
        setEventReminder(false);
        setIsEventModalVisible(false);
        setEditingEventId(null);
    };

    const showEventDetails = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsDetailModalVisible(true);
    };

    // SOLUCIÓN MEJORADA: Usar requestAnimationFrame para asegurar que el modal se cerró
    const showDatePicker = useCallback(() => {
        setIsEventModalVisible(false);
        setPendingDateTimeSelection(true);
        // Usar requestAnimationFrame para asegurar que el render se completó
        requestAnimationFrame(() => {
            setTimeout(() => {
                setDateTimePickerMode('date');
                setDateTimePickerVisibility(true);
            }, 200);
        });
    }, []);

    const showTimePicker = useCallback(() => {
        setIsEventModalVisible(false);
        setPendingDateTimeSelection(true);
        // Usar requestAnimationFrame para asegurar que el render se completó
        requestAnimationFrame(() => {
            setTimeout(() => {
                setDateTimePickerMode('time');
                setDateTimePickerVisibility(true);
            }, 200);
        });
    }, []);

    const hideDateTimePicker = useCallback(() => {
        setDateTimePickerVisibility(false);
        // Reabrir el modal después de cancelar
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (pendingDateTimeSelection) {
                    setIsEventModalVisible(true);
                    setPendingDateTimeSelection(false);
                }
            }, 200);
        });
    }, [pendingDateTimeSelection]);

    const handleConfirmDateTime = useCallback((date: Date) => {
        const currentEventDateTime = new Date(eventDateTime);

        if (dateTimePickerMode === 'date') {
            currentEventDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        } else {
            const minutes = date.getMinutes();
            const roundedMinutes = Math.round(minutes / 5) * 5;
            currentEventDateTime.setHours(date.getHours(), roundedMinutes, 0, 0);
        }
        
        setEventDateTime(currentEventDateTime);
        setDateTimePickerVisibility(false);
        
        // Reabrir el modal después de que el estado se actualice
        requestAnimationFrame(() => {
            setTimeout(() => {
                if (pendingDateTimeSelection) {
                    setIsEventModalVisible(true);
                    setPendingDateTimeSelection(false);
                }
            }, 200);
        });
    }, [eventDateTime, dateTimePickerMode, pendingDateTimeSelection]);

    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString);
    };

    // Manejar cambio de recordatorio con validación de plan
    const handleReminderToggle = (value: boolean) => {
        if (value && plan === 'free') {
            // Usuario free intenta activar recordatorio
            setShowUpgradeModal(true);
            return;
        }
        setEventReminder(value);
    };

    const handleAddEvent = useCallback(async () => {
        const title = eventTitle.trim();
        if (title === '' || !userData || !userData.partnerId || !user || !eventDateTime) {
            Toast.show({ type: 'error', text1: 'Por favor completa el título.' });
            return;
        }
        
        // Validar recordatorio para usuarios free
        if (eventReminder && plan === 'free') {
            Toast.show({ 
                type: 'error', 
                text1: 'Función Premium', 
                text2: 'Los recordatorios requieren Premium' 
            });
            return;
        }

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');

        try {
            if (editingEventId) {
                const eventDocRef = doc(db, 'relationships', chatId, 'events', editingEventId);
                await updateDoc(eventDocRef, {
                    title: title,
                    dateTime: Timestamp.fromDate(eventDateTime),
                    description: eventDescription.trim() || null,
                    reminder: eventReminder,
                });
                Toast.show({ type: 'success', text1: 'Evento actualizado' });
            } else {
                await addDoc(eventsCollectionRef, {
                    title: title,
                    dateTime: Timestamp.fromDate(eventDateTime),
                    description: eventDescription.trim() || null,
                    reminder: eventReminder,
                    authorId: user.uid,
                    authorName: userData.displayName || 'Usuario',
                    createdAt: serverTimestamp(),
                });
                Toast.show({ type: 'success', text1: 'Evento añadido' });
            }
            closeEventModal();
        } catch (error) {
            console.error("Error al guardar evento:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar el evento' });
        }
    }, [eventTitle, eventDescription, eventDateTime, eventReminder, userData, user, editingEventId, plan]);

    const handleDeleteEvent = (eventId: string, authorId: string) => {
        if (user?.uid !== authorId) {
            Toast.show({ type: 'error', text1: 'Solo el autor puede borrarlo' });
            return;
        }
        Alert.alert("Confirmar Eliminación", "¿Borrar este evento?",
            [ 
                { text: "Cancelar", style: "cancel" }, 
                {
                    text: "Eliminar", 
                    style: "destructive",
                    onPress: async () => {
                        if (!userData || !userData.partnerId) return;
                        const chatId = [user.uid, userData.partnerId].sort().join('_');
                        const eventDocRef = doc(db, 'relationships', chatId, 'events', eventId);
                        try { 
                            await deleteDoc(eventDocRef);
                            Toast.show({ type: 'success', text1: 'Evento eliminado' });
                            setIsDetailModalVisible(false);
                        } catch (error) { 
                            console.error("Error eliminando:", error); 
                            Toast.show({ type: 'error', text1: 'Error al eliminar' });
                        }
                    }
                }
            ]
        );
    };

    if (loading || planLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={[styles.placeholderText, { marginTop: 10 }]}>Cargando eventos...</Text>
            </View>
        );
    }

    if (!userData?.partnerId) {
        return (
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                    <Text style={styles.title}>Calendario</Text>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="calendar-outline" size={64} color={theme.placeholder} />
                        <Text style={styles.placeholderText}>
                            Conecta con tu pareja para compartir eventos
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <Text style={styles.title}>Calendario</Text>

                {/* Próximo Aniversario */}
                {nextAnniversary && (
                    <View style={styles.anniversaryCard}>
                        <Ionicons name="heart" size={32} color={theme.primary} style={{ marginBottom: 8 }} />
                        <Text style={styles.anniversaryTitle}>
                            Próximo Aniversario: {nextAnniversary.years} {nextAnniversary.years === 1 ? 'año' : 'años'}
                        </Text>
                        <Text style={styles.anniversaryDate}>
                            {nextAnniversary.date.toLocaleDateString('es-CL', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                            })}
                        </Text>
                        <Text style={styles.anniversaryCountdown}>
                            Faltan {nextAnniversary.daysUntil} {nextAnniversary.daysUntil === 1 ? 'día' : 'días'}
                        </Text>
                    </View>
                )}

                {/* Calendario */}
                <Calendar
                    current={selectedDate}
                    onDayPress={handleDayPress}
                    markedDates={markedDates}
                    markingType={'custom'}
                    theme={{
                        backgroundColor: theme.background,
                        calendarBackground: theme.background,
                        textSectionTitleColor: theme.placeholder,
                        selectedDayBackgroundColor: theme.primary,
                        selectedDayTextColor: theme.white,
                        todayTextColor: theme.primary,
                        dayTextColor: theme.text,
                        textDisabledColor: theme.placeholder + '50',
                        monthTextColor: theme.text,
                        textMonthFontWeight: 'bold',
                        textDayFontSize: 16,
                        textMonthFontSize: 18,
                    }}
                    style={{
                        borderRadius: 10,
                        marginBottom: 20,
                    }}
                />

                {/* Eventos del día seleccionado */}
                {eventsForSelectedDate.length > 0 ? (
                    <>
                        <Text style={styles.listHeader}>
                            Eventos para {new Date(selectedDate).toLocaleDateString('es-CL', { 
                                day: 'numeric', 
                                month: 'long', 
                                year: 'numeric' 
                            })}
                        </Text>
                        {eventsForSelectedDate.map((event) => (
                            <TouchableOpacity 
                                key={event.id} 
                                style={styles.eventItem}
                                onPress={() => showEventDetails(event)}
                            >
                                <Text style={styles.eventTitle}>{event.title}</Text>
                                <Text style={styles.eventTimeText}>
                                    🕐 {event.dateTime.toDate().toLocaleTimeString('es-CL', { 
                                        hour: '2-digit', 
                                        minute: '2-digit' 
                                    })}
                                </Text>
                                {event.description && (
                                    <Text style={styles.eventDescription}>{event.description}</Text>
                                )}
                                {event.reminder && plan === 'premium' && (
                                    <Text style={{ fontSize: 12, color: theme.primary, marginTop: 5 }}>
                                        🔔 Recordatorio activado
                                    </Text>
                                )}
                                <Text style={styles.eventAuthor}>Por: {event.authorName}</Text>
                            </TouchableOpacity>
                        ))}
                    </>
                ) : (
                    <Text style={styles.placeholderText}>
                        No hay eventos para esta fecha
                    </Text>
                )}

                {/* Feriado del día */}
                {chileanHolidays[selectedDate] && (
                    <View style={[styles.eventItem, { backgroundColor: '#E74C3C' + '20' }]}>
                        <Text style={[styles.eventTitle, { color: '#E74C3C' }]}>
                            🇨🇱 {chileanHolidays[selectedDate]}
                        </Text>
                    </View>
                )}

                {/* Todos los eventos próximos */}
                {allEvents.length > 0 && (
                    <>
                        <Text style={styles.sectionHeader}>Próximos Eventos</Text>
                        {allEvents
                            .filter(e => e.dateTime.toDate() >= new Date())
                            .slice(0, 5)
                            .map((event) => (
                                <TouchableOpacity 
                                    key={event.id} 
                                    style={styles.eventItem}
                                    onPress={() => showEventDetails(event)}
                                >
                                    <Text style={styles.eventTitle}>{event.title}</Text>
                                    <View style={styles.eventDateBadge}>
                                        <Text style={styles.eventDateText}>
                                            {event.dateTime.toDate().toLocaleDateString('es-CL', { 
                                                day: 'numeric', 
                                                month: 'short',
                                                year: 'numeric'
                                            })} - {event.dateTime.toDate().toLocaleTimeString('es-CL', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}
                                        </Text>
                                    </View>
                                    {event.description && (
                                        <Text style={styles.eventDescription}>{event.description}</Text>
                                    )}
                                    {event.reminder && plan === 'premium' && (
                                        <Text style={{ fontSize: 12, color: theme.primary, marginTop: 5 }}>
                                            🔔 Recordatorio activado
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                    </>
                )}

                {/* Espaciado inferior para el botón flotante */}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Botón flotante para añadir evento */}
            <TouchableOpacity 
                style={styles.floatingButton}
                onPress={openEventModal}
            >
                <Ionicons name="add" size={32} color={theme.white} />
            </TouchableOpacity>

            {/* Modal de Evento (Crear/Editar) */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isEventModalVisible}
                onRequestClose={closeEventModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                            <Text style={styles.modalTitle}>
                                {editingEventId ? "Editar Evento" : "Nuevo Evento"}
                            </Text>

                            {/* Título */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Título*</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Ej: Cita con el doctor"
                                    placeholderTextColor={theme.placeholder}
                                    value={eventTitle}
                                    onChangeText={setEventTitle}
                                />
                            </View>

                            {/* Fecha */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Fecha</Text>
                                <TouchableOpacity style={styles.dateTimePickerButton} onPress={showDatePicker}>
                                    <Text style={styles.dateTimePickerText}>
                                        {eventDateTime.toLocaleDateString('es-CL', { 
                                            day: '2-digit', 
                                            month: 'long', 
                                            year: 'numeric' 
                                        })}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={theme.placeholder} />
                                </TouchableOpacity>
                            </View>

                            {/* Hora */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Hora</Text>
                                <TouchableOpacity style={styles.dateTimePickerButton} onPress={showTimePicker}>
                                    <Text style={styles.dateTimePickerText}>
                                        {eventDateTime.toLocaleTimeString('es-CL', { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </Text>
                                    <Ionicons name="time-outline" size={20} color={theme.placeholder} />
                                </TouchableOpacity>
                            </View>

                            {/* Descripción */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Descripción (Opcional)</Text>
                                <TextInput
                                    style={[styles.modalInput, { height: 100 }]}
                                    placeholder="Añade detalles..."
                                    placeholderTextColor={theme.placeholder}
                                    value={eventDescription}
                                    onChangeText={setEventDescription}
                                    multiline={true}
                                />
                            </View>

                            {/* Recordatorio con badge Premium */}
                            <View style={[styles.modalSection, styles.reminderRow, plan === 'free' && styles.reminderDisabled]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.modalLabel}>¿Activar Recordatorio?</Text>
                                    {plan === 'free' && (
                                        <View style={styles.premiumBadge}>
                                            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                                        </View>
                                    )}
                                </View>
                                <Switch
                                    trackColor={{ false: theme.placeholder + '50', true: theme.primary + '50' }}
                                    thumbColor={eventReminder ? theme.primary : theme.placeholder}
                                    ios_backgroundColor={theme.placeholder + '30'}
                                    onValueChange={handleReminderToggle}
                                    value={eventReminder}
                                    disabled={plan === 'free'}
                                />
                            </View>

                            {plan === 'free' && (
                                <View style={styles.modalSection}>
                                    <Text style={[styles.modalLabel, { 
                                        fontStyle: 'italic', 
                                        textAlign: 'center',
                                        fontSize: 13,
                                        color: theme.placeholder
                                    }]}>
                                        💎 Actualiza a Premium para activar recordatorios
                                    </Text>
                                </View>
                            )}

                            {/* Botones */}
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        backgroundColor: 'grey',
                                        padding: 14,
                                        borderRadius: 8,
                                        marginRight: 8,
                                    }}
                                    onPress={closeEventModal}
                                >
                                    <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
                                        Cancelar
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={{
                                        flex: 1,
                                        backgroundColor: theme.primary,
                                        padding: 14,
                                        borderRadius: 8,
                                        marginLeft: 8,
                                    }}
                                    onPress={handleAddEvent}
                                >
                                    <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
                                        {editingEventId ? "Actualizar" : "Guardar"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Modal de Detalles del Evento */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={isDetailModalVisible}
                onRequestClose={() => setIsDetailModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        {selectedEvent && (
                            <ScrollView style={styles.modalScrollView}>
                                <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                                
                                <View style={styles.modalSection}>
                                    <Text style={styles.modalLabel}>Fecha y Hora</Text>
                                    <Text style={styles.dateTimePickerText}>
                                        {selectedEvent.dateTime.toDate().toLocaleDateString('es-CL', { 
                                            day: 'numeric', 
                                            month: 'long', 
                                            year: 'numeric' 
                                        })} - {selectedEvent.dateTime.toDate().toLocaleTimeString('es-CL', { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                        })}
                                    </Text>
                                </View>

                                {selectedEvent.description && (
                                    <View style={styles.modalSection}>
                                        <Text style={styles.modalLabel}>Descripción</Text>
                                        <Text style={styles.eventDescription}>{selectedEvent.description}</Text>
                                    </View>
                                )}

                                <View style={styles.modalSection}>
                                    <Text style={styles.modalLabel}>Creado por</Text>
                                    <Text style={styles.dateTimePickerText}>{selectedEvent.authorName}</Text>
                                </View>

                                {selectedEvent.reminder && plan === 'premium' && (
                                    <View style={styles.modalSection}>
                                        <Text style={styles.modalLabel}>🔔 Recordatorio activado</Text>
                                    </View>
                                )}

                                {/* Botones de acción */}
                                {user?.uid === selectedEvent.authorId ? (
                                    <View style={styles.modalButtonsThree}>
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: 'grey',
                                                padding: 12,
                                                borderRadius: 8,
                                                flex: 1,
                                                marginRight: 5,
                                            }}
                                            onPress={() => setIsDetailModalVisible(false)}
                                        >
                                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                                                Cerrar
                                            </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: theme.primary,
                                                padding: 12,
                                                borderRadius: 8,
                                                flex: 1,
                                                marginHorizontal: 5,
                                            }}
                                            onPress={() => openEditModal(selectedEvent)}
                                        >
                                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                                                Editar
                                            </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: '#E74C3C',
                                                padding: 12,
                                                borderRadius: 8,
                                                flex: 1,
                                                marginLeft: 5,
                                            }}
                                            onPress={() => handleDeleteEvent(selectedEvent.id, selectedEvent.authorId)}
                                        >
                                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>
                                                Eliminar
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={styles.modalButtons}>
                                        <TouchableOpacity
                                            style={{
                                                flex: 1,
                                                backgroundColor: theme.primary,
                                                padding: 14,
                                                borderRadius: 8,
                                            }}
                                            onPress={() => setIsDetailModalVisible(false)}
                                        >
                                            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600', fontSize: 16 }}>
                                                Cerrar
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* DateTimePicker - FUERA de otros modales */}
            <DateTimePickerModal
                isVisible={isDateTimePickerVisible}
                mode={dateTimePickerMode}
                date={eventDateTime}
                onConfirm={handleConfirmDateTime}
                onCancel={hideDateTimePicker}
                locale="es_ES"
                confirmTextIOS="Confirmar"
                cancelTextIOS="Cancelar"
                minuteInterval={5}
            />

            {/* Modal de Upgrade Premium */}
            <UpgradePremiumModal
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
            />

            <Toast />
        </SafeAreaView>
    );
};

export default CalendarScreen;