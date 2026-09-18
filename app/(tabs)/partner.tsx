// Ficha de la pareja — Sprint 9.12.
//
// Junta en un solo lugar lo que hay que tener a mano para prepararle un
// regalo: su cumpleaños, el aniversario, y las tallas y gustos que uno va
// anotando.
//
// Lo importante es DÓNDE se guarda. Las anotaciones viven en
// users/{miUid}/private/partnerProfile, cuya regla solo deja leer y escribir
// al dueño del documento — ni siquiera la pareja puede verlas. Si estuvieran
// en el documento compartido de la relación, la otra persona vería que le
// estás mirando la talla de zapatos y se acabó la sorpresa, que es justo lo
// único que esta pantalla tiene que proteger.
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { db } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { formatDate } from '../../src/services/dateFormat';
import { MeasurementRow } from '../../src/components/MeasurementRow';
import {
    countFilled, fieldsFor, groupsFor, normalizeMeasurements, MeasurementValues,
} from '../../src/config/measurements';
import type { Gender } from '../../src/types/models';
import { captureError } from '../../src/services/errorReporter';

// Las tallas dejaron de ser tres campos fijos en el 9.24: ahora las define el
// catálogo de src/config/measurements.ts, así que viven en un mapa suelto.
interface PartnerNotes {
    sizes: MeasurementValues;
    likes: string;
    notes: string;
}

const EMPTY: PartnerNotes = { sizes: {}, likes: '', notes: '' };

const PartnerSheetScreen: React.FC = () => {
    const router = useRouter();
    const { theme, fontFamilies } = useTheme();
    const { plan, user, userData, partnerData, isLoading } = usePlan();

    const [form, setForm] = useState<PartnerNotes>(EMPTY);
    // Lo ya persistido, que es lo que decide el tick verde: mientras se
    // escribe sigue gris y se pone verde al guardar.
    const [savedSizes, setSavedSizes] = useState<MeasurementValues>({});
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;

        getDoc(doc(db, 'users', user.uid, 'private', 'partnerProfile'))
            .then(snapshot => {
                if (cancelled) return;
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    // Las tallas están sueltas en la raíz del documento (así se
                    // guardaban antes del 9.24 y así se siguen guardando, para
                    // no migrar nada); normalizeMeasurements las recoge y de
                    // paso traduce la vieja 'clothingSize'.
                    setForm({
                        sizes: normalizeMeasurements(data),
                        likes: typeof data.likes === 'string' ? data.likes : '',
                        notes: typeof data.notes === 'string' ? data.notes : '',
                    });
                    setSavedSizes(normalizeMeasurements(data));
                }
            })
            .catch(error => console.error('Error cargando la ficha:', error))
            .finally(() => { if (!cancelled) setLoadingNotes(false); });

        return () => { cancelled = true; };
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await setDoc(
                doc(db, 'users', user.uid, 'private', 'partnerProfile'),
                { ...form.sizes, likes: form.likes, notes: form.notes, updatedAt: serverTimestamp() },
                { merge: true }
            );
            setSavedSizes(form.sizes);
            Toast.show({ type: 'success', text1: 'Ficha guardada' });
            router.back();
        } catch (error) {
            console.error('Error guardando la ficha:', error);
            captureError(error, { origin: 'guardarFicha' });
            Toast.show({ type: 'error', text1: 'No se pudo guardar la ficha' });
        }
        setIsSaving(false);
    };

    if (isLoading || loadingNotes) return <FullScreenLoader />;

    if (plan !== 'premium') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Ionicons name="gift-outline" size={40} color={theme.textFaint} />
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: spacing.s16 }}>
                    La ficha de la pareja —tallas, gustos y notas privadas para preparar regalos— es exclusiva de Conexión Total.
                </Text>
                <Button title="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.s16 }} />
            </SafeAreaView>
        );
    }

    if (!userData?.partnerId || !partnerData) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center' }}>
                    Conéctate con tu pareja para armar su ficha.
                </Text>
                <Button title="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.s16 }} />
            </SafeAreaView>
        );
    }

    const partnerName = partnerData.displayName || 'tu pareja';

    // Qué tallas se preguntan depende del género de ELLA, no del mío: son sus
    // prendas. Sin género declarado se muestran todas (ver measurements.ts).
    // Nada de useMemo acá: estamos pasados los early return de arriba y los
    // hooks no pueden ir después de un return condicional.
    const partnerGender: Gender | null = (partnerData.gender as Gender) ?? null;
    const sizeGroups = groupsFor(partnerGender);
    const sizeFields = fieldsFor(partnerGender);

    // Lo que ella misma declaró en "Mis tallas". Llega por el listener de
    // planContext, así que si lo cambia mientras tengo la ficha abierta, se
    // actualiza sola.
    const declaredSizes = normalizeMeasurements(partnerData.measurements);
    const declaredCount = countFilled(declaredSizes, sizeFields);

    // El contador cuenta las dos fuentes: lo que ella declaró ya es un dato
    // que tengo, no algo que me falte por averiguar.
    const sizesTotal = sizeFields.length;
    const sizesFilled = sizeFields.filter(
        f => !!(savedSizes[f.key]?.trim() || declaredSizes[f.key])
    ).length;
    const birth = partnerData.birthDate?.toDate ? partnerData.birthDate.toDate() : null;
    const anniversary = userData.relationshipStartDate?.toDate ? userData.relationshipStartDate.toDate() : null;

    const labelStyle = {
        fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9,
        textTransform: 'uppercase' as const, color: theme.textMuted, marginBottom: spacing.s8,
    };
    const inputStyle = {
        borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
        paddingHorizontal: spacing.s16 - 1, color: theme.text,
        fontFamily: fontFamilies.body, fontSize: 15, backgroundColor: theme.inputBackground,
    };

    const setText = (key: 'likes' | 'notes') => (value: string) =>
        setForm(prev => ({ ...prev, [key]: value }));

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
                <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: spacing.s12 }}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: theme.text }}>
                    Ficha de {partnerName}
                </Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s26, gap: spacing.s20 }}>
                {/* Lo primero que se lee, porque es lo que hace usable la
                    pantalla: si alguien duda de si su pareja puede ver esto,
                    no va a anotar nada. */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                    backgroundColor: theme.surfaceAlt, borderRadius: radii.card, padding: spacing.s14,
                }}>
                    <Ionicons name="lock-closed" size={18} color={theme.textMuted} />
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, flex: 1 }}>
                        Solo tú ves esta ficha. {partnerName} no puede abrirla ni enterarse de lo que anotes acá.
                    </Text>
                </View>

                {/* Datos que ya conoce la app */}
                <View style={{ backgroundColor: theme.surface, borderRadius: radii.card, borderWidth: 1, borderColor: theme.borderSoft }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, padding: spacing.s14 }}>
                        <Ionicons name="balloon-outline" size={18} color={theme.affection} />
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, flex: 1 }}>Cumpleaños</Text>
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: birth ? theme.text : theme.textFaint }}>
                            {birth ? formatDate(birth) : 'Aún no la ha puesto'}
                        </Text>
                    </View>
                    <View style={{ height: 1, backgroundColor: theme.divider }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s12, padding: spacing.s14 }}>
                        <Ionicons name="heart-outline" size={18} color={theme.affection} />
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, flex: 1 }}>Aniversario</Text>
                        <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: anniversary ? theme.text : theme.textFaint }}>
                            {anniversary ? formatDate(anniversary) : 'Sin definir'}
                        </Text>
                    </View>
                </View>

                {/* Tallas — Sprint 9.24. Dos fuentes en la misma fila: lo
                    que {partnerName} declaró en "Mis tallas" (aparece en gris,
                    y no hay nada que averiguar) y lo que yo anoto encima, que
                    es privado. El tick verde dice que el dato existe, venga de
                    donde venga. */}
                <View style={{ gap: spacing.s14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                        <Text style={[labelStyle, { marginBottom: 0, flex: 1 }]}>
                            Tallas · {sizesFilled} de {sizesTotal}
                        </Text>
                    </View>

                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 18, color: theme.textFaint }}>
                        {declaredCount > 0
                            ? `Lo que ${partnerName} declaró manda y no se edita acá: si algo está mal, lo corrige ella desde "Mis tallas". El resto puedes anotarlo tú.`
                            : `${partnerName} todavía no declara ninguna, así que puedes anotarlas tú. Cuando las declare, manda lo que diga ella.`}
                    </Text>

                    {sizeGroups.map(group => (
                        <View key={group.key}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8, marginBottom: spacing.s8 }}>
                                <Ionicons name={group.icon} size={15} color={theme.textMuted} />
                                <Text style={[labelStyle, { marginBottom: 0 }]}>{group.title}</Text>
                            </View>
                            <View style={{
                                backgroundColor: theme.surface, borderRadius: radii.card,
                                borderWidth: 1, borderColor: theme.borderSoft,
                            }}>
                                {group.fields.map((field, index) => {
                                    const declared = declaredSizes[field.key];
                                    const myNote = form.sizes[field.key] ?? '';

                                    // Manda lo que ella declaró. Lo que yo
                                    // anoté es una suposición mientras ella no
                                    // ha dicho nada; en cuanto lo dice, mi
                                    // anotación deja de usarse.
                                    const sourceNote = declared
                                        ? (myNote.trim() && myNote.trim() !== declared
                                            ? `Lo puso ${partnerName} · tú anotaste ${myNote.trim()}`
                                            : `Lo puso ${partnerName}`)
                                        : (savedSizes[field.key]?.trim() ? 'Anotado por ti' : undefined);

                                    return (
                                        <MeasurementRow
                                            key={field.key}
                                            label={field.label}
                                            hint={field.hint}
                                            sourceNote={sourceNote}
                                            value={declared || myNote}
                                            placeholder={field.placeholder}
                                            saved={!!(savedSizes[field.key]?.trim() || declared)}
                                            isLast={index === group.fields.length - 1}
                                            readOnly={!!declared}
                                            onChangeText={text => setForm(prev => ({
                                                ...prev, sizes: { ...prev.sizes, [field.key]: text },
                                            }))}
                                        />
                                    );
                                })}
                            </View>
                        </View>
                    ))}
                </View>

                <View>
                    <Text style={labelStyle}>Le gusta</Text>
                    <TextInput
                        style={[inputStyle, { minHeight: 92, paddingVertical: spacing.s12, textAlignVertical: 'top' }]}
                        placeholder="Colores, marcas, perfumes, cosas que ha mencionado de pasada…"
                        placeholderTextColor={theme.textFaint}
                        value={form.likes}
                        onChangeText={setText('likes')}
                        multiline
                        maxLength={600}
                    />
                </View>

                <View>
                    <Text style={labelStyle}>Notas</Text>
                    <TextInput
                        style={[inputStyle, { minHeight: 92, paddingVertical: spacing.s12, textAlignVertical: 'top' }]}
                        placeholder="Ideas de regalo, tiendas, lo que ya le regalaste…"
                        placeholderTextColor={theme.textFaint}
                        value={form.notes}
                        onChangeText={setText('notes')}
                        multiline
                        maxLength={600}
                    />
                </View>

                <Button title="Guardar ficha" onPress={handleSave} loading={isSaving} />
            </ScrollView>
            </DesktopContentWrap>
        </SafeAreaView>
    );
};

export default PartnerSheetScreen;
