import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, TextInput, Alert, useColorScheme } from 'react-native';
import { auth } from '../../src/config/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { themes } from '../../src/config/theme';

// La función de estilos ahora usará los colores del tema correctamente
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background, // <-- ARREGLO: Usa el color de fondo del tema
  },
  title: {
    fontSize: 28,
    color: theme.text, // <-- ARREGLO: Usa el color de texto del tema
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
  },
  input: {
    height: 50,
    borderColor: theme.borderColor, // <-- ARREGLO: Usa el color de borde del tema
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: theme.text, // <-- ARREGLO: Para que el texto que escribes sea visible
    backgroundColor: theme.inputBackground,
  },
  footer: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  footerText: { // <-- AÑADIDO: Estilo para el texto del footer
    color: theme.text,
  },
  link: {
    color: theme.link, // <-- ARREGLO: Usa el color de link del tema
    fontWeight: 'bold',
  },
});

const Login: React.FC = () => { // No necesitamos las props por ahora, así que lo simplificamos
  
  const colorScheme = useColorScheme() || 'light';
  const theme = themes[colorScheme];
  const styles = getStyles(theme);
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Por favor, completa ambos campos.');
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // ¡No mostramos alerta de éxito, solo navegamos! Es mejor experiencia de usuario.
      router.replace('/home'); // <-- ARREGLO: Ruta en minúscula
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert('Error', 'Correo o contraseña incorrectos.');
      } else {
        Alert.alert('Error', 'No se pudo iniciar sesión. Inténtalo de nuevo más tarde.');
      }
    }
  };

  // <-- ¡ARREGLO PRINCIPAL! El return va aquí adentro de la función
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenid@ de Nuevo</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Correo Electrónico"
        placeholderTextColor={theme.placeholder} // <-- AÑADIDO: Placeholder dinámico
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor={theme.placeholder} // <-- AÑADIDO: Placeholder dinámico
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      
      <Button title="Iniciar Sesión" onPress={handleLogin} color={theme.primary} />
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>¿No tienes una cuenta?</Text>
        <Link href="/register" style={styles.link}>
          Regístrate aquí
        </Link>
      </View>
    </View>
  );
}; // <-- LA FUNCIÓN TERMINA AQUÍ

export default Login;