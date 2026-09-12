import React, { useState, useEffect } from 'react';
import { View, Animated } from 'react-native';

// Componente de Animación de Onda de Sonido (para grabación)
export const SoundWaveAnimation: React.FC = () => {
    const [heights] = useState([
        useState(new Animated.Value(4))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(12))[0],
        useState(new Animated.Value(8))[0],
        useState(new Animated.Value(4))[0],
    ]);

    useEffect(() => {
        const animations = heights.map((height, index) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.timing(height, {
                        toValue: 16,
                        duration: 300 + index * 100,
                        useNativeDriver: false,
                    }),
                    Animated.timing(height, {
                        toValue: 4,
                        duration: 300 + index * 100,
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {heights.map((height, index) => (
                <Animated.View
                    key={index}
                    style={{
                        width: 3,
                        height: height,
                        backgroundColor: '#FF69B4',
                        borderRadius: 2,
                        marginRight: index < heights.length - 1 ? 2 : 0,
                    }}
                />
            ))}
        </View>
    );
};
