import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Componente temporal para ejecutar la migración
 * Agrégalo a cualquier pantalla y ejecútalo UNA VEZ
 * Después puedes eliminarlo
 */
export const MigrationButton = () => {
  const [loading, setLoading] = useState(false);
  const [migrated, setMigrated] = useState(false);

  const runMigration = async () => {
    if (migrated) {
      Alert.alert('Ya ejecutado', 'La migración ya se ejecutó en esta sesión.');
      return;
    }

    Alert.alert(
      'Confirmar Migración',
      '¿Deseas agregar los campos isOnline y lastSeen a todos los usuarios?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ejecutar',
          onPress: async () => {
            setLoading(true);
            try {
              console.log('Iniciando migración...');
              
              const usersRef = collection(db, 'users');
              const snapshot = await getDocs(usersRef);
              
              if (snapshot.empty) {
                Alert.alert('Sin usuarios', 'No hay usuarios para migrar');
                setLoading(false);
                return;
              }
              
              const batchSize = 500;
              let batch = writeBatch(db);
              let operationCount = 0;
              let totalUsers = 0;
              
              for (const userDoc of snapshot.docs) {
                const userData = userDoc.data();
                
                // Solo actualizar si no tienen los campos
                if (userData.isOnline === undefined || userData.lastSeen === undefined) {
                  const userRef = doc(db, 'users', userDoc.id);
                  
                  batch.update(userRef, {
                    isOnline: false,
                    lastSeen: serverTimestamp()
                  });
                  
                  operationCount++;
                  totalUsers++;
                  
                  if (operationCount >= batchSize) {
                    await batch.commit();
                    console.log(`Procesados ${totalUsers} usuarios...`);
                    batch = writeBatch(db);
                    operationCount = 0;
                  }
                }
              }
              
              // Ejecutar el último batch
              if (operationCount > 0) {
                await batch.commit();
              }
              
              console.log(`✅ Migración completada: ${totalUsers} usuarios actualizados`);
              Alert.alert(
                'Migración Exitosa', 
                `Se actualizaron ${totalUsers} usuarios.\n\nAhora puedes eliminar este botón.`
              );
              setMigrated(true);
              
            } catch (error) {
              console.error('❌ Error en la migración:', error);
              Alert.alert('Error', 'Hubo un error en la migración. Revisa la consola.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        🔧 Migración de Base de Datos
      </Text>
      <Text style={styles.description}>
        Ejecuta esto UNA VEZ para agregar campos de estado online a los usuarios existentes.
      </Text>
      
      <TouchableOpacity
        onPress={runMigration}
        disabled={loading || migrated}
        style={[
          styles.button,
          { backgroundColor: migrated ? '#28A745' : (loading ? '#6C757D' : '#007BFF') }
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>
            {migrated ? '✓ Migración Completada' : 'Ejecutar Migración'}
          </Text>
        )}
      </TouchableOpacity>
      
      {migrated && (
        <Text style={styles.successText}>
          Ahora puedes eliminar este componente del código
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    margin: 16
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#856404'
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    color: '#856404'
  },
  button: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center'
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '600'
  },
  successText: {
    fontSize: 12,
    marginTop: 8,
    color: '#28A745',
    textAlign: 'center'
  }
});