import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

const WelcomeScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>¡Bienvenid@ a Conexión Diaria! ❤️</Text>
      
      <Link href="/login" asChild>
        <Button title="Ir a Iniciar Sesión" />
      </Link>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  text: {
    fontSize: 22,
    fontWeight: 'bold',
  },
});

export default WelcomeScreen;