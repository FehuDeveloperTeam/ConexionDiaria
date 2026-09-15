// Carril derecho de Chat en escritorio — Sprint 8.8 (handoff, "Responsive
// / Escritorio": "Chat en escritorio: conversación central + carril
// derecho con perfil, media compartida, archivos y uso de
// almacenamiento"). Solo aparece a >=1080px (useResponsive().isWide),
// igual que dice el propio handoff para el carril de contexto.
//
// "Media compartida" y "Archivos" se arman filtrando los mensajes YA
// cargados en memoria (los mismos que ve la conversación central) — no
// hay una lectura aparte a Firestore para esto, así que reflejan lo que
// se ha cargado/scrolleado hasta ahora, no un archivo histórico completo.
// Es una limitación consciente: pedirlo aparte tendría un costo de
// lecturas propio que no se justifica solo para esta vista.
import React from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { useTheme } from '../../../contexts/themeContext';
import { spacing } from '../../../config/theme';
import { ExtendedMessage } from '../types';

const SectionLabel: React.FC<{ children: string }> = ({ children }) => {
    const { theme, fontFamilies } = useTheme();
    return (
        <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 0.9, color: theme.textFaint, marginBottom: spacing.s10 }}>
            {children}
        </Text>
    );
};

export const ChatDesktopRail: React.FC<{
    partnerInfo: { name: string; isOnline: boolean; lastSeen: Timestamp | null; photoURL?: string } | null;
    messages: ExtendedMessage[];
    usedStorage: number;
    maxStorage: number;
    // Sprint 9.14: el carril es justamente donde las fotos quedan más
    // expuestas a una mirada de reojo, así que hereda el modo protección.
    photoBlur: number;
    onOpenImage: (uri: string) => void;
    onOpenFile: (file: { uri: string; name: string; size?: number }) => void;
}> = ({ partnerInfo, messages, usedStorage, maxStorage, photoBlur, onOpenImage, onOpenFile }) => {
    const { theme, fontFamilies } = useTheme();

    const sharedImages = messages.filter(m => !!m.image && !m.deleted).slice(0, 9);
    const sharedFiles = messages.filter(m => !!m.file && !m.deleted).slice(0, 6);
    const storagePct = maxStorage > 0 ? Math.min(1, usedStorage / maxStorage) : 0;
    const formatMB = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

    return (
        <View style={{
            width: 320,
            borderLeftWidth: 1,
            borderLeftColor: theme.borderSoft,
            backgroundColor: theme.bg,
        }}>
            <ScrollView contentContainerStyle={{ padding: spacing.s16, gap: spacing.s20 }}>
                {/* Perfil */}
                <View style={{ alignItems: 'center', gap: spacing.s8, paddingVertical: spacing.s10 }}>
                    {partnerInfo?.photoURL ? (
                        <Image source={{ uri: partnerInfo.photoURL }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                    ) : (
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: theme.white, fontFamily: fontFamilies.bodySemiBold, fontSize: 24 }}>
                                {partnerInfo?.name?.charAt(0).toUpperCase() || '❤️'}
                            </Text>
                        </View>
                    )}
                    <Text style={{ fontFamily: fontFamilies.bodyBold, fontSize: 15, color: theme.text }}>
                        {partnerInfo?.name || 'Pareja'}
                    </Text>
                    {partnerInfo?.isOnline && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s6 }}>
                            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: theme.success }} />
                            <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.success }}>En línea</Text>
                        </View>
                    )}
                </View>

                {/* Media compartida */}
                <View>
                    <SectionLabel>MEDIA COMPARTIDA</SectionLabel>
                    {sharedImages.length > 0 ? (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                            {sharedImages.map(m => (
                                <TouchableOpacity key={m._id.toString()} onPress={() => onOpenImage(m.image!)}>
                                    <Image
                                        source={{ uri: m.image }}
                                        style={{ width: 88, height: 88, borderRadius: 10 }}
                                        blurRadius={photoBlur}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint }}>
                            Sin fotos recientes
                        </Text>
                    )}
                </View>

                {/* Archivos */}
                <View>
                    <SectionLabel>ARCHIVOS</SectionLabel>
                    {sharedFiles.length > 0 ? (
                        <View style={{ gap: spacing.s8 }}>
                            {sharedFiles.map(m => (
                                <TouchableOpacity
                                    key={m._id.toString()}
                                    onPress={() => onOpenFile({ uri: m.file!, name: m.fileName || 'Archivo', size: m.fileSize })}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s10, backgroundColor: theme.surface, borderRadius: 12, padding: spacing.s10 }}
                                >
                                    <Ionicons name="document-text" size={18} color={theme.primary} />
                                    <Text style={{ fontFamily: fontFamilies.bodySemiBold, fontSize: 12.5, color: theme.text, flex: 1 }} numberOfLines={1}>
                                        {m.fileName || 'Archivo'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <Text style={{ fontFamily: fontFamilies.body, fontSize: 12.5, color: theme.textFaint }}>
                            Sin archivos recientes
                        </Text>
                    )}
                </View>

                {/* Almacenamiento */}
                <View>
                    <SectionLabel>ALMACENAMIENTO</SectionLabel>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.surfaceAlt, overflow: 'hidden', marginBottom: spacing.s8 }}>
                        <View style={{ height: '100%', width: `${storagePct * 100}%`, backgroundColor: storagePct >= 0.9 ? theme.danger : theme.primary }} />
                    </View>
                    <Text style={{ fontFamily: fontFamilies.body, fontSize: 12, color: theme.textMuted }}>
                        {formatMB(usedStorage)} de {formatMB(maxStorage)} usados
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};
