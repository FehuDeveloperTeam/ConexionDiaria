import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    Modal, TextInput, Button, FlatList, Alert, TouchableOpacity
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

// --- Configuración de idioma para el calendario ---
LocaleConfig.locales['es'] = {
  monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  monthNamesShort: ['Ene.','Feb.','Mar.','Abr.','May.','Jun.','Jul.','Ago.','Sep.','Oct.','Nov.','Dic.'],
  dayNames: ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],
  dayNamesShort: ['D','L','M','M','J','V','S'],
};
LocaleConfig.defaultLocale = 'es';

// --- Estilos ---
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: 15 },
    title: { fontSize: 28, fontWeight: 'bold', color: theme.text, textAlign: 'center', marginBottom: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background },
    placeholderText: { fontSize: 16, color: theme.placeholder, textAlign: 'center', marginTop: 50 },
    
    // Lista de eventos
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
    eventAuthor: { fontSize: 12, fontStyle: 'italic', color: theme.placeholder, marginTop: 5 },

    // Modal
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    modalContainer: { width: '90%', backgroundColor: theme.background, borderRadius: 20, padding: 20 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 20 },
    modalInput: {
        height: 50,
        width: '100%',
        borderColor: theme.borderColor,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        color: theme.text,
        backgroundColor: theme.inputBackground,
        marginBottom: 20,
    },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
});

interface CalendarEvent {
    id: string;
    title: string;
    date: Timestamp; // ¡Aquí le decimos que 'date' existe y es un Timestamp!
    authorId: string;
    authorName: string;
    createdAt: Timestamp;
}

// Helper para formatear fecha a YYYY-MM-DD
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
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');

    // --- Carga de Autenticación y Perfil ---
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

    // --- Carga de Eventos ---
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
                    const q = query(eventsCollectionRef); // Traemos todos
                    
                    unsubscribeEvents = onSnapshot(q, (snapshot) => {
                        const eventsList = snapshot.docs
                            .map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent))
                            // Ordenamos en JS para evitar índices de Firestore por ahora
                            .sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
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

    // --- Lógica de Marcadores para el Calendario ---
    const markedDates = useMemo(() => {
        const markers: { [key: string]: { 
            marked?: boolean, 
            dotColor?: string, 
            selected?: boolean, 
            selectedColor?: string 
} } = {};
        allEvents.forEach(event => {
            const dateString = toDateString(event.date.toDate());
            markers[dateString] = { marked: true, dotColor: theme.primary };
        });
        // Marca también el día seleccionado
        if (markers[selectedDate]) {
            markers[selectedDate] = { ...markers[selectedDate], selected: true, selectedColor: theme.primary + '50' };
        } else {
            markers[selectedDate] = { selected: true, selectedColor: theme.primary + '50' };
        }
        return markers;
    }, [allEvents, selectedDate, theme.primary]);

    // --- Lógica para filtrar eventos del día ---
    const eventsForSelectedDay = useMemo(() => {
        return allEvents.filter(event => {
            const eventDateString = toDateString(event.date.toDate());
            return eventDateString === selectedDate;
        });
    }, [allEvents, selectedDate]);

    // --- Manejadores de Eventos ---
    const handleDayPress = (day: { dateString: string }) => {
        setSelectedDate(day.dateString);
    };

    const handleAddEvent = useCallback(async () => {
        const title = newEventTitle.trim();
        if (title === '' || !userData || !userData.partnerId || !user || !selectedDate) {
            return;
        }

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');
        
        // Almacenamos la fecha en UTC mediodía para evitar problemas de zona horaria
        const eventDate = new Date(`${selectedDate}T12:00:00Z`);

        try {
            await addDoc(eventsCollectionRef, {
                title: title,
                date: Timestamp.fromDate(eventDate),
                authorId: user.uid,
                authorName: userData.displayName,
                createdAt: serverTimestamp(),
            });
            setNewEventTitle('');
            setIsModalVisible(false);
            Toast.show({ type: 'success', text1: 'Evento añadido' });
        } catch (error) {
            console.error("Error al añadir evento:", error);
            Toast.show({ type: 'error', text1: 'Error al guardar el evento' });
        }
    }, [newEventTitle, selectedDate, userData, user]);

    // Eliminar un evento (solo el autor)
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

    // --- Renderizado ---
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
                
                {/* Componente del Calendario */}
                <Calendar
                    style={{
                        borderWidth: 1,
                        borderColor: theme.borderColor,
                        borderRadius: 8,
                    }}
                    theme={{
                        backgroundColor: theme.background,
                        calendarBackground: theme.background,
                        textSectionTitleColor: theme.placeholder,
                        selectedDayBackgroundColor: theme.primary,
                        selectedDayTextColor: theme.white,
                        todayTextColor: theme.primary,
                        dayTextColor: theme.text,
                        textDisabledColor: theme.placeholder + '50',
                        dotColor: theme.primary,
                        selectedDotColor: theme.white,
                        arrowColor: theme.primary,
                        monthTextColor: theme.text,
                        indicatorColor: theme.primary,
                        textDayFontWeight: '300',
                        textMonthFontWeight: 'bold',
                        textDayHeaderFontWeight: '300',
                        textDayFontSize: 16,
                        textMonthFontSize: 16,
                        textDayHeaderFontSize: 16
                    }}
                    current={selectedDate}
                    onDayPress={handleDayPress}
                    markedDates={markedDates}
                />

                {/* Botón para añadir evento */}
                <View style={{ marginVertical: 15 }}>
                    <Button 
                        title={`Añadir evento el ${selectedDate}`}
                        onPress={() => setIsModalVisible(true)}
                        color={theme.primary}
                        disabled={!selectedDate}
                    />
                </View>

                {/* Lista de eventos del día */}
                <FlatList
                    data={eventsForSelectedDay}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            style={styles.eventItem}
                            onLongPress={() => handleDeleteEvent(item.id, item.authorId)}
                        >
                            <Text style={styles.eventTitle}>{item.title}</Text>
                            <Text style={styles.eventAuthor}>Añadido por: {item.authorName}</Text>
                        </TouchableOpacity>
                    )}
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

            {/* --- Modal para Añadir Evento --- */}
            <Modal 
                animationType="fade" 
                transparent={true} 
                visible={isModalVisible} 
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Añadir evento el {selectedDate}</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Título del evento (ej. Aniversario)"
                            placeholderTextColor={theme.placeholder}
                            value={newEventTitle}
                            onChangeText={setNewEventTitle}
                        />
                        <View style={styles.modalButtons}>
                            <Button title="Cancelar" onPress={() => setIsModalVisible(false)} color="grey" />
                            <Button title="Guardar" onPress={handleAddEvent} color={theme.primary} />
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default CalendarScreen;