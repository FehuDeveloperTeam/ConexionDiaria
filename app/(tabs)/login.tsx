import { Link, useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Button, 
  TextInput, 
  Alert, 
  useColorScheme,
  TouchableOpacity // Importamos para hacer el ícono clickeable
} from 'react-native';
import { auth } from '../../src/config/firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { themes } from '../../src/config/theme';
import { Feather } from '@expo/vector-icons'; // Importamos la librería de íconos

// La función de estilos con los contenedores necesarios para el ícono
const getStyles = (theme: typeof themes.light) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: theme.background,
  },
  title: {
    fontSize: 28,
    color: theme.text,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
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
  // Estilo base para los inputs
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: theme.text,
  },
  // Estilo para el ícono del ojo
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


const Login: React.FC = () => {
  const colorScheme = useColorScheme() || 'light';
  const theme = themes[colorScheme];
  const styles = getStyles(theme);
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // NUEVO: Estado para controlar la visibilidad de la contraseña
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const passwordInputRef = useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Error', 'Por favor, completa ambos campos.');
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/home');
    } catch (error: any) {
      Alert.alert('Error', 'Correo o contraseña incorrectos.');
      console.error(error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bienvenid@ de Nuevo</Text>
      
      {/* Input de Email (no necesita el ojo) */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Correo Electrónico"
          placeholderTextColor={theme.placeholder}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next" // El teclado muestra "Siguiente"
          onSubmitEditing={() => passwordInputRef.current?.focus()} // MEJORA: Mueve el foco al input de contraseña
        />
      </View>
      
      {/* Input de Contraseña con el ojo */}
      <View style={styles.inputContainer}>
        <TextInput
          ref={passwordInputRef}
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor={theme.placeholder}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!isPasswordVisible} // Se controla con el estado
          returnKeyType="go" // El teclado muestra "Ir" o "Entrar"
          onSubmitEditing={handleLogin} // MEJORA: Llama a handleLogin al presionar "Enter"
        />
        <TouchableOpacity style={styles.icon} onPress={() => setIsPasswordVisible(!isPasswordVisible)}>
          <Feather 
            name={isPasswordVisible ? "eye-off" : "eye"} // Cambia el ícono
            size={22} 
            color={theme.placeholder} 
          />
        </TouchableOpacity>
      </View>
      
      <Button title="Iniciar Sesión" onPress={handleLogin} color={theme.primary} />
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>¿No tienes una cuenta?</Text>
        <Link href="/register" style={styles.link}>
          Regístrate aquí
        </Link>
      </View>
    </View>
  );
};

export default Login;