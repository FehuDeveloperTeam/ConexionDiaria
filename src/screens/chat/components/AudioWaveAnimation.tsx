import React, { useState, useEffect } from 'react';
import { View, Animated } from 'react-native';

// Componente de Animación de Onda de Audio (para reproducción en mensaje)
export const AudioWaveAnimation: React.FC<{ color: string }> = ({ color }) => {
    const [heights] = useState([
        useState(new Animated.Value(4))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(14))[0],
        useState(new Animated.Value(10))[0],
        useState(new Animated.Value(6))[0],
        useState(new Animated.Value(12))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(4))[0],
    ]);

    useEffect(() => {
        const animations = heights.map((height, index) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(height, {
                        toValue: 18 + Math.random() * 6,
                        duration: 400 + index * 80,
                        useNativeDriver: false,
                    }),
                    Animated.timing(height, {
                        toValue: 4 + Math.random() * 4,
                        duration: 400 + index * 80,
                        useNativeDriver: false,
                    }),
                ])
            );
        });

        animations.forEach(anim => anim.start());

        return () => {
            animations.forEach(anim => anim.stop());
        };
    }, []);

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            {heights.map((height, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 3,
                        height: height,
                        backgroundColor: color,
                        borderRadius: 1.5,
                        marginHorizontal: 2,
                    }}
                />
            ))}
        </View>
    );
};
