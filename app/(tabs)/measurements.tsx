// "Mis tallas" — Sprint 9.24.
//
// El lado espejo de la ficha de la pareja: acá declaro MIS tallas para que la
// persona con la que estoy no tenga que adivinarlas cuando quiera regalarme
// algo. Se guardan en mi propio perfil (users/{uid}.measurements), que la
// regla de Firestore ya deja leer a mi pareja.
//
// La pantalla tiene dos modos sobre los mismos datos:
//   - guía: una pregunta a la vez, solo las que faltan, y cada respuesta se
//     guarda al pasar a la siguiente. Si cierro la app a la mitad, lo
//     respondido ya quedó.
//   - lista: todo junto, para corregir algo puntual.
// Entra en modo guía cuando falta algo y en modo lista cuando ya está todo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { db } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { MeasurementRow } from '../../src/components/MeasurementRow';
import {
    countFilled, fieldsFor, groupsFor, normalizeMeasurements, MeasurementValues,
} from '../../src/config/measurements';
import type { Gender } from '../../src/types/models';
import { captureError } from '../../src/services/errorReporter';

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
    { value: 'female', label: 'Femenino' },
    { value: 'male', label: 'Masculino' },
    { value: 'other', label: 'Prefiero no decirlo' },
];

const MeasurementsScreen: React.FC = () => {
    const router = useRouter();
    // 'guide=1' entra directo al asistente — así lo abre la invitación de
    // Inicio, que es justo quien sabe que hay tallas por responder.
    const { guide } = useLocalSearchParams<{ guide?: string }>();
    const { theme, fontFamilies } = useTheme();
    const { user, userData, partnerData, isLoading } = usePlan();

    // Lo guardado manda: 'userData' llega por listener, así que si lo cambio
    // desde otro dispositivo esta pantalla se entera sola.
    const saved = useMemo(() => normalizeMeasurements(userData?.measurements), [userData?.measurements]);
    const gender: Gender | null = (userData?.gender as Gender) ?? null;

    const groups = useMemo(() => groupsFor(gender), [gender]);
    const fields = useMemo(() => fieldsFor(gender), [gender]);

    // Borrador de la vista de lista. Arranca vacío y cae a lo guardado campo
    // por campo, para no pisar con datos viejos un cambio que llegue del
    // listener mientras esta pantalla está abierta.
    const [draft, setDraft] = useState<MeasurementValues>({});
    const valueOf = (key: string) => draft[key] ?? saved[key] ?? '';

    const pending = useMemo(() => fields.filter(f => !saved[f.key]?.trim()), [fields, saved]);
    const [mode, setMode] = useState<'guide' | 'list'>(() => 'list');
    const [step, setStep] = useState(0);
    const [answer, setAnswer] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Las que faltaban al ENTRAR a la guía. Si se recalculara en cada
    // respuesta, la lista se acortaría bajo los pies y el paso 3 de 5 pasaría
    // a ser el 3 de 4.
    const [queue, setQueue] = useState<typeof fields>([]);

    // ...pero sí se descarta lo que dejó de aplicar. La cola se congela al
    // entrar, y si el género se declara después, lo congelado incluiría
    // preguntas que ya no corresponden.
    const applicableKeys = useMemo(() => new Set(fields.map(f => f.key)), [fields]);
    const activeQueue = useMemo(
        () => queue.filter(field => applicableKeys.has(field.key)),
        [queue, applicableKeys]
    );

    // El arranque en modo guía espera a que el perfil termine de cargar: antes
    // de eso 'pending' son todos los campos, incluidos los ya respondidos.
    const guideStarted = useRef(false);
    useEffect(() => {
        if (guide !== '1' || isLoading || guideStarted.current) return;
        guideStarted.current = true;
        setMode('guide');
    }, [guide, isLoading]);

    // La cola se arma cuando ya sabemos QUÉ preguntar, no al entrar.
    //
    // Antes se armaba al entrar, con el género todavía sin declarar: a un
    // hombre le preguntaba por sostén y por vestido, y elegir "Masculino" no
    // lo corregía, porque la cola ya estaba congelada con esas dos adentro.
    useEffect(() => {
        if (mode !== 'guide' || !gender || queue.length > 0) return;
        setQueue(pending.length > 0 ? pending : fields);
        setStep(0);
        setAnswer('');
    }, [mode, gender, queue.length, pending, fields]);

    const filled = countFilled(saved, fields);
    const total = fields.length;

    const persist = async (values: MeasurementValues) => {
        if (!user) return;
        // Se escribe el mapa completo, con cadena vacía en lo borrado: así no
        // hace falta deleteField() y un campo limpiado queda limpiado de
        // verdad (normalizeMeasurements ignora las vacías).
        const full: MeasurementValues = {};
        for (const field of fields) full[field.key] = values[field.key] ?? saved[field.key] ?? '';
        await setDoc(doc(db, 'users', user.uid), { measurements: full }, { merge: true });
    };

    const startGuide = () => {
        // Vacía: el efecto de arriba la arma con el género ya conocido.
        setQueue([]);
        setStep(0);
        setAnswer('');
        setMode('guide');
    };

    const advance = async (value: string) => {
        const field = activeQueue[step];
        if (!field) return;

        if (value.trim()) {
            setIsSaving(true);
            try {
                await persist({ ...draft, [field.key]: value.trim() });
                setDraft(prev => ({ ...prev, [field.key]: value.trim() }));
            } catch (error) {
                console.error('Error guardando la talla:', error);
                captureError(error, { origin: 'guardarTalla' });
                Toast.show({ type: 'error', text1: 'No se pudo guardar' });
                setIsSaving(false);
                return;
            }
            setIsSaving(false);
        }

        setAnswer('');
        if (step + 1 >= activeQueue.length) {
            setMode('list');
            Toast.show({ type: 'success', text1: 'Listo', text2: 'Tu pareja ya puede verlas.' });
        } else {
            setStep(step + 1);
        }
    };

    const handleSaveList = async () => {
        setIsSaving(true);
        try {
            await persist(draft);
            setDraft({});
            Toast.show({ type: 'success', text1: 'Tallas guardadas' });
        } catch (error) {
            console.error('Error guardando las tallas:', error);
            captureError(error, { origin: 'guardarTallas' });
            Toast.show({ type: 'error', text1: 'No se pudieron guardar' });
        }
        setIsSaving(false);
    };

    const handlePickGender = async (value: Gender) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid), { gender: value }, { merge: true });
        } catch (error) {
            console.error('Error guardando el género:', error);
            Toast.show({ type: 'error', text1: 'No se pudo guardar' });
        }
    };

    if (isLoading) return <FullScreenLoader />;

    const partnerName = partnerData?.displayName || 'tu pareja';
    const sectionLabel = {
        fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9,
        textTransform: 'uppercase' as const, color: theme.textMuted, marginBottom: spacing.s8,
    };

    const current = activeQueue[step];

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: spacing.s12 }}
                        accessibilityRole="button" accessibilityLabel="Volver">
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: theme.text }}>
                        Mis tallas
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s26, gap: spacing.s20 }}>
                    {/* Al revés que la ficha de la pareja, acá lo que hay que
                        dejar claro es que esto SÍ se comparte. */}
                    <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                        backgroundColor: theme.surfaceAlt, borderRadius: radii.card, padding: spacing.s14,
                    }}>
                        <Ionicons name="gift-outline" size={18} color={theme.affection} />
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, flex: 1 }}>
                            {userData?.partnerId
                                ? `${partnerName} puede ver estas tallas cuando quiera regalarte algo. Nada más de tu perfil cambia.`
                                : 'Cuando te conectes con tu pareja, va a poder ver estas tallas para regalarte algo.'}
                        </Text>
                    </View>

                    {/* Se pregunta solo si no está declarado, y con las tallas
                        como motivo: es lo único para lo que se usa acá. En
                        modo guía esto es el primer paso, así que acá solo va
                        en la lista — si no, saldría dos veces. */}
                    {!gender && mode === 'list' && (
                        <View>
                            <Text style={sectionLabel}>Para preguntarte solo lo que te sirve</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                                {GENDER_OPTIONS.map(option => (
                                    <TouchableOpacity
                                        key={option.value}
                                        onPress={() => handlePickGender(option.value)}
                                        style={{
                                            paddingVertical: spacing.s10, paddingHorizontal: spacing.s14,
                                            borderRadius: radii.field, borderWidth: 1, borderColor: theme.borderSoft,
                                            backgroundColor: theme.surface,
                                        }}
                                    >
                                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13, color: theme.text }}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {mode === 'guide' && !gender ? (
                        // Primer paso, y va primero por una razón concreta: la
                        // cola de preguntas se arma con el género ya conocido.
                        // Preguntarlo después obligaba a rehacerla a mitad de
                        // camino, que es justo lo que antes no pasaba.
                        <View style={{
                            backgroundColor: theme.surface, borderRadius: radii.card,
                            borderWidth: 1, borderColor: theme.borderSoft, padding: spacing.s20, gap: spacing.s14,
                        }}>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                                Antes de empezar
                            </Text>
                            <Text style={{ fontFamily: fontFamilies.display, fontSize: 22, color: theme.text }}>
                                ¿Qué prendas te sirven?
                            </Text>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13.5, lineHeight: 20, color: theme.textMuted }}>
                                Así te pregunto solo por lo que usas y no por lo que no.
                            </Text>
                            <View style={{ gap: spacing.s8 }}>
                                {GENDER_OPTIONS.map(option => (
                                    <TouchableOpacity
                                        key={option.value}
                                        onPress={() => handlePickGender(option.value)}
                                        accessibilityRole="button"
                                        style={{
                                            paddingVertical: spacing.s14, paddingHorizontal: spacing.s16,
                                            borderRadius: radii.field, borderWidth: 1, borderColor: theme.borderSoft,
                                            backgroundColor: theme.inputBackground,
                                        }}
                                    >
                                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text }}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : mode === 'guide' && current ? (
                        <View style={{
                            backgroundColor: theme.surface, borderRadius: radii.card,
                            borderWidth: 1, borderColor: theme.borderSoft, padding: spacing.s20, gap: spacing.s14,
                        }}>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                                {step + 1} de {activeQueue.length}
                            </Text>
                            <Text style={{ fontFamily: fontFamilies.display, fontSize: 22, color: theme.text }}>
                                {current.question}
                            </Text>
                            <TextInput
                                style={{
                                    height: 50, paddingHorizontal: spacing.s16 - 1,
                                    borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                                    backgroundColor: theme.inputBackground, color: theme.text,
                                    fontFamily: fontFamilies.body, fontSize: 16,
                                }}
                                value={answer}
                                onChangeText={setAnswer}
                                placeholder={current.placeholder}
                                placeholderTextColor={theme.textFaint}
                                accessibilityLabel={current.question}
                                autoFocus
                                maxLength={14}
                                returnKeyType="next"
                                onSubmitEditing={() => advance(answer)}
                            />
                            {!!current.hint && (
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                                    {current.hint}
                                </Text>
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }}>
                                {/* Saltar sin escribir nada tiene que ser tan
                                    fácil como responder: nadie sabe de memoria
                                    su contorno de cuello. */}
                                <TouchableOpacity onPress={() => advance('')} style={{ paddingVertical: spacing.s10 }}>
                                    <Text style={{ fontFamily: fontFamilies.action, fontSize: 14, color: theme.textMuted }}>
                                        No la sé
                                    </Text>
                                </TouchableOpacity>
                                <View style={{ flex: 1 }} />
                                <Button
                                    title={step + 1 >= activeQueue.length ? 'Terminar' : 'Siguiente'}
                                    onPress={() => advance(answer)}
                                    loading={isSaving}
                                    style={{ minWidth: 140 }}
                                />
                            </View>
                        </View>
                    ) : (
                        <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10 }}>
                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, flex: 1 }}>
                                    {filled} de {total} completadas
                                </Text>
                                {pending.length > 0 && (
                                    <TouchableOpacity onPress={startGuide}>
                                        <Text style={{ fontFamily: fontFamilies.action, fontSize: 13, color: theme.primary }}>
                                            Responder una por una
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {groups.map(group => (
                                <View key={group.key}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s8 }}>
                                        <Ionicons name={group.icon} size={15} color={theme.textMuted} />
                                        <Text style={sectionLabel}>{group.title}</Text>
                                    </View>
                                    <View style={{
                                        backgroundColor: theme.surface, borderRadius: radii.card,
                                        borderWidth: 1, borderColor: theme.borderSoft,
                                    }}>
                                        {group.fields.map((field, index) => (
                                            <MeasurementRow
                                                key={field.key}
                                                label={field.label}
                                                hint={field.hint}
                                                value={valueOf(field.key)}
                                                placeholder={field.placeholder}
                                                saved={!!saved[field.key]?.trim()}
                                                isLast={index === group.fields.length - 1}
                                                onChangeText={text => setDraft(prev => ({ ...prev, [field.key]: text }))}
                                            />
                                        ))}
                                    </View>
                                </View>
                            ))}

                            <Button title="Guardar tallas" onPress={handleSaveList} loading={isSaving} />

                            {/* Esta pantalla es solo lo MÍO, y eso no era
                                evidente: al no encontrar acá las tallas de la
                                otra persona, parece que no estuvieran en
                                ninguna parte. Están en su ficha. */}
                            {!!userData?.partnerId && (
                                <TouchableOpacity
                                    onPress={() => router.push('/partner')}
                                    accessibilityRole="button"
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                                        paddingVertical: spacing.s12, paddingHorizontal: spacing.s14,
                                        borderRadius: radii.field, backgroundColor: theme.surfaceAlt,
                                    }}
                                >
                                    <Ionicons name="person-circle-outline" size={17} color={theme.textMuted} />
                                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.text, flex: 1 }}>
                                        ¿Y las de {partnerName}?
                                    </Text>
                                    <Text style={{ fontFamily: fontFamilies.action, fontSize: 13, color: theme.primary }}>
                                        Ver su ficha
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </ScrollView>
            </DesktopContentWrap>
        </SafeAreaView>
    );
};

export default MeasurementsScreen;
