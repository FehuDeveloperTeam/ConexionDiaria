// Línea de tiempo de la relación — Sprint 9.22, exclusiva de Conexión Total.
//
// Junta en una sola columna lo que hoy vive separado en tres pantallas: los
// hitos (el día en que empezaron, cada aniversario y cada medio año), los
// eventos ya pasados del calendario y las fotos del álbum. Por separado son
// tres listas; juntos y en orden son la historia de la pareja, que es lo que
// hace caro irse de la app.
//
// No guarda nada nuevo: se arma con lo que ya está escrito. Los hitos se
// calculan (services/milestones.ts) y lo demás son las mismas colecciones que
// leen Calendario y Álbum.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, limit, DocumentData } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { addMonths, anniversaryTitle, monthiversaryTitle, monthsElapsed } from '../../src/services/milestones';
import { formatDate } from '../../src/services/dateFormat';

type EntryKind = 'start' | 'milestone' | 'event' | 'photo';

interface Entry {
    key: string;
    date: Date;
    kind: EntryKind;
    title: string;
    subtitle?: string;
    imageUrl?: string;
}

const ICONS: Record<EntryKind, keyof typeof Ionicons.glyphMap> = {
    start: 'heart',
    milestone: 'ribbon',
    event: 'calendar',
    photo: 'image',
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const TimelineScreen: React.FC = () => {
    const router = useRouter();
    const { theme, fontFamilies } = useTheme();
    const { user, userData, plan, isLoading } = usePlan();

    const partnerId = userData?.partnerId as string | undefined;
    const relationshipId = user && partnerId ? [user.uid, partnerId].sort().join('_') : null;

    const [events, setEvents] = useState<DocumentData[]>([]);
    const [photos, setPhotos] = useState<DocumentData[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!relationshipId || plan !== 'premium') {
            setLoadingData(false);
            return;
        }

        const unsubEvents = onSnapshot(
            query(collection(db, 'relationships', relationshipId, 'events'), orderBy('dateTime', 'desc'), limit(200)),
            snapshot => {
                setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoadingData(false);
            },
            error => { console.error('Error cargando eventos de la línea de tiempo:', error); setLoadingData(false); }
        );

        const unsubPhotos = onSnapshot(
            query(collection(db, 'relationships', relationshipId, 'photos'), orderBy('createdAt', 'desc'), limit(200)),
            snapshot => setPhotos(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
            error => console.error('Error cargando fotos de la línea de tiempo:', error)
        );

        return () => { unsubEvents(); unsubPhotos(); };
    }, [relationshipId, plan]);

    const start: Date | null = userData?.relationshipStartDate?.toDate
        ? userData.relationshipStartDate.toDate()
        : null;
    const startTime = start?.getTime();

    const entries = useMemo<Entry[]>(() => {
        const now = new Date();
        const list: Entry[] = [];

        if (start) {
            list.push({ key: 'start', date: start, kind: 'start', title: 'El día en que empezaron' });

            // Hitos ya cumplidos. Solo los aniversarios y los medios años: si
            // entraran los doce mesversarios de cada año, la historia real
            // —fotos y eventos— quedaría enterrada bajo una lista de meses.
            const totalMonths = monthsElapsed(start, now);
            for (let months = 6; months <= totalMonths; months += 6) {
                const date = addMonths(start, months);
                const isAnniversary = months % 12 === 0;
                list.push({
                    key: `milestone-${months}`,
                    date,
                    kind: 'milestone',
                    title: isAnniversary ? anniversaryTitle(months / 12) : monthiversaryTitle(months),
                });
            }
        }

        events.forEach(event => {
            const date = event.dateTime?.toDate ? event.dateTime.toDate() : null;
            // Solo lo que ya ocurrió: lo que viene está en Calendario, y
            // mezclarlo convertiría la historia en una agenda.
            if (!date || date > now) return;
            list.push({
                key: `event-${event.id}`,
                date,
                kind: 'event',
                title: event.title,
                subtitle: event.description || undefined,
            });
        });

        photos.forEach(photo => {
            const date = photo.createdAt?.toDate ? photo.createdAt.toDate() : null;
            if (!date) return;
            list.push({
                key: `photo-${photo.id}`,
                date,
                kind: 'photo',
                title: 'Una foto',
                imageUrl: photo.imageUrl,
            });
        });

        list.sort((a, b) => b.date.getTime() - a.date.getTime());
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [events, photos, startTime]);

    // Agrupadas por mes, que es como la gente recuerda: "en marzo fuimos a…".
    const groups = useMemo(() => {
        const byMonth: { label: string; items: Entry[] }[] = [];
        entries.forEach(entry => {
            const label = `${MESES[entry.date.getMonth()]} de ${entry.date.getFullYear()}`;
            const last = byMonth[byMonth.length - 1];
            if (last && last.label === label) last.items.push(entry);
            else byMonth.push({ label, items: [entry] });
        });
        return byMonth;
    }, [entries]);

    if (isLoading || loadingData) return <FullScreenLoader />;

    if (plan !== 'premium') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Ionicons name="git-commit-outline" size={40} color={theme.textFaint} />
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: spacing.s16 }}>
                    La línea de tiempo —sus hitos, sus fotos y lo que fueron viviendo, en una sola vista— es parte de Conexión Total.
                </Text>
                <Button title="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.s16 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: spacing.s12 }}
                        accessibilityRole="button" accessibilityLabel="Volver">
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: theme.text }}>
                        Su historia
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s26 }}>
                    {entries.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: spacing.s26, gap: spacing.s10 }}>
                            <Ionicons name="git-commit-outline" size={38} color={theme.textFaint} />
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text }}>
                                Todavía no hay nada que contar
                            </Text>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
                                Pon la fecha en que empezaron, sube una foto o agrega un evento y acá se irá armando sola.
                            </Text>
                        </View>
                    ) : groups.map(group => (
                        <View key={group.label} style={{ marginBottom: spacing.s20 }}>
                            <Text style={{
                                fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9,
                                textTransform: 'uppercase', color: theme.textFaint, marginBottom: spacing.s10,
                            }}>
                                {group.label}
                            </Text>

                            {group.items.map((entry, index) => (
                                <View key={entry.key} style={{ flexDirection: 'row', gap: spacing.s12 }}>
                                    {/* Riel: el punto del hito y la línea que
                                        baja hasta el siguiente. El último de
                                        cada mes no dibuja línea, para que no
                                        quede colgando bajo el título del mes
                                        siguiente. */}
                                    <View style={{ alignItems: 'center', width: 26 }}>
                                        <View style={{
                                            width: 26, height: 26, borderRadius: 13,
                                            alignItems: 'center', justifyContent: 'center',
                                            backgroundColor: entry.kind === 'start' || entry.kind === 'milestone'
                                                ? theme.affection + '22'
                                                : theme.surfaceAlt,
                                        }}>
                                            <Ionicons
                                                name={ICONS[entry.kind]}
                                                size={13}
                                                color={entry.kind === 'start' || entry.kind === 'milestone' ? theme.affection : theme.textMuted}
                                            />
                                        </View>
                                        {index < group.items.length - 1 && (
                                            <View style={{ width: 1.5, flex: 1, backgroundColor: theme.divider, marginVertical: 2 }} />
                                        )}
                                    </View>

                                    <View style={{ flex: 1, paddingBottom: spacing.s16 }}>
                                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 11.5, color: theme.textFaint }}>
                                            {formatDate(entry.date)}
                                        </Text>
                                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14.5, color: theme.text, marginTop: 2 }}>
                                            {entry.title}
                                        </Text>
                                        {!!entry.subtitle && (
                                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textMuted, marginTop: 2 }}>
                                                {entry.subtitle}
                                            </Text>
                                        )}
                                        {!!entry.imageUrl && (
                                            <TouchableOpacity
                                                onPress={() => router.push('/(tabs)/album')}
                                                accessibilityRole="button"
                                                accessibilityLabel="Ver esta foto en el álbum"
                                                style={{ marginTop: spacing.s8 }}
                                            >
                                                <Image
                                                    source={{ uri: entry.imageUrl }}
                                                    style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: radii.field, backgroundColor: theme.surfaceAlt }}
                                                    resizeMode="cover"
                                                />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    ))}
                </ScrollView>
            </DesktopContentWrap>
        </SafeAreaView>
    );
};

export default TimelineScreen;
