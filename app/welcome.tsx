// Bienvenida de la pareja recién conectada — Sprint 10.2.
//
// Aparece en el único momento en que tiene sentido: cuando la pareja ya quedó
// formada. Antes de eso casi nada de la app funciona, porque no hay con quién
// usarlo, y una bienvenida que muestra cosas que todavía no se pueden tocar
// enseña a ignorar las bienvenidas.
//
// Se puede saltar en cualquier paso, y saltar TAMBIÉN la marca como vista: si
// reapareciera en cada arranque, la segunda vez ya nadie la lee. Queda
// disponible para siempre desde Ajustes.
//
// El último paso pide el permiso de notificaciones. Ese es el lugar correcto:
// después de haber explicado para qué sirven, no de golpe al abrir la app por
// primera vez, que es cuando la gente dice que no por reflejo.
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../src/config/firebaseConfig';
import { spacing } from '../src/config/theme';
import { usePlan } from '../src/contexts/planContext';
import { useTheme } from '../src/contexts/themeContext';
import { Button } from '../src/components/Button';
import { DesktopContentWrap } from '../src/components/DesktopContentWrap';
import { ensureNotificationPermissions, registerPushToken } from '../src/services/notifications';
import { markOnboardingDismissed } from '../src/services/onboardingSession';

interface Step {
    icon: keyof typeof Ionicons.glyphMap;
    title: (partnerName: string) => string;
    body: (partnerName: string) => string;
}

const STEPS: Step[] = [
    {
        icon: 'heart',
        title: name => `Ya están conectados con ${name}`,
        body: name =>
            `Desde ahora todo lo que hagan acá es de los dos. Si echas de menos a ${name}, mándale un «te extraño» desde Inicio: le llega al instante. Y el ánimo que elijas ahí lo ve al abrir la app.`,
    },
    {
        icon: 'chatbubble-ellipses',
        title: () => 'Una pregunta cada día',
        body: name =>
            `Todos los días les toca la misma pregunta a los dos. La respuesta de ${name} se destapa recién cuando respondes la tuya, así que nadie copia. Es lo que hace que abrir la app tenga sentido un martes cualquiera.`,
    },
    {
        icon: 'shirt',
        title: () => 'Tus tallas, para que no las adivine',
        body: name =>
            `Si dejas anotadas tus tallas, ${name} las ve cuando quiera regalarte algo. Son preguntas sueltas, una a la vez, y puedes responder las que quieras.`,
    },
    {
        icon: 'gift',
        title: () => 'Nadie se olvida de una fecha',
        body: name =>
            `Antes de su aniversario o del cumpleaños de ${name}, Inicio te avisa y te muestra qué pidió y qué talla usa. Y las fotos que suban al álbum vuelven solas: dentro de un año van a aparecer como recuerdo de un día como hoy.`,
    },
    {
        icon: 'notifications',
        title: () => '¿Te avisamos?',
        body: name =>
            `Solo para lo que importa: un mensaje de ${name}, un «te extraño», o que comentó una foto. Puedes apagar cada tipo de aviso por separado en Ajustes.`,
    },
];

const WelcomeScreen: React.FC = () => {
    const router = useRouter();
    const { theme, fontFamilies } = useTheme();
    const { user, partnerData } = usePlan();

    const [index, setIndex] = useState(0);
    const [isFinishing, setIsFinishing] = useState(false);

    const partnerName = partnerData?.displayName || 'tu pareja';
    const step = STEPS[index];
    const isLast = index === STEPS.length - 1;

    const finish = async () => {
        setIsFinishing(true);
        if (user) {
            // Se avisa ANTES de escribir, no después: si la escritura falla,
            // igual hay que poder salir de acá.
            markOnboardingDismissed(user.uid);
            try {
                // Timestamp.now() del cliente y no serverTimestamp().
                //
                // Firestore entrega el snapshot local de inmediato, pero con
                // los campos de serverTimestamp() en null hasta que el
                // servidor confirma. El guardia leía ese null como "todavía
                // no ha visto la bienvenida" y devolvía acá: se salía al
                // inicio y se volvía, en bucle.
                //
                // Este campo solo marca que alguien ya vio la bienvenida. Que
                // la hora la ponga el teléfono no tiene ninguna consecuencia,
                // y a cambio el valor está disponible al instante.
                await setDoc(doc(db, 'users', user.uid), { onboardedAt: Timestamp.now() }, { merge: true });
            } catch (error) {
                console.error('No se pudo marcar la bienvenida como vista:', error);
            }
        }
        router.replace('/(tabs)/home');
    };

    const next = async () => {
        if (!isLast) {
            setIndex(index + 1);
            return;
        }

        // Último paso: se pide el permiso y recién después se termina. Que lo
        // niegue no bloquea nada — la app funciona igual, solo sin avisos.
        try {
            const granted = await ensureNotificationPermissions();
            if (granted && user) await registerPushToken(user.uid);
        } catch (error) {
            console.error('No se pudo configurar las notificaciones:', error);
        }
        await finish();
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
            <DesktopContentWrap>
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.s16, paddingTop: spacing.s12 }}>
                    <TouchableOpacity
                        onPress={finish}
                        disabled={isFinishing}
                        accessibilityRole="button"
                        accessibilityLabel="Saltar la bienvenida"
                        style={{ padding: spacing.s8 }}
                    >
                        <Text style={{ fontFamily: fontFamilies.action, fontSize: 14, color: theme.textMuted }}>
                            Saltar
                        </Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.s22, justifyContent: 'center', gap: spacing.s20 }}>
                    <View style={{
                        width: 62, height: 62, borderRadius: 22,
                        backgroundColor: theme.primaryTint,
                        alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Ionicons name={step.icon} size={28} color={theme.primary} />
                    </View>

                    <Text style={{ fontFamily: fontFamilies.display, fontSize: 30, lineHeight: 36, color: theme.text }}>
                        {step.title(partnerName)}
                    </Text>
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 15.5, lineHeight: 24, color: theme.textMuted }}>
                        {step.body(partnerName)}
                    </Text>
                </ScrollView>

                <View style={{ padding: spacing.s22, gap: spacing.s16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.s6 }}>
                        {STEPS.map((_, dot) => (
                            <View
                                key={dot}
                                style={{
                                    width: dot === index ? 18 : 6, height: 6, borderRadius: 3,
                                    backgroundColor: dot === index ? theme.primary : theme.borderSoft,
                                }}
                            />
                        ))}
                    </View>

                    <Button
                        title={isLast ? 'Activar avisos y empezar' : 'Siguiente'}
                        onPress={next}
                        loading={isFinishing}
                    />

                    {isLast && (
                        <TouchableOpacity
                            onPress={finish}
                            disabled={isFinishing}
                            accessibilityRole="button"
                            style={{ alignItems: 'center', paddingVertical: spacing.s4 }}
                        >
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.textMuted }}>
                                Ahora no
                            </Text>
                        </TouchableOpacity>
                    )}

                    {index > 0 && !isLast && (
                        <TouchableOpacity
                            onPress={() => setIndex(index - 1)}
                            accessibilityRole="button"
                            style={{ alignItems: 'center', paddingVertical: spacing.s4 }}
                        >
                            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 13.5, color: theme.textMuted }}>
                                Atrás
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </DesktopContentWrap>
        </SafeAreaView>
    );
};

export default WelcomeScreen;
