// Archivo de la pregunta del día — Sprint 9.21, exclusivo de Conexión Total.
//
// El free ve la de hoy; lo que se paga es poder volver a leerlas. Con el
// tiempo esto es lo más parecido a un diario de la relación escrito entre los
// dos, y es lo que hace caro irse de la app.
//
// La regla del canje se mantiene hacia atrás: si un día no respondiste, la
// respuesta de la otra persona sigue tapada. Si el archivo la mostrara, bastaría
// con esperar a mañana para leer sin haber contestado nunca.
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../src/config/firebaseConfig';
import { radii, spacing } from '../../src/config/theme';
import { usePlan } from '../../src/contexts/planContext';
import { useTheme } from '../../src/contexts/themeContext';
import { Button } from '../../src/components/Button';
import { FullScreenLoader } from '../../src/components/FullScreenLoader';
import { DesktopContentWrap } from '../../src/components/DesktopContentWrap';
import { AnswerBubble } from '../../src/components/DailyQuestionCard';
import { DAILY_QUESTIONS, questionIndexFor } from '../../src/config/dailyQuestions';
import { formatDate } from '../../src/services/dateFormat';

interface ArchivedDay {
    dateKey: string;
    questionIndex?: number;
    answers: Record<string, string>;
}

const QuestionsArchiveScreen: React.FC = () => {
    const router = useRouter();
    const { theme, fontFamilies } = useTheme();
    const { user, userData, partnerData, plan, isLoading } = usePlan();

    const partnerId = userData?.partnerId as string | undefined;
    const relationshipId = user && partnerId ? [user.uid, partnerId].sort().join('_') : null;

    const [days, setDays] = useState<ArchivedDay[]>([]);
    const [loadingDays, setLoadingDays] = useState(true);

    useEffect(() => {
        if (!relationshipId || plan !== 'premium') {
            setLoadingDays(false);
            return;
        }

        // Por nombre del documento, que es la fecha 'YYYY-MM-DD': ordena igual
        // que por fecha y no necesita índice compuesto.
        const q = query(
            collection(db, 'relationships', relationshipId, 'dailyQuestions'),
            orderBy('__name__', 'desc'),
            limit(120)
        );

        const unsubscribe = onSnapshot(
            q,
            snapshot => {
                setDays(snapshot.docs.map(d => ({
                    dateKey: d.id,
                    questionIndex: d.data().questionIndex,
                    answers: (d.data().answers ?? {}) as Record<string, string>,
                })));
                setLoadingDays(false);
            },
            error => {
                console.error('Error cargando el archivo de preguntas:', error);
                setLoadingDays(false);
            }
        );

        return () => unsubscribe();
    }, [relationshipId, plan]);

    if (isLoading || loadingDays) return <FullScreenLoader />;

    if (plan !== 'premium') {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.s22 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.textFaint} />
                <Text style={{ fontFamily: fontFamilies.body, fontSize: 14, color: theme.textMuted, textAlign: 'center', marginTop: spacing.s16 }}>
                    Guardar todas las preguntas y respuestas es parte de Conexión Total. La de hoy siempre es gratis.
                </Text>
                <Button title="Volver" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.s16 }} />
            </SafeAreaView>
        );
    }

    const partnerName = partnerData?.displayName || 'Tu pareja';

    const parseKey = (dateKey: string): Date => {
        const [year, month, day] = dateKey.split('-').map(Number);
        return new Date(year, month - 1, day);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
            <DesktopContentWrap>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.s16, paddingVertical: spacing.s12 }}>
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: spacing.s12 }}
                        accessibilityRole="button" accessibilityLabel="Volver">
                        <Ionicons name="arrow-back" size={24} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 25, color: theme.text }}>
                        Sus respuestas
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ padding: spacing.s22, paddingBottom: spacing.s26, gap: spacing.s16 }}>
                    {days.length === 0 ? (
                        <View style={{ alignItems: 'center', paddingVertical: spacing.s26, gap: spacing.s10 }}>
                            <Ionicons name="chatbubble-ellipses-outline" size={38} color={theme.textFaint} />
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 15, color: theme.text }}>
                                Todavía no hay respuestas
                            </Text>
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>
                                Responde la pregunta de hoy en Inicio y acá se irán guardando todas.
                            </Text>
                        </View>
                    ) : days.map(day => {
                        const index = typeof day.questionIndex === 'number'
                            ? day.questionIndex
                            : questionIndexFor(day.dateKey, relationshipId!);
                        const myAnswer = user ? day.answers[user.uid] ?? '' : '';
                        const partnerAnswer = partnerId ? day.answers[partnerId] ?? '' : '';

                        return (
                            <View key={day.dateKey} style={{
                                backgroundColor: theme.surface, borderRadius: radii.card,
                                borderWidth: 1, borderColor: theme.borderSoft,
                                padding: spacing.s16, gap: spacing.s10,
                            }}>
                                <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint }}>
                                    {formatDate(parseKey(day.dateKey))}
                                </Text>
                                <Text style={{ fontFamily: fontFamilies.display, fontSize: 17, lineHeight: 23, color: theme.text }}>
                                    {DAILY_QUESTIONS[index] ?? 'Pregunta del día'}
                                </Text>

                                {myAnswer ? (
                                    <>
                                        <AnswerBubble who="Tú" text={myAnswer} mine />
                                        {partnerAnswer
                                            ? <AnswerBubble who={partnerName} text={partnerAnswer} />
                                            : (
                                                <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint }}>
                                                    {partnerName} no respondió ese día.
                                                </Text>
                                            )}
                                    </>
                                ) : (
                                    // El canje también vale hacia atrás: sin
                                    // respuesta propia, la del otro sigue tapada.
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s8 }}>
                                        <Ionicons name="lock-closed" size={13} color={theme.textFaint} />
                                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint, flex: 1 }}>
                                            {partnerAnswer
                                                ? `Ese día no respondiste, así que la respuesta de ${partnerName} quedó guardada sin abrir.`
                                                : 'Ninguno de los dos respondió ese día.'}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </ScrollView>
            </DesktopContentWrap>
        </SafeAreaView>
    );
};

export default QuestionsArchiveScreen;
