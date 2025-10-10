import React, {useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, useColorScheme, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { doc, getDoc, DocumentData } from 'firebase/firestore'; // <-- ¡Nuevas importaciones!
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.background,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.text,
  },
  welcomeText: {
    fontSize: 22,
    color: theme.text, // Un color más sutil para el email
  },
});

const Home: React.FC = () => {
  const colorScheme = useColorScheme() || 'light';
  const theme = themes[colorScheme];
  const styles = getStyles(theme);
  const router = useRouter();
  
  // Guardaremos el objeto de autenticación y los datos de Firestore por separado
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true); // Estado para la pantalla de carga

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // ¡Aquí está la magia!
        // Usamos el ID del usuario (uid) para buscar su documento en Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          // Si el documento existe, guardamos sus datos en nuestro estado
          setUserData(userDocSnap.data());
        } else {
          console.log("No se encontró el documento del usuario en Firestore");
          // Podríamos manejar este caso, quizás redirigiendo o mostrando un error
        }
      } else {
        router.replace('/login');
      }
      setLoading(false); // Dejamos de cargar cuando terminamos
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // Pantalla de carga mejorada
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.title}>Cargando...</Text>
      </View>
    );
  }
  
  // Si no hay userData por alguna razón (aunque haya user)
  if (!userData) {
    return (
       <View style={styles.container}>
        <Text style={styles.title}>Ocurrió un error</Text>
        <Button title="Cerrar Sesión" onPress={handleLogout} color={theme.primary} />
      </View>
    )
  }

  // Ahora la bienvenida es mucho más personal
  return (
    <View style={styles.container}>
      <Text style={styles.title}>¡Hola de nuevo,</Text>
      <Text style={styles.welcomeText}>{userData.displayName}!</Text>
      <Button title="Cerrar Sesión" onPress={handleLogout} color={theme.primary} />
    </View>
  );
};

export default Home;