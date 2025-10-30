import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    Modal, TextInput, Button, FlatList, Alert, TouchableOpacity,
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

// Configuración de idioma español
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
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
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
    modalButtonsThree: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10, gap: 10 },
});

interface CalendarEvent {
    id: string;
    title: string;
    dateTime: Timestamp;
    description?: string;
    reminder?: boolean;
    authorId: string;
    authorName: string;
    createdAt: Timestamp;
}

const toDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const CalendarScreen: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

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

    // Estados para DateTimePicker
    const [isDateTimePickerVisible, setDateTimePickerVisibility] = useState(false);
    const [dateTimePickerMode, setDateTimePickerMode] = useState<'date' | 'time'>('date');

    // Estado para selector de mes/año
    const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
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
    }, [router]);

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
                dotColor: '#E91E63',
            };
        }
        
        // Marcar próximo aniversario
        if (nextAnniversary) {
            const annivString = toDateString(nextAnniversary.date);
            if (!markers[annivString]) {
                markers[annivString] = {};
            }
            markers[annivString] = {
                ...markers[annivString],
                marked: true,
                dotColor: '#E91E63',
            };
        }
        
        // Marcar fecha seleccionada
        if (!markers[selectedDate]) {
            markers[selectedDate] = {};
        }
        markers[selectedDate] = {
            ...markers[selectedDate],
            selected: true,
            selectedColor: theme.primary + '30',
        };
        
        return markers;
    }, [allEvents, selectedDate, theme.primary, userData, nextAnniversary]);

    const eventsForSelectedDay = useMemo(() => {
        return allEvents.filter(event => {
            const eventDateString = toDateString(event.dateTime.toDate());
            return eventDateString === selectedDate;
        }).sort((a, b) => a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime());
    }, [allEvents, selectedDate]);

    const futureEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDateObj = new Date(selectedDate);
        selectedDateObj.setHours(0, 0, 0, 0);
        
        return allEvents.filter(event => {
            const eventDate = event.dateTime.toDate();
            eventDate.setHours(0, 0, 0, 0);
            return eventDate > selectedDateObj;
        }).slice(0, 10);
    }, [allEvents, selectedDate]);

    // Abrir modal para añadir evento
    const openEventModal = () => {
        // Crear fecha basada en selectedDate
        const [year, month, day] = selectedDate.split('-').map(Number);
        const selectedDateTime = new Date(year, month - 1, day);
        const now = new Date();
        selectedDateTime.setHours(now.getHours(), Math.round(now.getMinutes() / 5) * 5, 0, 0);

        setEventDateTime(selectedDateTime);
        setEventTitle('');
        setEventDescription('');
        setEventReminder(false);
        setEditingEventId(null);
        setIsEventModalVisible(true);
    };

    // Abrir modal para editar evento
    const openEditModal = (event: CalendarEvent) => {
        setEventTitle(event.title);
        setEventDescription(event.description || '');
        setEventDateTime(event.dateTime.toDate());
        setEventReminder(event.reminder || false);
        setEditingEventId(event.id);
        setIsDetailModalVisible(false);
        setIsEventModalVisible(true);
    };

    const closeEventModal = () => {
        setIsEventModalVisible(false);
        setEditingEventId(null);
    };

    // Mostrar detalles del evento
    const showEventDetails = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsDetailModalVisible(true);
    };

    const showDatePicker = () => {
        setDateTimePickerMode('date');
        setDateTimePickerVisibility(true);
    };

    const showTimePicker = () => {
        setDateTimePickerMode('time');
        setDateTimePickerVisibility(true);
    };

    const hideDateTimePicker = () => {
        setDateTimePickerVisibility(false);
    };

    const handleConfirmDateTime = (date: Date) => {
        hideDateTimePicker();
        const currentEventDateTime = new Date(eventDateTime);

        if (dateTimePickerMode === 'date') {
            currentEventDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        } else {
            const minutes = date.getMinutes();
            const roundedMinutes = Math.round(minutes / 5) * 5;
            currentEventDateTime.setHours(date.getHours(), roundedMinutes, 0, 0);
        }
        setEventDateTime(currentEventDateTime);
    };

    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString);
    };

    // Añadir o editar evento
    const handleAddEvent = useCallback(async () => {
        const title = eventTitle.trim();
        if (title === '' || !userData || !userData.partnerId || !user || !eventDateTime) {
            Toast.show({ type: 'error', text1: 'Por favor completa el título.' });
            return;
        }
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');

        try {
            if (editingEventId) {
                // Editar evento existente
                const eventDocRef = doc(db, 'relationships', chatId, 'events', editingEventId);
                await updateDoc(eventDocRef, {
                    title: title,
                    dateTime: Timestamp.fromDate(eventDateTime),
                    description: eventDescription.trim() || null,
                    reminder: eventReminder,
                });
                Toast.show({ type: 'success', text1: 'Evento actualizado' });
            } else {
                // Crear nuevo evento
                await addDoc(eventsCollectionRef, {
                    title: title,
                    dateTime: Timestamp.fromDate(eventDateTime),
                    description: eventDescription.trim() || null,
                    reminder: eventReminder,
                    authorId: user.uid,
                    authorName: userData.displayName,
                    createdAt: serverTimestamp(),
                });
                Toast.show({ type: 'success', text1: 'Evento añadido' });
            }
            closeEventModal();
        } catch (error) {
            console.error("Error al guardar evento:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar el evento' });
        }
    }, [eventTitle, eventDescription, eventDateTime, eventReminder, userData, user, editingEventId]);

    // Eliminar evento
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
                            setIsDetailModalVisible(false);
                            Toast.show({ type: 'success', text1: 'Evento eliminado' });
                        }
                        catch (error) { 
                            Toast.show({ type: 'error', text1: 'Error al eliminar' }); 
                        }
                    }
                }
            ]
        );
    };

            {/* Selector de Mes/Año */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isMonthPickerVisible}
                onRequestClose={() => setIsMonthPickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Seleccionar Mes y Año</Text>
                        <ScrollView style={{ maxHeight: 400 }}>
                            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                                <View key={year}>
                                    <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 15, marginBottom: 10 }}>
                                        {year}
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        {['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].map((month, index) => (
                                            <TouchableOpacity
                                                key={`${year}-${index}`}
                                                style={{
                                                    backgroundColor: theme.inputBackground,
                                                    padding: 12,
                                                    borderRadius: 8,
                                                    borderWidth: 1,
                                                    borderColor: theme.borderColor,
                                                    width: '30%',
                                                }}
                                                onPress={() => {
                                                    const newDate = new Date(year, index, 1);
                                                    setCurrentMonth(newDate);
                                                    setSelectedDate(toDateString(newDate));
                                                    setIsMonthPickerVisible(false);
                                                }}
                                            >
                                                <Text style={{ color: theme.text, textAlign: 'center' }}>{month}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <View style={{ marginTop: 15 }}>
                            <Button title="Cerrar" onPress={() => setIsMonthPickerVisible(false)} color={theme.primary} />
                        </View>
                    </View>
                </View>
            </Modal>

    if (loading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.primary} /></View>;
    }

    if (userData && !userData.partnerId) {
         return (
             <SafeAreaView style={styles.safeArea}>
                <View style={styles.container}>
                     <Text style={styles.title}>Calendario</Text>
                     <Text style={styles.placeholderText}>Conéctate con tu pareja para crear un calendario compartido.</Text>
                </View>
             </SafeAreaView>
        );
    }

     if (!user || !userData) {
         return <View style={styles.loadingContainer}><Text style={{color: theme.placeholder}}>Cargando...</Text></View>;
     }

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container}>
                <Text style={styles.title}>Calendario Compartido</Text>

                {/* Próximo Aniversario */}
                {nextAnniversary && (
                    <View style={styles.anniversaryCard}>
                        <Text style={styles.anniversaryTitle}>
                            💕 {nextAnniversary.years}º Aniversario
                        </Text>
                        <Text style={styles.anniversaryDate}>
                            {nextAnniversary.date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                        <Text style={styles.anniversaryCountdown}>
                            (Faltan {nextAnniversary.daysUntil} días)
                        </Text>
                    </View>
                )}

                <Calendar
                    style={{
                        borderWidth: 1,
                        borderColor: theme.borderColor,
                        borderRadius: 8,
                    }}
                    theme={{
                        calendarBackground: theme.background,
                        textSectionTitleColor: theme.text,
                        selectedDayBackgroundColor: theme.primary,
                        selectedDayTextColor: theme.white,
                        todayTextColor: theme.primary,
                        dayTextColor: theme.text,
                        textDisabledColor: theme.placeholder,
                        dotColor: theme.primary,
                        selectedDotColor: theme.white,
                        arrowColor: theme.primary,
                        monthTextColor: theme.text,
                        textMonthFontWeight: 'bold',
                    }}
                    current={toDateString(currentMonth)}
                    onDayPress={handleDayPress}
                    markedDates={markedDates}
                    onMonthChange={(month) => {
                        setCurrentMonth(new Date(month.dateString));
                    }}
                    enableSwipeMonths={true}
                    firstDay={1}
                    renderHeader={(date) => {
                        if (!date) return null;
                        const month = typeof date === 'object' && 'toDate' in date ? date.toDate() : new Date(date as any);
                        return (
                            <TouchableOpacity onPress={() => setIsMonthPickerVisible(true)}>
                                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>
                                    {month.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                />

                {/* Botón Añadir Evento */}
                <View style={{ marginVertical: 15, width: '100%' }}>
                    <Button
                        title="Añadir Evento"
                        onPress={openEventModal}
                        color={theme.primary}
                    />
                </View>

                {/* Eventos del Día Seleccionado */}
                <Text style={styles.listHeader}>
                    Eventos del {new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}:
                </Text>
                
                {eventsForSelectedDay.length === 0 ? (
                    <Text style={styles.placeholderText}>No hay eventos para este día.</Text>
                ) : (
                    eventsForSelectedDay.map(item => {
                        const eventTime = item.dateTime.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={styles.eventItem}
                                onPress={() => showEventDetails(item)}
                            >
                                <Text style={styles.eventTitle}>{item.title}</Text>
                                <Text style={styles.eventTimeText}>Hora: {eventTime}</Text>
                                {item.description && <Text style={styles.eventDescription}>{item.description}</Text>}
                                <Text style={styles.eventAuthor}>Añadido por: {item.authorName}</Text>
                            </TouchableOpacity>
                        );
                    })
                )}

                {/* Próximos Eventos */}
                {futureEvents.length > 0 && (
                    <>
                        <Text style={styles.sectionHeader}>Próximos Eventos:</Text>
                        {futureEvents.map(item => {
                            const eventDate = item.dateTime.toDate();
                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.eventItem}
                                    onPress={() => showEventDetails(item)}
                                >
                                    <Text style={styles.eventTitle}>{item.title}</Text>
                                    <View style={styles.eventDateBadge}>
                                        <Text style={styles.eventDateText}>
                                            {eventDate.toLocaleDateString('es-CL', { 
                                                day: 'numeric', 
                                                month: 'long', 
                                                year: 'numeric' 
                                            })} - {eventDate.toLocaleTimeString('es-CL', { 
                                                hour: '2-digit', 
                                                minute: '2-digit' 
                                            })}
                                        </Text>
                                    </View>
                                    <Text style={styles.eventAuthor}>Añadido por: {item.authorName}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}

                <View style={{ height: 50 }} />
            </ScrollView>

            {/* Modal de Nuevo/Editar Evento */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isEventModalVisible}
                onRequestClose={closeEventModal}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <ScrollView 
                            style={styles.modalScrollView} 
                            keyboardShouldPersistTaps="handled"
                            nestedScrollEnabled={true}
                        >
                            <Text style={styles.modalTitle}>
                                {editingEventId ? 'Editar Evento' : 'Nuevo Evento'}
                            </Text>

                            {/* Título */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Título</Text>
                                <TextInput
                                    style={styles.modalInput}
                                    placeholder="Ej. Aniversario, Cumpleaños..."
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

                            {/* Recordatorio */}
                            <View style={[styles.modalSection, styles.reminderRow]}>
                                <Text style={styles.modalLabel}>¿Activar Recordatorio?</Text>
                                <Switch
                                    trackColor={{ false: theme.placeholder + '50', true: theme.primary + '50' }}
                                    thumbColor={eventReminder ? theme.primary : theme.placeholder}
                                    ios_backgroundColor={theme.placeholder + '30'}
                                    onValueChange={setEventReminder}
                                    value={eventReminder}
                                />
                            </View>

                            {eventReminder && (
                                <View style={styles.modalSection}>
                                     <Text style={[styles.modalLabel, { fontStyle: 'italic', textAlign: 'center' }]}>
                                         (Próximamente: Configuración de recordatorio aquí)
                                     </Text>
                                </View>
                            )}

                            {/* Botones */}
                            <View style={styles.modalButtons}>
                                <Button title="Cancelar" onPress={closeEventModal} color="grey" />
                                <Button 
                                    title={editingEventId ? "Actualizar" : "Guardar"} 
                                    onPress={handleAddEvent} 
                                    color={theme.primary} 
                                />
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

                                {selectedEvent.reminder && (
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
                                        <Button 
                                            title="Cerrar" 
                                            onPress={() => setIsDetailModalVisible(false)} 
                                            color={theme.primary} 
                                        />
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* DateTimePicker */}
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

            {/* Selector de Mes/Año */}
            
        </SafeAreaView>
    );
};

export default CalendarScreen;