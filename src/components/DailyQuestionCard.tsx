// Tarjeta de la pregunta del día — Sprint 9.21.
//
// La mecánica es la que sostiene la sección: la respuesta de la otra persona
// aparece recién cuando uno responde la suya. Si se viera antes, la mitad
// contestaría copiando y la pregunta dejaría de decir nada. Y saber que el
// otro ya respondió —sin ver qué— es justamente lo que hace volver a abrir la
// app.
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { db } from '../config/firebaseConfig';
import { radii, spacing } from '../config/theme';
import { usePlan } from '../contexts/planContext';
import { useTheme } from '../contexts/themeContext';
import { questionFor, questionIndexFor, DAILY_QUESTIONS } from '../config/dailyQuestions';

const todayKey = (): string => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
};

const MAX_ANSWER = 500;

export const DailyQuestionCard: React.FC<{ onArchiveBlocked: () => void }> = ({ onArchiveBlocked }) => {
    const { theme, fontFamilies } = useTheme();
    const { user, userData, partnerData, plan } = usePlan();
    const router = useRouter();

    const partnerId = userData?.partnerId as string | undefined;
    const relationshipId = user && partnerId ? [user.uid, partnerId].sort().join('_') : null;
    const dateKey = todayKey();

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [draft, setDraft] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!relationshipId) return;
        const ref = doc(db, 'relationships', relationshipId, 'dailyQuestions', dateKey);
        const unsubscribe = onSnapshot(
            ref,
            snapshot => {
                setAnswers((snapshot.data()?.answers ?? {}) as Record<string, string>);
                setIsLoading(false);
            },
            error => {
                console.error('Error cargando la pregunta del día:', error);
                setIsLoading(false);
            }
        );
        return () => unsubscribe();
    }, [relationshipId, dateKey]);

    if (!relationshipId || !user) return null;

    const question = questionFor(dateKey, relationshipId);
    const myAnswer = answers[user.uid] ?? '';
    const partnerAnswer = partnerId ? answers[partnerId] ?? '' : '';
    const partnerName = partnerData?.displayName || 'Tu pareja';

    const handleAnswer = async () => {
        const text = draft.trim();
        if (!text) return;

        setIsSaving(true);
        try {
            // merge: true hace dos cosas necesarias. Conserva la respuesta de
            // la otra persona dentro del mapa (que es lo que las reglas
            // exigen), y sirve igual cuando el documento del día todavía no
            // existe.
            await setDoc(
                doc(db, 'relationships', relationshipId, 'dailyQuestions', dateKey),
                {
                    // Se guarda el índice, aunque se pueda recalcular: si algún
                    // día se agregan preguntas al catálogo, el archivo tiene
                    // que seguir mostrando la que de verdad se respondió.
                    questionIndex: questionIndexFor(dateKey, relationshipId),
                    answers: { [user.uid]: text.slice(0, MAX_ANSWER) },
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            setDraft('');
        } catch (error) {
            console.error('Error guardando la respuesta:', error);
            Toast.show({ type: 'error', text1: 'No se pudo guardar tu respuesta' });
        }
        setIsSaving(false);
    };

    return (
        <View style={{
            backgroundColor: theme.surface,
            borderRadius: radii.card,
            borderWidth: 1,
            borderColor: theme.borderSoft,
            padding: spacing.s16,
            marginBottom: spacing.s16,
            gap: spacing.s12,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.affection} />
                <Text style={{
                    fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9,
                    textTransform: 'uppercase', color: theme.textMuted, flex: 1,
                }}>
                    Pregunta del día
                </Text>
                <TouchableOpacity onPress={() => plan === 'premium' ? router.push('/questions') : onArchiveBlocked()}>
                    <Text style={{ fontFamily: fontFamilies.action, fontSize: 12, color: theme.primary }}>
                        Anteriores
                    </Text>
                </TouchableOpacity>
            </View>

            <Text style={{ fontFamily: fontFamilies.display, fontSize: 20, lineHeight: 26, color: theme.text }}>
                {question}
            </Text>

            {isLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
            ) : !myAnswer ? (
                <>
                    <TextInput
                        style={{
                            minHeight: 78, paddingHorizontal: spacing.s14, paddingVertical: spacing.s12,
                            borderWidth: 1, borderColor: theme.borderSoft, borderRadius: radii.field,
                            backgroundColor: theme.inputBackground, color: theme.text,
                            fontFamily: fontFamilies.body, fontSize: 14.5, textAlignVertical: 'top',
                        }}
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="Tu respuesta…"
                        placeholderTextColor={theme.textFaint}
                        accessibilityLabel={question}
                        multiline
                        maxLength={MAX_ANSWER}
                    />

                    {/* El tirón: saber que ya respondió, sin ver qué. */}
                    {!!partnerAnswer && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                            <Ionicons name="lock-closed" size={13} color={theme.premium} />
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12.5, color: theme.textMuted, flex: 1 }}>
                                {partnerName} ya respondió. Responde para ver qué dijo.
                            </Text>
                        </View>
                    )}

                    <TouchableOpacity
                        onPress={handleAnswer}
                        disabled={!draft.trim() || isSaving}
                        style={{
                            backgroundColor: theme.primary, borderRadius: radii.field,
                            paddingVertical: spacing.s12, alignItems: 'center',
                            opacity: !draft.trim() || isSaving ? 0.5 : 1,
                        }}
                    >
                        {isSaving
                            ? <ActivityIndicator size="small" color={theme.white} />
                            : <Text style={{ fontFamily: fontFamilies.actionBold, fontSize: 14.5, color: theme.white }}>Responder</Text>}
                    </TouchableOpacity>
                </>
            ) : (
                <>
                    <AnswerBubble who="Tú" text={myAnswer} mine />
                    {partnerAnswer
                        ? <AnswerBubble who={partnerName} text={partnerAnswer} />
                        : (
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint }}>
                                {partnerName} todavía no responde.
                            </Text>
                        )}
                </>
            )}
        </View>
    );
};

const AnswerBubble: React.FC<{ who: string; text: string; mine?: boolean }> = ({ who, text, mine }) => {
    const { theme, fontFamilies } = useTheme();
    return (
        <View style={{
            backgroundColor: mine ? theme.surfaceAlt : theme.primaryTint,
            borderRadius: radii.field,
            padding: spacing.s12,
        }}>
            <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, color: theme.textMuted, marginBottom: 3 }}>
                {who}
            </Text>
            <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20, color: theme.text }}>
                {text}
            </Text>
        </View>
    );
};

// Se exporta para el archivo (app/(tabs)/questions.tsx), que muestra las
// preguntas de días pasados con el mismo formato de respuestas.
export { AnswerBubble, DAILY_QUESTIONS };
