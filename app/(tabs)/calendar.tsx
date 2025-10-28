import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    Modal, TextInput, Button, FlatList, Alert, TouchableOpacity,
    ScrollView, Switch // Added ScrollView and Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import {
    collection, addDoc, onSnapshot, query, doc,
    DocumentData, serverTimestamp, Timestamp, deleteDoc
} from 'firebase/firestore';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import Toast from 'react-native-toast-message';
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { Ionicons } from '@expo/vector-icons'; // Added for icons

LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['D','L','M','M','J','V','S'],
};
LocaleConfig.defaultLocale = 'es';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    listHeader: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 20, marginBottom: 10 },
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
    eventDescription: { fontSize: 14, color: theme.placeholder, marginTop: 5, fontStyle: 'italic' }, // Style for description
    eventAuthor: { fontSize: 12, fontStyle: 'italic', color: theme.placeholder, marginTop: 5 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
    // Updated Modal Container for scrolling
    modalContainer: {
        width: '90%',
        maxHeight: '80%', // Limit height
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
    modalScrollView: { width: '100%' }, // ScrollView inside modal
    modalSection: { marginBottom: 20, width: '100%' },
    modalLabel: { fontSize: 16, color: theme.placeholder, marginBottom: 8 },
    modalInput: {
        minHeight: 50, // Use minHeight for multiline
        width: '100%',
        borderColor: theme.borderColor,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 16,
        color: theme.text,
        backgroundColor: theme.inputBackground,
        textAlignVertical: 'top', // For multiline
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
});

interface CalendarEvent {
    id: string;
    title: string;
    dateTime: Timestamp;
    description?: string; // Optional description
    reminder?: boolean; // Optional reminder flag
    authorId: string;
    authorName: string;
    createdAt: Timestamp;
}

const toDateString = (date: Date): string => {
    return date.toISOString().split('T')[0];
};

const formatModalDateTime = (date: Date): string => {
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) +
           ' ' +
           date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
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

    // State for the new event modal
    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventDateTime, setEventDateTime] = useState<Date>(new Date());
    const [eventReminder, setEventReminder] = useState(false);

    // State for DateTimePicker (now used within the modal)
    const [isDateTimePickerVisible, setDateTimePickerVisibility] = useState(false);
    const [dateTimePickerMode, setDateTimePickerMode] = useState<'date' | 'time'>('date');

    useEffect(() => {
        setLoading(true);
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!currentUser) {
                setUserData(null); setAllEvents([]); setLoading(false);
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
                    setAllEvents([]); setLoading(false);
                }
            } else {
                auth.signOut(); setLoading(false);
            }
        }, (error) => { console.error("Error user listener:", error); auth.signOut(); setLoading(false); });

        return () => { unsubscribeUser(); unsubscribeEvents(); };
    }, [user]);

    const markedDates = useMemo(() => {
        const markers: { [key: string]: { marked?: boolean, dotColor?: string, selected?: boolean, selectedColor?: string } } = {};
        allEvents.forEach(event => {
            const dateString = toDateString(event.dateTime.toDate());
            markers[dateString] = { marked: true, dotColor: theme.primary };
        });
        if (markers[selectedDate]) {
            markers[selectedDate] = { ...markers[selectedDate], selected: true, selectedColor: theme.primary + '50' };
        } else {
            markers[selectedDate] = { selected: true, selectedColor: theme.primary + '50' };
        }
        return markers;
    }, [allEvents, selectedDate, theme.primary]);

    const eventsForSelectedDay = useMemo(() => {
        return allEvents.filter(event => {
            const eventDateString = toDateString(event.dateTime.toDate());
            return eventDateString === selectedDate;
        });
    }, [allEvents, selectedDate]);

    // --- Modal and DateTimePicker Handlers ---
    const openEventModal = () => {
        // Set initial date/time for the modal based on selectedDate
        const now = new Date();
        const initialDateTime = new Date(selectedDate);
        initialDateTime.setHours(now.getHours(), Math.round(now.getMinutes() / 5) * 5, 0, 0); // Use current rounded time

        setEventDateTime(initialDateTime);
        setEventTitle('');
        setEventDescription('');
        setEventReminder(false);
        setIsEventModalVisible(true);
    };

    const closeEventModal = () => {
        setIsEventModalVisible(false);
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
        const currentEventDateTime = new Date(eventDateTime); // Copy current state

        if (dateTimePickerMode === 'date') {
            // Update only the date part
            currentEventDateTime.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        } else { // 'time' mode
            // Round minutes
            const minutes = date.getMinutes();
            const roundedMinutes = Math.round(minutes / 5) * 5;
            // Update only the time part
            currentEventDateTime.setHours(date.getHours(), roundedMinutes, 0, 0);
        }
        setEventDateTime(currentEventDateTime); // Update the state for the modal
    };

    // --- Calendar Day Press Handler (Simplified) ---
    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString); // Only update the selected date
    };

    // --- Add Event Handler (Updated) ---
    const handleAddEvent = useCallback(async () => {
        const title = eventTitle.trim();
        if (title === '' || !userData || !userData.partnerId || !user || !eventDateTime) {
            Toast.show({ type: 'error', text1: 'Por favor completa el título.' });
            return;
        }
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');

        try {
            await addDoc(eventsCollectionRef, {
                title: title,
                dateTime: Timestamp.fromDate(eventDateTime),
                description: eventDescription.trim() || null, // Save description or null
                reminder: eventReminder, // Save reminder flag
                authorId: user.uid,
                authorName: userData.displayName,
                createdAt: serverTimestamp(),
            });
            closeEventModal(); // Close modal on success
            Toast.show({ type: 'success', text1: 'Evento añadido' });
        } catch (error) {
            console.error("Error al añadir evento:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar el evento' });
        }
    }, [eventTitle, eventDescription, eventDateTime, eventReminder, userData, user]);

    // --- Delete Event Handler ---
    const handleDeleteEvent = (eventId: string, authorId: string) => {
        if (user?.uid !== authorId) {
            Toast.show({ type: 'error', text1: 'Solo el autor puede borrarlo' });
            return;
        }
        Alert.alert("Confirmar Eliminación", "¿Borrar este evento?",
            [ { text: "Cancelar", style: "cancel" }, {
                text: "Eliminar", style: "destructive",
                onPress: async () => {
                    if (!userData || !userData.partnerId) return;
                    const chatId = [user.uid, userData.partnerId].sort().join('_');
                    const eventDocRef = doc(db, 'relationships', chatId, 'events', eventId);
                    try { await deleteDoc(eventDocRef); }
                    catch (error) { Toast.show({ type: 'error', text1: 'Error al eliminar' }); }
                }
            }]
        );
    };

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
            <View style={styles.container}>
                <Text style={styles.title}>Calendario Compartido</Text>

                <Calendar
                    style={{
                        borderWidth: 1,
                        borderColor: theme.borderColor,
                        borderRadius: 8,
                    }}
                    theme={{ /* ... theme properties ... */ }}
                    // Removed 'current' prop
                    onDayPress={handleDayPress} // Now only selects the date
                    markedDates={markedDates}
                />

                {/* --- Add Event Button --- */}
                <View style={{ marginVertical: 15, width: '100%' }}>
                    <Button
                        title="Añadir Evento"
                        onPress={openEventModal} // Opens the new detailed modal
                        color={theme.primary}
                    />
                </View>

                <FlatList
                    data={eventsForSelectedDay}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => {
                        const eventTime = item.dateTime.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <TouchableOpacity
                                style={styles.eventItem}
                                onLongPress={() => handleDeleteEvent(item.id, item.authorId)}
                            >
                                <Text style={styles.eventTitle}>{item.title}</Text>
                                <Text style={styles.eventTimeText}>Hora: {eventTime}</Text>
                                {/* Display description if it exists */}
                                {item.description && <Text style={styles.eventDescription}>{item.description}</Text>}
                                <Text style={styles.eventAuthor}>Añadido por: {item.authorName}</Text>
                            </TouchableOpacity>
                        );
                    }}
                    ListHeaderComponent={
                        <Text style={styles.listHeader}>
                            Eventos del {selectedDate}:
                        </Text>
                    }
                    ListEmptyComponent={
                        <Text style={styles.placeholderText}>No hay eventos para este día.</Text>
                    }
                />
            </View>

            {/* --- New Event Input Modal --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={isEventModalVisible}
                onRequestClose={closeEventModal}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPressOut={closeEventModal} // Close on tapping outside
                >
                    <TouchableOpacity style={styles.modalContainer} activeOpacity={1}>
                        <ScrollView style={styles.modalScrollView} keyboardShouldPersistTaps="handled">
                            <Text style={styles.modalTitle}>Nuevo Evento</Text>

                            {/* Title Input */}
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

                            {/* Date Picker Button */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Fecha</Text>
                                <TouchableOpacity style={styles.dateTimePickerButton} onPress={showDatePicker}>
                                    <Text style={styles.dateTimePickerText}>
                                        {eventDateTime.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={theme.placeholder} />
                                </TouchableOpacity>
                            </View>

                            {/* Time Picker Button */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Hora</Text>
                                <TouchableOpacity style={styles.dateTimePickerButton} onPress={showTimePicker}>
                                    <Text style={styles.dateTimePickerText}>
                                        {eventDateTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                    </Text>
                                    <Ionicons name="time-outline" size={20} color={theme.placeholder} />
                                </TouchableOpacity>
                            </View>

                            {/* Description Input */}
                            <View style={styles.modalSection}>
                                <Text style={styles.modalLabel}>Descripción (Opcional)</Text>
                                <TextInput
                                    style={[styles.modalInput, { height: 100 }]} // Taller for multiline
                                    placeholder="Añade detalles..."
                                    placeholderTextColor={theme.placeholder}
                                    value={eventDescription}
                                    onChangeText={setEventDescription}
                                    multiline={true}
                                />
                            </View>

                            {/* Reminder Toggle */}
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

                            {/* Placeholder for Reminder Settings (appears if eventReminder is true) */}
                            {eventReminder && (
                                <View style={styles.modalSection}>
                                     <Text style={[styles.modalLabel, { fontStyle: 'italic', textAlign: 'center' }]}>
                                         (Próximamente: Configuración de recordatorio aquí)
                                     </Text>
                                     {/* Add inputs for reminder time (e.g., 15 mins before), repeat, etc. */}
                                </View>
                            )}

                            {/* Action Buttons */}
                            <View style={styles.modalButtons}>
                                <Button title="Cancelar" onPress={closeEventModal} color="grey" />
                                <Button title="Guardar Evento" onPress={handleAddEvent} color={theme.primary} />
                            </View>
                        </ScrollView>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* DateTimePickerModal (now controlled by the new modal) */}
            <DateTimePickerModal
                isVisible={isDateTimePickerVisible}
                mode={dateTimePickerMode} // Can be 'date' or 'time'
                date={eventDateTime} // Use the modal's date state
                onConfirm={handleConfirmDateTime}
                onCancel={hideDateTimePicker}
                locale="es_ES"
                confirmTextIOS="Confirmar"
                cancelTextIOS="Cancelar"
                minuteInterval={5}
                // minimumDate={new Date()} // Optional
            />
        </SafeAreaView>
    );
};

export default CalendarScreen;