// Selector del recordatorio de un evento — Sprint 10.3c.
//
// Reemplaza al interruptor sí/no. Quien crea el evento elige a quién avisar
// (a mí, a la pareja o a los dos) y con cuánta anticipación. Las
// anticipaciones que ya pasaron se muestran deshabilitadas en vez de
// esconderse: si "1 semana antes" desapareciera para un evento de mañana,
// parecería que la opción no existe.
//
// Vive aparte de calendar.tsx para no seguir agrandando esa pantalla y para
// poder probarlo solo (tests/ui/reminderPicker.test.tsx).
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing } from '../config/theme';
import { useTheme } from '../contexts/themeContext';
import {
    NotifyTarget, ReminderChoice, REMINDER_LEADS, LEAD_LABELS, isLeadAvailable, notifyLabel,
} from '../services/eventReminder';

interface Props {
    choice: ReminderChoice;
    eventDate: Date;
    partnerName: string;
    // Plan free: el recordatorio es Premium. Se muestra bloqueado y tocarlo
    // abre el paywall, igual que el interruptor de antes.
    locked: boolean;
    onChange: (choice: ReminderChoice) => void;
    onLockedPress: () => void;
    // Solo para las pruebas: qué anticipaciones ya pasaron depende de la hora.
    now?: Date;
}

const TARGETS: (NotifyTarget | null)[] = [null, 'me', 'partner', 'both'];

export const ReminderPicker: React.FC<Props> = ({
    choice, eventDate, partnerName, locked, onChange, onLockedPress, now,
}) => {
    const { theme, fontFamilies } = useTheme();
    const reference = now ?? new Date();

    if (locked) {
        return (
            <TouchableOpacity
                onPress={onLockedPress}
                accessibilityRole="button"
                accessibilityLabel="Recordatorio, disponible en Conexión Total"
                style={{
                    flexDirection: 'row', alignItems: 'center', gap: spacing.s10,
                    backgroundColor: theme.primaryTint, borderWidth: 1, borderStyle: 'dashed',
                    borderColor: theme.primary, borderRadius: radii.field, padding: spacing.s14,
                }}
            >
                <Ionicons name="lock-closed" size={18} color={theme.premium} />
                <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.text }}>Recordatorio</Text>
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>
                        Avísale a quien quieras, con la anticipación que elijas · Conexión Total
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    const chip = (key: string, label: string, selected: boolean, disabled: boolean, onPress: () => void, a11yLabel?: string) => (
        <TouchableOpacity
            key={key}
            onPress={onPress}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={a11yLabel ?? label}
            accessibilityState={{ selected, disabled }}
            style={{
                paddingVertical: spacing.s8, paddingHorizontal: spacing.s12,
                borderRadius: radii.field, borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.primary : theme.borderSoft,
                backgroundColor: selected ? theme.primaryTint : theme.surface,
                opacity: disabled ? 0.4 : 1,
            }}
        >
            <Text style={{
                fontFamily: selected ? fontFamilies.bodySemiBold : fontFamilies.body,
                fontSize: 13, color: selected ? theme.primary : theme.text,
            }}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ backgroundColor: theme.surfaceAlt, borderRadius: radii.field, padding: spacing.s14, gap: spacing.s10 }}>
            <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 14, color: theme.text }}>Recordatorio</Text>

            <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                {TARGETS.map(target => chip(
                    target ?? 'none',
                    target ? notifyLabel(target, partnerName) : 'Sin aviso',
                    choice.notify === target,
                    false,
                    () => onChange({ ...choice, notify: target }),
                ))}
            </View>

            {choice.notify && (
                <>
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textFaint }}>¿Cuándo?</Text>
                    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s8 }}>
                        {REMINDER_LEADS.map(lead => {
                            const available = isLeadAvailable(eventDate, lead, reference);
                            return chip(
                                String(lead),
                                LEAD_LABELS[lead],
                                choice.lead === lead,
                                !available,
                                () => onChange({ ...choice, lead }),
                                available ? LEAD_LABELS[lead] : `${LEAD_LABELS[lead]}, ya pasó`,
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );
};
