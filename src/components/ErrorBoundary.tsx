// Red de seguridad de la interfaz — Sprint 11.1.
//
// Sin esto, un error dentro de un render deja PANTALLA BLANCA: sin mensaje,
// sin botón, sin forma de volver. La persona no tiene idea de qué pasó ni qué
// hacer, y nosotros tampoco nos enteramos. Es la peor falla posible porque no
// deja rastro en ninguno de los dos lados.
//
// Deliberadamente NO usa el tema de la app ni ningún contexto. Esta pantalla
// tiene que poder dibujarse cuando lo que se rompió es justamente el
// proveedor de tema o el de sesión; una pantalla de error que depende de lo
// que puede estar roto no sirve de nada. Por eso los colores van fijos, y se
// eligen leyendo la apariencia del sistema directamente.
import React from 'react';
import { Appearance, Platform, Text, TouchableOpacity, View } from 'react-native';
import { captureError } from '../services/errorReporter';

interface Props {
    children: React.ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        captureError(error, {
            origin: 'render',
            fatal: true,
            // El árbol de componentes es lo que dice DÓNDE se rompió, que es
            // la mitad del trabajo de arreglarlo.
            context: { componentStack: (info.componentStack ?? '').slice(0, 180) },
        });
    }

    private reset = () => {
        this.setState({ error: null });
    };

    private reload = () => {
        // En web se puede recargar de verdad, que es lo que resuelve un
        // estado corrupto. En nativo no existe equivalente sin dependencias,
        // así que ahí solo se reintenta el render.
        const location = (globalThis as unknown as { location?: { reload: () => void } }).location;
        if (Platform.OS === 'web' && location) location.reload();
        else this.reset();
    };

    render() {
        if (!this.state.error) return this.props.children;

        const isDark = Appearance.getColorScheme() === 'dark';
        const bg = isDark ? '#161427' : '#FBF8F6';
        const ink = isDark ? '#F4F1FA' : '#231F33';
        const inkSoft = isDark ? '#A9A4BC' : '#6B6580';
        const accent = '#6A5ACD';

        return (
            <View style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
                <Text style={{ fontSize: 40, marginBottom: 14 }}>🌧️</Text>
                <Text style={{ fontSize: 20, fontWeight: '700', color: ink, textAlign: 'center', marginBottom: 10 }}>
                    Algo se rompió de nuestro lado
                </Text>
                <Text style={{ fontSize: 14.5, lineHeight: 21, color: inkSoft, textAlign: 'center', marginBottom: 24 }}>
                    No perdiste nada: lo que habían guardado sigue ahí. Ya nos llegó el aviso
                    para arreglarlo.
                </Text>

                <TouchableOpacity
                    onPress={this.reload}
                    accessibilityRole="button"
                    accessibilityLabel="Volver a intentar"
                    style={{ backgroundColor: accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
                >
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
                        Volver a intentar
                    </Text>
                </TouchableOpacity>

                {__DEV__ && (
                    // Solo en desarrollo: en producción el mensaje técnico no
                    // le sirve a nadie y asusta.
                    <Text style={{ fontSize: 11, color: inkSoft, marginTop: 24, textAlign: 'center' }}>
                        {this.state.error.message}
                    </Text>
                )}
            </View>
        );
    }
}
