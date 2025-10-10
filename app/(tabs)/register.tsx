import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  Button, 
  Alert, 
  useColorScheme, 
  ScrollView,
  TouchableOpacity // Importamos para los íconos
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { Feather } from '@expo/vector-icons'; // Importamos los íconos

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
  container: {
    flexGrow: 1,
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
  // Contenedor para el campo de texto y el ícono
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderColor: theme.borderColor,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    backgroundColor: theme.inputBackground,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: theme.text,
  },
  icon: {
    padding: 10,
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
  const colorScheme = useColorScheme() || 'light';
  const theme = themes[colorScheme];
  const styles = getStyles(theme);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // NUEVO: Estados de visibilidad para cada campo de contraseña
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const handleRegister = async () => {
    // La lógica de registro no cambia
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
      router.replace('/home');
    } catch (error: any) {
      // ... manejo de errores
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crea tu Cuenta</Text>

      {/* Inputs de Nombre y Email */}
      <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Tu Nombre"
            placeholderTextColor={theme.placeholder}
            value={displayName}
            onChangeText={setDisplayName}
            returnKeyType="next"
          />
      </View>
      <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Correo Electrónico"
            placeholderTextColor={theme.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
      </View>
      
      {/* Input de Contraseña con el ojo */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Contraseña (mín. 6 caracteres)"
          placeholderTextColor={theme.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible}
          returnKeyType="next"
        />
        <TouchableOpacity style={styles.icon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
          <Feather name={isPasswordVisible ? "eye-off" : "eye"} size={22} color={theme.placeholder} />
        </TouchableOpacity>
      </View>

      {/* Input de Confirmar Contraseña con el ojo */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Confirmar Contraseña"
          placeholderTextColor={theme.placeholder}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!isConfirmPasswordVisible}
          returnKeyType="go"
          onSubmitEditing={handleRegister} // Podemos añadir el submit aquí también
        />
        <TouchableOpacity style={styles.icon} onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}>
          <Feather name={isConfirmPasswordVisible ? "eye-off" : "eye"} size={22} color={theme.placeholder} />
        </TouchableOpacity>
      </View>

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