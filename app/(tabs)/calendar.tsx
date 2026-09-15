// Sprint 7.7 — re-skin de Calendario según el sistema de diseño: grid
// mensual propio (vía dayComponent de react-native-calendars), tarjetas de
// eventos del día y próximos eventos, aniversario integrado en el grid y
// en las listas, y modal de nuevo evento como bottom sheet.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, TextInput,
    Modal, TouchableOpacity, ScrollView, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import {
    collection, addDoc, onSnapshot, query, doc, orderBy, limit,
    serverTimestamp, Timestamp, deleteDoc, updateDoc,
} from 'firebase/firestore';
import { useRouter } from 'expo-router';
import { Calendar, LocaleConfig, DateData } from 'react-native-calendars';
import Toast from 'react-native-toast-message';
import { DateTimeModal } from '../../src/components/DateTimeModal';
import { Ionicons } from '@expo/vector-icons';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { scheduleEventReminder, cancelEventReminder } from '../../src/services/notifications';
import { getChileanHolidaysForYears } from '../../src/services/holidays';
import {
    isAnniversaryDay, isMonthiversaryDay, monthiversaryTitle, monthsElapsed,
    nextAnniversary as computeNextAnniversary, nextMonthiversary as computeNextMonthiversary,
} from '../../src/services/milestones';
import { Button } from '../../src/components/Button';
import { ConfirmDestructiveModal } from '../../src/components/ConfirmDestructiveModal';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { PaywallSheet } from '../../src/components/PaywallSheet';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { useResponsive } from '../../src/hooks/useResponsive';

// "L M M J V S D" (handoff): semana empieza en lunes y ambos martes/
// miércoles se abrevian "M" — el dayNamesShort por defecto ('X' para
// miércoles) no calza con esa lectura, así que se sobreescribe acá.
LocaleConfig.locales['es'] = {
    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
    monthNamesShort: ['Ene.', 'Feb.', 'Mar.', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
    dayNamesShort: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
};
LocaleConfig.defaultLocale = 'es';

interface CalendarEvent {
    id: string;
    title: string;
    dateTime: Timestamp;
    description?: string;
    reminder: boolean;
    notificationId?: string | null;
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

// Inversa de toDateString. OJO: 'new Date("YYYY-MM-DD")' NO sirve para esto
// — JS interpreta esa forma como medianoche UTC, y en Chile (UTC-3/-4) eso
// muestra el día ANTERIOR al mostrarlo de vuelta en hora local. Construir la
// fecha a mano, en local, evita ese desfase.
const parseDateString = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_ABREV = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const CalendarScreen: React.FC = () => {
    const router = useRouter();
    const { theme, isDarkMode: isDark, fontFamilies } = useTheme();
    const { isDesktop } = useResponsive();

    const { user, userData, plan, isLoading: planLoading } = usePlan();
    const [loading, setLoading] = useState(true);

    const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(toDateString(new Date()));

    const [isEventModalVisible, setIsEventModalVisible] = useState(false);
    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventDateTime, setEventDateTime] = useState<Date>(new Date());
    const [eventReminder, setEventReminder] = useState(false);
    const [editingEventNotificationId, setEditingEventNotificationId] = useState<string | null>(null);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);

    const [isDateTimePickerVisible, setDateTimePickerVisibility] = useState(false);
    const [dateTimePickerMode, setDateTimePickerMode] = useState<'date' | 'time'>('date');
    const [pendingDateTimeSelection, setPendingDateTimeSelection] = useState(false);

    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    // Propio y no reutilizado: un paywall tiene que explicar por qué apareció,
    // y el de los eventos habla de cupos.
    const [showTimelinePaywall, setShowTimelinePaywall] = useState(false);

    const partnerId = userData?.partnerId as string | undefined;

    useEffect(() => {
        if (!user || !partnerId) {
            setAllEvents([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const chatId = [user.uid, partnerId].sort().join('_');
        const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');
        const q = query(eventsCollectionRef, orderBy('dateTime', 'desc'), limit(500));

        const unsubscribeEvents = onSnapshot(q, (snapshot) => {
            const eventsList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent))
                .sort((a, b) => a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime());
            setAllEvents(eventsList);
            setLoading(false);
        }, (error) => { console.error("Error fetching events:", error); setLoading(false); });

        return () => unsubscribeEvents();
    }, [user, partnerId]);

    // Sprint 9.20: la aritmética de aniversarios y meses cumplidos se fue a
    // services/milestones.ts. Acá estaba escrita a mano y sin pruebas, y los
    // meses cumplidos no existían: para una pareja joven eso deja el
    // calendario vacío hasta el primer año.
    const relationshipStart: Date | null = userData?.relationshipStartDate?.toDate
        ? userData.relationshipStartDate.toDate()
        : null;

    const nextAnniversary = useMemo(
        () => (relationshipStart ? computeNextAnniversary(relationshipStart, new Date()) : null),
        // El objeto Date cambia de identidad en cada render del listener, así
        // que la dependencia es su valor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [relationshipStart?.getTime()]
    );

    const nextMonthiversary = useMemo(
        () => (relationshipStart ? computeNextMonthiversary(relationshipStart, new Date()) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [relationshipStart?.getTime()]
    );

    const isAnniversaryDate = useCallback((dateString: string) => {
        if (!relationshipStart) return false;
        return isAnniversaryDay(relationshipStart, parseDateString(dateString));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [relationshipStart?.getTime()]);

    const isMonthiversaryDate = useCallback((dateString: string) => {
        if (!relationshipStart) return false;
        return isMonthiversaryDay(relationshipStart, parseDateString(dateString));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [relationshipStart?.getTime()]);

    const visibleYears = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
    }, []);

    const chileanHolidays = useMemo(
        () => getChileanHolidaysForYears(visibleYears),
        [visibleYears]
    );

    const eventDatesSet = useMemo(() => {
        const set = new Set<string>();
        allEvents.forEach(e => set.add(toDateString(e.dateTime.toDate())));
        return set;
    }, [allEvents]);

    const markedDates = useMemo(() => {
        const markers: { [key: string]: any } = {};
        eventDatesSet.forEach(dateString => {
            markers[dateString] = { ...markers[dateString], marked: true };
        });
        Object.keys(chileanHolidays).forEach(dateString => {
            markers[dateString] = { ...markers[dateString], isHoliday: true };
        });
        if (!markers[selectedDate]) markers[selectedDate] = {};
        markers[selectedDate] = { ...markers[selectedDate], selected: true };
        return markers;
    }, [eventDatesSet, chileanHolidays, selectedDate]);

    const eventsForSelectedDate = useMemo(() => {
        return allEvents.filter(event => toDateString(event.dateTime.toDate()) === selectedDate);
    }, [allEvents, selectedDate]);

    const selectedIsAnniversary = isAnniversaryDate(selectedDate);
    const selectedAnniversaryYears = selectedIsAnniversary && relationshipStart
        ? parseDateString(selectedDate).getFullYear() - relationshipStart.getFullYear()
        : null;

    const selectedIsMonthiversary = isMonthiversaryDate(selectedDate);
    const selectedMonthsTogether = selectedIsMonthiversary && relationshipStart
        ? monthsElapsed(relationshipStart, parseDateString(selectedDate))
        : null;

    const upcomingRows = useMemo(() => {
        type Row = { key: string; date: Date; title: string; isAnniversary: boolean; original?: CalendarEvent };

        // Sprint 9.20: antes esto ordenaba todo por fecha y cortaba en cinco,
        // así que con cinco eventos cercanos el aniversario desaparecía de la
        // lista — justo la fecha que nadie quiere que se le pase. Ahora el
        // aniversario y el próximo mes cumplido van anclados y los eventos
        // llenan lo que queda.
        const pinned: Row[] = [];
        if (nextAnniversary) {
            pinned.push({
                key: 'anniversary',
                date: nextAnniversary.date,
                title: nextAnniversary.title,
                isAnniversary: true,
            });
        }
        if (nextMonthiversary) {
            pinned.push({
                key: 'monthiversary',
                date: nextMonthiversary.date,
                title: nextMonthiversary.title,
                isAnniversary: true,
            });
        }

        const eventRows: Row[] = allEvents
            .filter(e => e.dateTime.toDate() >= new Date())
            .map(e => ({ key: e.id, date: e.dateTime.toDate(), title: e.title, isAnniversary: false, original: e }));

        const rows = [...pinned, ...eventRows.slice(0, Math.max(0, 5 - pinned.length))];
        rows.sort((a, b) => a.date.getTime() - b.date.getTime());
        return rows;
    }, [allEvents, nextAnniversary, nextMonthiversary]);

    const openEventModal = () => {
        setEventTitle('');
        setEventDescription('');
        setEventDateTime(new Date());
        setEventReminder(false);
        setEditingEventId(null);
        setEditingEventNotificationId(null);
        setIsEventModalVisible(true);
    };

    const openEditModal = (event: CalendarEvent) => {
        setEventTitle(event.title);
        setEventDescription(event.description || '');
        setEventDateTime(event.dateTime.toDate());
        setEventReminder(event.reminder);
        setEditingEventId(event.id);
        setEditingEventNotificationId(event.notificationId ?? null);
        setIsDetailModalVisible(false);
        setIsEventModalVisible(true);
    };

    const closeEventModal = () => {
        setIsEventModalVisible(false);
        setEditingEventId(null);
        setEditingEventNotificationId(null);
    };

    const showEventDetails = (event: CalendarEvent) => {
        setSelectedEvent(event);
        setIsDetailModalVisible(true);
    };

    const showDatePicker = useCallback(() => {
        setIsEventModalVisible(false);
        setPendingDateTimeSelection(true);
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
        requestAnimationFrame(() => {
            setTimeout(() => {
                setDateTimePickerMode('time');
                setDateTimePickerVisibility(true);
            }, 200);
        });
    }, []);

    const hideDateTimePicker = useCallback(() => {
        setDateTimePickerVisibility(false);
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

        requestAnimationFrame(() => {
            setTimeout(() => {
                if (pendingDateTimeSelection) {
                    setIsEventModalVisible(true);
                    setPendingDateTimeSelection(false);
                }
            }, 200);
        });
    }, [eventDateTime, dateTimePickerMode, pendingDateTimeSelection]);

    const handleReminderToggle = (value: boolean) => {
        if (value && plan === 'free') {
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

        if (eventReminder && plan === 'free') {
            Toast.show({ type: 'error', text1: 'Función Premium', text2: 'Los recordatorios requieren Premium' });
            return;
        }

        const chatId = [user.uid, userData.partnerId].sort().join('_');
        const eventsCollectionRef = collection(db, 'relationships', chatId, 'events');

        try {
            if (editingEventId && editingEventNotificationId) {
                await cancelEventReminder(editingEventNotificationId);
            }
            const notificationId = eventReminder
                ? await scheduleEventReminder(title, eventDescription.trim() || 'Tu evento es ahora', eventDateTime)
                : null;

            if (editingEventId) {
                const eventDocRef = doc(db, 'relationships', chatId, 'events', editingEventId);
                await updateDoc(eventDocRef, {
                    title,
                    dateTime: Timestamp.fromDate(eventDateTime),
                    description: eventDescription.trim() || null,
                    reminder: eventReminder,
                    notificationId,
                });
                Toast.show({ type: 'success', text1: 'Evento actualizado' });
            } else {
                await addDoc(eventsCollectionRef, {
                    title,
                    dateTime: Timestamp.fromDate(eventDateTime),
                    description: eventDescription.trim() || null,
                    reminder: eventReminder,
                    notificationId,
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
    }, [eventTitle, eventDescription, eventDateTime, eventReminder, userData, user, editingEventId, editingEventNotificationId, plan]);

    const confirmDeleteEvent = async () => {
        if (!deletingEvent || !user || !userData?.partnerId) return;
        const chatId = [user.uid, userData.partnerId].sort().join('_');
        try {
            await cancelEventReminder(deletingEvent.notificationId);
            await deleteDoc(doc(db, 'relationships', chatId, 'events', deletingEvent.id));
            Toast.show({ type: 'success', text1: 'Evento eliminado' });
            setIsDetailModalVisible(false);
        } catch (error) {
            console.error("Error eliminando:", error);
            Toast.show({ type: 'error', text1: 'Error al eliminar' });
        }
        setDeletingEvent(null);
    };

    // --- Día del grid, completamente propio (spec del handoff) ---
    const renderDay = ({ date, state, marking }: { date?: DateData; state?: string; marking?: any }) => {
        if (!date) return <View style={{ flex: 1 }} />;
        const isOtherMonth = state === 'disabled' || state === 'inactive';
        const isSelected = !!marking?.selected;
        const isAnniversary = isAnniversaryDate(date.dateString);
        // Marca propia y más discreta que el corazón del aniversario: un mes
        // cumplido se celebra, pero no es el aniversario.
        const isMonthiversary = !isAnniversary && isMonthiversaryDate(date.dateString);
        const isHoliday = !!marking?.isHoliday;
        const hasEvent = !!marking?.marked;

        let textColor = theme.text;
        if (isOtherMonth) textColor = '#C4C4CE';
        else if (isHoliday && !isSelected) textColor = theme.danger;
        if (isSelected) textColor = theme.white;

        return (
            <TouchableOpacity
                onPress={() => setSelectedDate(date.dateString)}
                style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.s8 }}
            >
                <View style={{
                    width: 30,
                    height: 30,
                    borderRadius: isSelected ? 11 : 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? theme.primary : (isAnniversary ? theme.affection + '22' : 'transparent'),
                    borderWidth: !isSelected && (isAnniversary || isMonthiversary) ? 1.5 : 0,
                    borderColor: isAnniversary ? theme.affection : theme.affection + '55',
                }}>
                    {isAnniversary && !isSelected ? (
                        <Ionicons name="heart" size={14} color={theme.affection} />
                    ) : (
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13, color: textColor }}>
                            {date.day}
                        </Text>
                    )}
                </View>
                {hasEvent && !isAnniversary && (
                    <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary, marginTop: 3 }} />
                )}
            </TouchableOpacity>
        );
    };

    if (loading || planLoading) {
        return <FullScreenLoader />;
    }

    if (!userData?.partnerId) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Ionicons name="calendar-outline" size={64} color={theme.textFaint} />
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, marginTop: spacing.s16, textAlign: 'center' }}>
                    Conecta con tu pareja para compartir eventos
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, color: theme.text, marginBottom: spacing.s16 }}>
                    Calendario
                </Text>

                {/* Grid mensual */}
                <View style={{ backgroundColor: theme.surface, borderRadius: radii.card, padding: spacing.s16 }}>
                    <Calendar
                        current={selectedDate}
                        onDayPress={(day) => setSelectedDate(day.dateString)}
                        markedDates={markedDates}
                        firstDay={1}
                        dayComponent={renderDay as any}
                        renderArrow={(direction) => (
                            <Ionicons name={direction === 'left' ? 'chevron-back' : 'chevron-forward'} size={20} color={theme.text} />
                        )}
                        renderHeader={(date) => {
                            const jsDate = date ? new Date(date.getFullYear(), date.getMonth(), 1) : new Date();
                            return (
                                <Text style={{ fontFamily: fontFamilies.display, fontSize: 24, color: theme.text }}>
                                    {`${MESES[jsDate.getMonth()].charAt(0).toUpperCase()}${MESES[jsDate.getMonth()].slice(1)} ${jsDate.getFullYear()}`}
                                </Text>
                            );
                        }}
                        theme={{
                            calendarBackground: 'transparent',
                            textSectionTitleColor: theme.textFaint,
                            textDayHeaderFontFamily: fontFamilies.bodyBold,
                            textDayHeaderFontSize: 10,
                        }}
                        style={{ paddingBottom: 0 }}
                    />

                    {/* Leyenda */}
                    <View style={{ flexDirection: 'row', gap: spacing.s16, marginTop: spacing.s8, paddingTop: spacing.s10, borderTopWidth: 1, borderTopColor: theme.divider }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary }} />
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 11, color: theme.textFaint }}>Evento</Text>
                        </View>
                        {nextAnniversary && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                                <Ionicons name="heart" size={11} color={theme.affection} />
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 11, color: theme.textFaint }}>
                                    Aniversario ({userData?.relationshipStartDate?.toDate().toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })})
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Eventos para la fecha seleccionada */}
                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 16, color: theme.text, marginTop: spacing.s20, marginBottom: spacing.s10 }}>
                    Eventos para {parseDateString(selectedDate).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>

                {selectedIsAnniversary && selectedAnniversaryYears !== null && selectedAnniversaryYears >= 0 && (
                    <View style={{
                        backgroundColor: theme.surface,
                        borderRadius: 16,
                        borderLeftWidth: 3,
                        borderLeftColor: theme.affection,
                        padding: spacing.s14,
                        marginBottom: spacing.s10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s10,
                    }}>
                        <Ionicons name="heart" size={18} color={theme.affection} />
                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 14.5, color: theme.text }}>
                            {selectedAnniversaryYears === 0 ? 'El día en que empezaron' : `${selectedAnniversaryYears}° aniversario`}
                        </Text>
                    </View>
                )}

                {selectedIsMonthiversary && selectedMonthsTogether !== null && (
                    <View style={{
                        backgroundColor: theme.surface,
                        borderRadius: 16,
                        borderLeftWidth: 3,
                        borderLeftColor: theme.affection,
                        padding: spacing.s14,
                        marginBottom: spacing.s10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.s10,
                    }}>
                        <Ionicons name="heart-outline" size={18} color={theme.affection} />
                        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 14.5, color: theme.text }}>
                            {monthiversaryTitle(selectedMonthsTogether)}
                        </Text>
                    </View>
                )}

                {eventsForSelectedDate.length > 0 ? (
                    eventsForSelectedDate.map((event) => (
                        <TouchableOpacity
                            key={event.id}
                            onPress={() => showEventDetails(event)}
                            style={{
                                backgroundColor: theme.surface,
                                borderRadius: 16,
                                borderLeftWidth: 3,
                                borderLeftColor: theme.primary,
                                padding: spacing.s14,
                                marginBottom: spacing.s10,
                            }}
                        >
                            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 14.5, color: theme.text }}>{event.title}</Text>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint, marginTop: spacing.s4 }}>
                                {event.dateTime.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · agregó {event.authorName}
                            </Text>
                        </TouchableOpacity>
                    ))
                ) : (
                    !selectedIsAnniversary && !selectedIsMonthiversary && (
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textFaint }}>
                            No hay eventos para esta fecha
                        </Text>
                    )
                )}

                {chileanHolidays[selectedDate] && (
                    <View style={{ backgroundColor: theme.dangerBg, borderRadius: 16, padding: spacing.s14, marginBottom: spacing.s10 }}>
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.danger }}>
                            🇨🇱 {chileanHolidays[selectedDate]}
                        </Text>
                    </View>
                )}

                {/* Próximos eventos */}
                {upcomingRows.length > 0 && (
                    <>
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 16, color: theme.text, marginTop: spacing.s20, marginBottom: spacing.s10 }}>
                            Próximos eventos
                        </Text>
                        {upcomingRows.map(row => (
                            <TouchableOpacity
                                key={row.key}
                                onPress={() => row.original ? showEventDetails(row.original) : setSelectedDate(toDateString(row.date))}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, paddingVertical: spacing.s10 }}
                            >
                                <Text style={{
                                    fontFamily: fontFamilies.bodyBold,
                                    fontSize: 11,
                                    width: 42,
                                    color: row.isAnniversary ? theme.affection : theme.textFaint,
                                }}>
                                    {row.date.getDate()} {MESES_ABREV[row.date.getMonth()]}
                                </Text>
                                {row.isAnniversary && <Ionicons name="heart" size={14} color={theme.affection} />}
                                <Text style={{
                                    fontFamily: fontFamilies.bodySemiBold,
                                    fontSize: 13.5,
                                    color: row.isAnniversary ? theme.affection : theme.text,
                                    flex: 1,
                                }}>
                                    {row.title}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        {/* Sprint 9.22: la entrada a la línea de tiempo vive
                            acá, al final de lo que viene, porque es
                            exactamente el movimiento contrario — lo que ya
                            pasó. */}
                        <TouchableOpacity
                            onPress={() => plan === 'premium' ? router.push('/timeline') : setShowTimelinePaywall(true)}
                            accessibilityRole="button"
                            style={{
                                flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                                paddingVertical: spacing.s12, paddingHorizontal: spacing.s14,
                                marginTop: spacing.s8,
                                borderRadius: radii.field, backgroundColor: theme.surfaceAlt,
                            }}
                        >
                            <Ionicons name="git-commit-outline" size={16} color={theme.textMuted} />
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.text, flex: 1 }}>
                                Su historia
                            </Text>
                            {plan === 'free'
                                ? <Ionicons name="lock-closed" size={14} color={theme.premium} />
                                : <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />}
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>

            {/* FAB — en móvil a 118 para despejar la tab bar inferior (antes
                quedaba en 20, tapado detrás de la tab bar); en escritorio no
                hay tab bar que despejar. */}
            <TouchableOpacity
                onPress={openEventModal}
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
                    ...(isDark ? { borderWidth: 1, borderColor: theme.border } : {
                        shadowColor: '#6A5ACD', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.36, shadowRadius: 26, elevation: 12,
                    }),
                }}
            >
                <Ionicons name="add" size={28} color={theme.white} />
            </TouchableOpacity>
            </DesktopContentWrap>

            {/* Modal de nuevo evento — bottom sheet */}
            <Modal animationType="slide" transparent visible={isEventModalVisible} onRequestClose={closeEventModal}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,22,46,0.5)' }}>
                    <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeEventModal} />
                    <ScrollView
                        style={{
                            backgroundColor: theme.surface,
                            borderTopLeftRadius: radii.sheetTop,
                            borderTopRightRadius: radii.sheetTop,
                            maxHeight: '85%',
                        }}
                        contentContainerStyle={{ padding: spacing.s22, gap: spacing.s14 }}
                    >
                        <View style={{ alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: theme.borderSoft }} />
                        <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, color: theme.text }}>
                            {editingEventId ? 'Editar evento' : 'Nuevo evento'}
                        </Text>

                        <TextInput
                            style={{
                                height: 50, borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                                paddingHorizontal: spacing.s16 - 1, color: theme.text, fontFamily: fontFamilies.body,
                                fontSize: 15, backgroundColor: theme.inputBackground,
                            }}
                            placeholder="Título del evento"
                            placeholderTextColor={theme.textFaint}
                            value={eventTitle}
                            onChangeText={setEventTitle}
                        />

                        <TextInput
                            style={{
                                minHeight: 52, borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                                padding: spacing.s12, color: theme.text, fontFamily: fontFamilies.body,
                                fontSize: 15, backgroundColor: theme.inputBackground, textAlignVertical: 'top',
                            }}
                            placeholder="Descripción (opcional)"
                            placeholderTextColor={theme.textFaint}
                            value={eventDescription}
                            onChangeText={setEventDescription}
                            multiline
                        />

                        <View style={{ flexDirection: 'row', gap: spacing.s10 }}>
                            <TouchableOpacity
                                onPress={showDatePicker}
                                style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                    backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.borderSoft,
                                    borderRadius: radii.field, padding: spacing.s14,
                                }}
                            >
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, color: theme.text }}>
                                    {eventDateTime.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                </Text>
                                <Ionicons name="calendar-outline" size={18} color={theme.textFaint} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={showTimePicker}
                                style={{
                                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                    backgroundColor: theme.inputBackground, borderWidth: 1, borderColor: theme.borderSoft,
                                    borderRadius: radii.field, padding: spacing.s14,
                                }}
                            >
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, color: theme.text }}>
                                    {eventDateTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <Ionicons name="time-outline" size={18} color={theme.textFaint} />
                            </TouchableOpacity>
                        </View>

                        {plan === 'free' ? (
                            <TouchableOpacity
                                onPress={() => setShowUpgradeModal(true)}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                                    backgroundColor: theme.primaryTint, borderWidth: 1, borderStyle: 'dashed',
                                    borderColor: theme.primary, borderRadius: radii.field, padding: spacing.s14,
                                }}
                            >
                                <Ionicons name="lock-closed" size={18} color={theme.premium} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.text }}>Recordatorio</Text>
                                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>Disponible en Conexión Total</Text>
                                </View>
                                <Switch value={false} disabled trackColor={{ false: theme.borderSoft, true: theme.borderSoft }} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{
                                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                backgroundColor: theme.surfaceAlt, borderRadius: radii.field, padding: spacing.s14,
                            }}>
                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.text }}>Recordatorio</Text>
                                <Switch
                                    value={eventReminder}
                                    onValueChange={handleReminderToggle}
                                    trackColor={{ false: theme.borderSoft, true: theme.primarySoft }}
                                    thumbColor={eventReminder ? theme.primary : theme.surface}
                                />
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: spacing.s10, marginTop: spacing.s4 }}>
                            <View style={{ flex: 1 }}>
                                <Button title="Cancelar" variant="outline" onPress={closeEventModal} />
                            </View>
                            <View style={{ flex: 1.3 }}>
                                <Button title="Guardar evento" onPress={handleAddEvent} disabled={eventTitle.trim() === ''} />
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </Modal>

            {/* Modal de detalle */}
            <Modal animationType="fade" transparent visible={isDetailModalVisible} onRequestClose={() => setIsDetailModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(24,22,46,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.s20 }}>
                    {selectedEvent && (
                        <View style={{ backgroundColor: theme.surface, borderRadius: radii.cardLg, padding: spacing.s22, width: '100%', maxWidth: 400, gap: spacing.s12 }}>
                            <Text style={{ fontFamily: fontFamilies.display, fontSize: 23, color: theme.text }}>{selectedEvent.title}</Text>

                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted }}>
                                {selectedEvent.dateTime.toDate().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                {' · '}
                                {selectedEvent.dateTime.toDate().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </Text>

                            {selectedEvent.description && (
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, color: theme.textMuted }}>
                                    {selectedEvent.description}
                                </Text>
                            )}

                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                                Agregó {selectedEvent.authorName}
                            </Text>

                            {selectedEvent.reminder && plan === 'premium' && (
                                <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12, color: theme.primary }}>
                                    🔔 Recordatorio activado
                                </Text>
                            )}

                            {user?.uid === selectedEvent.authorId ? (
                                <View style={{ flexDirection: 'row', gap: spacing.s10, marginTop: spacing.s8 }}>
                                    <View style={{ flex: 1 }}>
                                        <Button title="Editar" variant="outline" onPress={() => openEditModal(selectedEvent)} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <TouchableOpacity
                                            onPress={() => setDeletingEvent(selectedEvent)}
                                            style={{ backgroundColor: theme.danger, borderRadius: radii.field - 1, paddingVertical: spacing.s16 - 1, alignItems: 'center' }}
                                        >
                                            <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 15, color: theme.white }}>Eliminar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <Button title="Cerrar" variant="outline" onPress={() => setIsDetailModalVisible(false)} style={{ marginTop: spacing.s8 }} />
                            )}
                        </View>
                    )}
                </View>
            </Modal>

            {/* Sprint 9.25: desde el computador esto no abría nada — el
                selector nativo no existe en web. Ver DateTimeModal. */}
            <DateTimeModal
                isVisible={isDateTimePickerVisible}
                mode={dateTimePickerMode}
                date={eventDateTime}
                onConfirm={handleConfirmDateTime}
                onCancel={hideDateTimePicker}
            />

            <PaywallSheet
                visible={showTimelinePaywall}
                onClose={() => setShowTimelinePaywall(false)}
                onUpgradePress={() => { setShowTimelinePaywall(false); router.push('/(tabs)/config'); }}
                icon="git-commit"
                title="Su historia en una sola vista"
                description="Los hitos que fueron cumpliendo, las fotos que subieron y lo que vivieron, en orden y en un solo lugar."
                benefits={[
                    'Línea de tiempo con hitos, eventos y fotos',
                    'Archivo completo de la pregunta del día',
                    'Ficha de la pareja con tallas y notas privadas',
                ]}
            />
            <PaywallSheet
                visible={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                onUpgradePress={() => setShowUpgradeModal(false)}
                icon="notifications"
                title="Recordatorios de eventos"
                description="Los recordatorios y alarmas de calendario son una función exclusiva de Conexión Total."
                benefits={['Recordatorios personalizados por evento', 'Alarma para el día del aniversario', 'Nunca más olviden una fecha especial']}
            />

            <ConfirmDestructiveModal
                visible={!!deletingEvent}
                title="Eliminar evento"
                message="Se borrará para los dos y no se puede deshacer."
                onConfirm={confirmDeleteEvent}
                onCancel={() => setDeletingEvent(null)}
            />
        </SafeAreaView>
    );
};

export default CalendarScreen;
