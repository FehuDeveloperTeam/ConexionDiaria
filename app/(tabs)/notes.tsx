import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme,
    TextInput, Button, FlatList,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // 1. Importación necesaria
import { useRouter } from 'expo-router';
import { auth, db } from '../../src/config/firebaseConfig';
import { themes } from '../../src/config/theme';
import { collection, addDoc, onSnapshot, query, orderBy, doc, DocumentData, serverTimestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

const getStyles = (theme: typeof themes.light) => StyleSheet.create({
    container: {
        flex: 1,
        padding: 15,
        backgroundColor: theme.background,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    inputContainer: {
        padding: 10,
        backgroundColor: theme.inputBackground,
        borderRadius: 12,
        marginBottom: 20,
        borderColor: theme.borderColor,
        borderWidth: 1,
    },
    input: {
        color: theme.text,
        fontSize: 16,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    notesList: {
        flex: 1,
    },
    noteItem: {
        backgroundColor: '#FFFACD',
        borderRadius: 8,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    noteText: {
        fontSize: 16,
        color: '#333',
    },
    noteFooter: {
        marginTop: 10,
        alignItems: 'flex-end',
    },
    noteAuthor: {
        fontSize: 12,
        fontStyle: 'italic',
        color: '#888',
    },
    placeholderText: {
        fontSize: 16,
        color: theme.placeholder,
        textAlign: 'center',
        marginTop: 50,
    },
});

const Notes: React.FC = () => {
    const colorScheme = useColorScheme() || 'light';
    const theme = themes[colorScheme];
    const styles = getStyles(theme);
    const router = useRouter();

    const [notes, setNotes] = useState<DocumentData[]>([]);
    const [newNote, setNewNote] = useState('');
    const [userData, setUserData] = useState<DocumentData | null>(null);

    useEffect(() => {
        if (auth.currentUser) {
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                } else {
                    router.replace('/(tabs)/home');
                }
            });
            return () => unsubscribe();
        }
    }, [router]);

    useEffect(() => {
        if (!userData || !userData.partnerId || !auth.currentUser) return;
        const chatId = [auth.currentUser.uid, userData.partnerId].sort().join('_');
        const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
        const q = query(notesCollectionRef, orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setNotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribe();
    }, [userData]);

    const handleAddNote = useCallback(async () => {
        if (newNote.trim() === '' || !userData || !userData.partnerId || !auth.currentUser) return;
        const chatId = [auth.currentUser.uid, userData.partnerId].sort().join('_');
        const notesCollectionRef = collection(db, 'relationships', chatId, 'notes');
        try {
            await addDoc(notesCollectionRef, {
                text: newNote.trim(),
                authorId: auth.currentUser.uid,
                authorName: userData.displayName,
                createdAt: serverTimestamp(),
            });
            setNewNote('');
        } catch (error) {
            console.error("Error al añadir la nota:", error);
        }
    }, [newNote, userData]);
    
    return (
        // 2. ABRIMOS el SafeAreaView
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.container}>
                    <Text style={styles.title}>Muro de Notas</Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Escribe una nota para tu amor..."
                            placeholderTextColor={theme.placeholder}
                            value={newNote}
                            onChangeText={setNewNote}
                            multiline
                        />
                        <Button title="Dejar Nota" onPress={handleAddNote} color={theme.primary} />
                    </View>

                    <FlatList
                        style={styles.notesList}
                        data={notes}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.noteItem}>
                                <Text style={styles.noteText}>{item.text}</Text>
                                <View style={styles.noteFooter}>
                                    <Text style={styles.noteAuthor}>- {item.authorName}</Text>
                                </View>
                            </View>
                        )}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <Text style={styles.placeholderText}>Aún no hay notas. ¡Sé el primero en dejar un mensaje!</Text>
                        }
                    />
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView> // 3. Y CERRAMOS el SafeAreaView correctamente
    );
};

export default Notes;