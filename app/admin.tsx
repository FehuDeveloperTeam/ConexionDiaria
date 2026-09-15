// Panel administrativo — Sprint 10.1.
//
// Vive dentro de la misma app y no en un proyecto aparte: reutiliza el login,
// el diseño y el despliegue que ya existen, y no hay una segunda base de
// código que mantener al día. Queda fuera del grupo de pestañas porque no le
// corresponde el riel de la app, y es invisible para quien no sea
// administrador.
//
// Lo que NO hay acá, a propósito: datos de una pareja. La app está construida
// para que nadie de afuera pueda leer nada, y el panel no es una excepción —
// las reglas de Firestore no le dan acceso ni siendo administrador (hay
// pruebas que lo comprueban). Los números son agregados que escribe el
// servidor, y la ficha de soporte pasa por una función que devuelve cinco
// campos y ninguno más.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/config/firebaseConfig';
import { radii, spacing } from '../src/config/theme';
import { useTheme } from '../src/contexts/themeContext';
import { useIsAdmin } from '../src/hooks/useIsAdmin';
import { Button } from '../src/components/Button';
import { FullScreenLoader } from '../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../src/components/DesktopContentWrap';
import { MiniBarChart, DailyPoint } from '../src/components/MiniBarChart';
import { DEFAULT_FOUNDER_LIMIT } from '../src/services/founders';

interface Summary {
    totalUsers?: number;
    totalCouples?: number;
    premiumUsers?: number;
}

interface DailyRow {
    date: string;
    messages?: number;
    photos?: number;
    answers?: number;
    activeUsers?: number;
    newUsers?: number;
    newCouples?: number;
    newPremium?: number;
}

interface LookupResult {
    uid: string;
    plan: string;
    createdAt: string | null;
    isPaired: boolean;
    founderNumber: number | null;
    usedStorage: number | null;
}

const DAYS = 30;

const formatBytes = (bytes: number | null): string => {
    if (bytes === null) return '—';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AdminScreen: React.FC = () => {
    const router = useRouter();
    const { theme, fontFamilies } = useTheme();
    const { isAdmin, isChecking } = useIsAdmin();

    const [summary, setSummary] = useState<Summary | null>(null);
    const [days, setDays] = useState<DailyRow[]>([]);
    const [foundersLeft, setFoundersLeft] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [email, setEmail] = useState('');
    const [lookup, setLookup] = useState<LookupResult | null>(null);
    const [lookupError, setLookupError] = useState<string | null>(null);
    const [isLookingUp, setIsLookingUp] = useState(false);

    useEffect(() => {
        if (!isAdmin) {
            setIsLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const [summarySnap, daysSnap, foundersSnap] = await Promise.all([
                    getDoc(doc(db, 'adminMetrics', 'summary')),
                    getDocs(query(collection(db, 'adminDaily'), orderBy('__name__', 'desc'), limit(DAYS))),
                    getDoc(doc(db, 'appConfig', 'founders')),
                ]);

                if (cancelled) return;

                setSummary(summarySnap.data() ?? {});
                // Llegan del más nuevo al más viejo (así se piden, para que el
                // límite recorte los días antiguos); el gráfico los quiere al
                // revés.
                setDays(daysSnap.docs.map(d => ({ date: d.id, ...d.data() } as DailyRow)).reverse());

                const founders = foundersSnap.data();
                const claimed = (founders?.claimed as number) ?? 0;
                const cap = (founders?.limit as number) ?? DEFAULT_FOUNDER_LIMIT;
                setFoundersLeft(Math.max(0, cap - claimed));
            } catch (error) {
                console.error('Error cargando el panel:', error);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [isAdmin]);

    const handleLookup = async () => {
        if (!email.trim()) return;
        setIsLookingUp(true);
        setLookup(null);
        setLookupError(null);
        try {
            const callable = httpsCallable<{ email: string }, LookupResult>(getFunctions(), 'adminLookupUser');
            const response = await callable({ email: email.trim() });
            setLookup(response.data);
        } catch (error: any) {
            setLookupError(
                error?.code === 'functions/not-found'
                    ? 'No hay ninguna cuenta con ese correo.'
                    : 'No se pudo consultar. Revisa el correo e inténtalo de nuevo.'
            );
        }
        setIsLookingUp(false);
    };

    if (isChecking || isLoading) return <FullScreenLoader />;

    if (!isAdmin) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Ionicons name="lock-closed-outline" size={40} color={theme.textFaint} />
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: spacing.s16 }}>
                    Esta sección es del equipo de Conexión Diaria.
                </Text>
                <Button title="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.s16 }} />
            </SafeAreaView>
        );
    }

    const pointsOf = (field: keyof DailyRow): DailyPoint[] =>
        days.map(day => ({
            date: day.date,
            // Sin dato guardado es "no se sabe" (-1), no cero: el día puede no
            // haberse calculado todavía.
            value: typeof day[field] === 'number' ? (day[field] as number) : -1,
        }));

    const cardStyle = {
        flex: 1, minWidth: 140,
        backgroundColor: theme.surface, borderRadius: radii.card,
        borderWidth: 1, borderColor: theme.borderSoft,
        padding: spacing.s14,
    };

    const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
        <View style={cardStyle}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 10.5, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.textFaint }}>
                {label}
            </Text>
            <Text style={{ fontFamily: fontFamilies.display, fontSize: 27, color: theme.text, marginTop: 3 }}>
                {value}
            </Text>
            {!!hint && (
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>
                    {hint}
                </Text>
            )}
        </View>
    );

    const sectionLabel = {
        fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9,
        textTransform: 'uppercase' as const, color: theme.textMuted,
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: spacing.s12 }}>
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: theme.text }}>
                        Panel
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s26, gap: spacing.s22 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s10 }}>
                        <Stat label="Cuentas" value={(summary?.totalUsers ?? 0).toLocaleString('es-CL')} />
                        <Stat label="Parejas" value={(summary?.totalCouples ?? 0).toLocaleString('es-CL')} />
                        <Stat
                            label="Premium"
                            value={(summary?.premiumUsers ?? 0).toLocaleString('es-CL')}
                            hint={summary?.totalUsers
                                ? `${Math.round(((summary.premiumUsers ?? 0) / summary.totalUsers) * 100)}% de las cuentas`
                                : undefined}
                        />
                        <Stat
                            label="Cupos de fundador"
                            value={foundersLeft === null ? '—' : foundersLeft.toLocaleString('es-CL')}
                            hint="disponibles"
                        />
                    </View>

                    {days.length === 0 ? (
                        <View style={{
                            backgroundColor: theme.surface, borderRadius: radii.card,
                            borderWidth: 1, borderColor: theme.borderSoft, padding: spacing.s16,
                        }}>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 20, color: theme.textMuted }}>
                                Todavía no hay días calculados. El resumen diario corre pasada la
                                medianoche, así que el primero aparece mañana.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <View style={{
                                backgroundColor: theme.surface, borderRadius: radii.card,
                                borderWidth: 1, borderColor: theme.borderSoft,
                                padding: spacing.s16, gap: spacing.s22,
                            }}>
                                {/* Un gráfico por medida. Ver MiniBarChart para
                                    por qué no van juntos. */}
                                <MiniBarChart title="Personas activas" points={pointsOf('activeUsers')} />
                                <MiniBarChart title="Mensajes" points={pointsOf('messages')} />
                                <MiniBarChart title="Fotos subidas" points={pointsOf('photos')} />
                                <MiniBarChart title="Respuestas del día" points={pointsOf('answers')} />
                            </View>

                            {/* Los mismos datos en números. Un gráfico se lee de
                                un vistazo pero no se puede citar; y si alguien
                                no distingue el tono de las barras, esto sigue
                                sirviendo. */}
                            <View>
                                <Text style={[sectionLabel, { marginBottom: spacing.s10 }]}>Últimos 7 días</Text>
                                <View style={{
                                    backgroundColor: theme.surface, borderRadius: radii.card,
                                    borderWidth: 1, borderColor: theme.borderSoft,
                                }}>
                                    <View style={{
                                        flexDirection: 'row', paddingHorizontal: spacing.s14, paddingVertical: spacing.s10,
                                        borderBottomWidth: 1, borderBottomColor: theme.divider,
                                    }}>
                                        {['Día', 'Activos', 'Mens.', 'Fotos', 'Nuevas'].map((header, i) => (
                                            <Text
                                                key={header}
                                                style={{
                                                    flex: i === 0 ? 1.4 : 1,
                                                    textAlign: i === 0 ? 'left' : 'right',
                                                    fontFamily: fontFamilies.bodyBold, fontSize: 10.5,
                                                    letterSpacing: 0.6, textTransform: 'uppercase', color: theme.textFaint,
                                                }}
                                            >
                                                {header}
                                            </Text>
                                        ))}
                                    </View>
                                    {days.slice(-7).reverse().map((day, index, rows) => (
                                        <View
                                            key={day.date}
                                            style={{
                                                flexDirection: 'row', paddingHorizontal: spacing.s14, paddingVertical: spacing.s10,
                                                borderBottomWidth: index === rows.length - 1 ? 0 : 1,
                                                borderBottomColor: theme.divider,
                                            }}
                                        >
                                            {[
                                                day.date,
                                                day.activeUsers, day.messages, day.photos, day.newUsers,
                                            ].map((cell, i) => (
                                                <Text
                                                    key={i}
                                                    style={{
                                                        flex: i === 0 ? 1.4 : 1,
                                                        textAlign: i === 0 ? 'left' : 'right',
                                                        fontFamily: i === 0 ? fontFamilies.body : fontFamilies.bodySemiBold,
                                                        fontSize: 12.5,
                                                        color: i === 0 ? theme.textMuted : theme.text,
                                                    }}
                                                >
                                                    {typeof cell === 'number' ? (cell < 0 ? '—' : cell) : (cell ?? '—')}
                                                </Text>
                                            ))}
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </>
                    )}

                    {/* Soporte */}
                    <View style={{ gap: spacing.s10 }}>
                        <Text style={sectionLabel}>Buscar una cuenta</Text>
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18, color: theme.textFaint }}>
                            Devuelve plan, fecha de registro y almacenamiento. Nunca mensajes, fotos
                            ni notas: esos no se pueden leer desde acá, y cada consulta queda
                            registrada.
                        </Text>

                        <View style={{ flexDirection: 'row', gap: spacing.s8 }}>
                            <TextInput
                                style={{
                                    flex: 1, height: 46, paddingHorizontal: spacing.s14,
                                    borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                                    backgroundColor: theme.inputBackground, color: theme.text,
                                    fontFamily: fontFamilies.body, fontSize: 14.5,
                                }}
                                value={email}
                                onChangeText={setEmail}
                                placeholder="correo@ejemplo.com"
                                placeholderTextColor={theme.textFaint}
                                accessibilityLabel="Correo de la cuenta a buscar"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                onSubmitEditing={handleLookup}
                            />
                            <TouchableOpacity
                                onPress={handleLookup}
                                disabled={!email.trim() || isLookingUp}
                                accessibilityRole="button"
                                accessibilityLabel="Buscar la cuenta"
                                style={{
                                    width: 46, height: 46, borderRadius: radii.field,
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: theme.primary,
                                    opacity: !email.trim() || isLookingUp ? 0.4 : 1,
                                }}
                            >
                                {isLookingUp
                                    ? <ActivityIndicator size="small" color={theme.white} />
                                    : <Ionicons name="search" size={18} color={theme.white} />}
                            </TouchableOpacity>
                        </View>

                        {!!lookupError && (
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.danger }}>
                                {lookupError}
                            </Text>
                        )}

                        {!!lookup && (
                            <View style={{
                                backgroundColor: theme.surface, borderRadius: radii.card,
                                borderWidth: 1, borderColor: theme.borderSoft, padding: spacing.s14, gap: spacing.s8,
                            }}>
                                {([
                                    ['Plan', lookup.plan === 'premium' ? 'Conexión Total' : 'Free'],
                                    ['Registro', lookup.createdAt ? new Date(lookup.createdAt).toLocaleDateString('es-CL') : '—'],
                                    ['Emparejada', lookup.isPaired ? 'Sí' : 'No'],
                                    ['Fundador', lookup.founderNumber ? `N.º ${lookup.founderNumber}` : 'No'],
                                    ['Almacenamiento', formatBytes(lookup.usedStorage)],
                                ] as [string, string][]).map(([label, value]) => (
                                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, flex: 1 }}>
                                            {label}
                                        </Text>
                                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.text }}>
                                            {value}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </ScrollView>
            </DesktopContentWrap>
        </SafeAreaView>
    );
};

export default AdminScreen;
