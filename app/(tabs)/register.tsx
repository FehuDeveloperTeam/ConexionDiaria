import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, Alert, useColorScheme, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme'; // 1. Importamos nuestros temas

// 2. Convertimos los estilos en una función que recibe el tema
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
  container: {
    flexGrow: 1, // Usamos flexGrow para que el ScrollView funcione bien
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: theme.text,
  },
  input: {
    height: 50,
    borderColor: theme.borderColor,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    color: theme.text,
    backgroundColor: theme.inputBackground,
  },
  footer: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  footerText: {
    color: theme.text,
  },
  link: {
    color: theme.link,
    fontWeight: 'bold',
  },
});

const Register: React.FC = () => {
  // 3. Detectamos el tema y aplicamos los estilos
  const colorScheme = useColorScheme() || 'light';
  const theme = themes[colorScheme];
  const styles = getStyles(theme);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      return Alert.alert('Error', 'Las contraseñas no coinciden.');
    }
    if (!email || !password || !displayName) {
      return Alert.alert('Error', 'Por favor, completa todos los campos.');
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        displayName: displayName,
        createdAt: new Date(),
        partnerId: null,
        relationshipStartDate: null,
      });

      // Navegamos directamente sin alerta para una mejor experiencia
      router.replace('/home');

    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert('Error', 'Este correo electrónico ya está en uso.');
      } else if (error.code === 'auth/weak-password') {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
      } else {
        Alert.alert('Error', 'Ocurrió un problema al crear la cuenta.');
      }
    }
  };

  return (
    // Usamos ScrollView para evitar que el teclado tape los campos en pantallas pequeñas
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crea tu Cuenta</Text>

      <TextInput
        style={styles.input}
        placeholder="Tu Nombre"
        placeholderTextColor={theme.placeholder}
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="Correo Electrónico"
        placeholderTextColor={theme.placeholder}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña (mín. 6 caracteres)"
        placeholderTextColor={theme.placeholder}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirmar Contraseña"
        placeholderTextColor={theme.placeholder}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <Button title="Registrarme" onPress={handleRegister} color={theme.primary} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes una cuenta?</Text>
        <Link href="/login" style={styles.link}>
          Inicia sesión aquí
        </Link>
      </View>
    </ScrollView>
  );
};

export default Register;