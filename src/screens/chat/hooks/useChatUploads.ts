import { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc, Timestamp, DocumentData } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { db, storage } from '../../../config/firebaseConfig';

// Función helper para convertir URI a Blob
const uriToBlob = (uri: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function (e) {
            console.error("uriToBlob falló:", e);
            reject(new TypeError("Network request failed"));
        };
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
    });
};

// Subida de imágenes, audios y archivos al chat, con control de
// almacenamiento (checkStorage) y el menú de adjuntos que los dispara.
export function useChatUploads({
    currentUser,
    userData,
    usedStorage,
    plan,
    maxStorage,
    onNeedUpgrade,
}: {
    currentUser: FirebaseUser | null;
    userData: DocumentData | null;
    usedStorage: number;
    plan: 'free' | 'premium';
    maxStorage: number;
    onNeedUpgrade: () => void;
}) {
    const { showActionSheetWithOptions } = useActionSheet();
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    // Función para verificar espacio de almacenamiento
    const checkStorage = async (fileSize: number): Promise<boolean> => {
        if (plan === 'premium') return true;

        if (usedStorage + fileSize > maxStorage) {
            onNeedUpgrade();
            return false;
        }

        return true;
    };

    // Función para subir imagen
    const uploadImage = async (uri: string) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Comprimir imagen
            const compressedImage = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1024 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            // Verificar tamaño y almacenamiento
            const response = await fetch(compressedImage.uri);
            const blob = await response.blob();
            const fileSize = blob.size;

            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const filename = `${Crypto.randomUUID()}.jpg`;
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/images/${filename}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo imagen:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir la imagen',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        image: downloadURL,
                        text: '',
                        createdAt: Timestamp.now(),
                        authorId: currentUser.uid,
                        user: {
                            _id: currentUser.uid,
                            name: userData.name || 'Usuario',
                        },
                        delivered: false,
                        read: false,
                        sentAt: Timestamp.now(),
                    });

                    // Actualizar almacenamiento usado
                    const relationshipRef = doc(db, 'relationships', relationshipId);
                    await updateDoc(relationshipRef, {
                        usedStorage: (usedStorage || 0) + fileSize
                    });

                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({
                        type: 'success',
                        text1: 'Imagen enviada',
                    });
                }
            );

        } catch (error) {
            console.error('Error en uploadImage:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo procesar la imagen',
            });
        }
    };

    // Función para subir audio
    const uploadAudio = async (uri: string) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            const blob = await uriToBlob(uri);
            const fileSize = blob.size;

            // Verificar almacenamiento
            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const filename = `${Crypto.randomUUID()}.m4a`;
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/audios/${filename}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo audio:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir el audio',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        audio: downloadURL,
                        text: '',
                        createdAt: Timestamp.now(),
                        authorId: currentUser.uid,
                        user: {
                            _id: currentUser.uid,
                            name: userData.name || 'Usuario',
                        },
                        delivered: false,
                        read: false,
                        audioPlayed: false,
                        sentAt: Timestamp.now(),
                    });

                    // Actualizar almacenamiento usado
                    const relationshipRef = doc(db, 'relationships', relationshipId);
                    await updateDoc(relationshipRef, {
                        usedStorage: (usedStorage || 0) + fileSize
                    });

                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({
                        type: 'success',
                        text1: 'Audio enviado',
                    });
                }
            );

        } catch (error) {
            console.error('Error en uploadAudio:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el audio',
            });
        }
    };

    // Función para subir archivo
    const uploadFile = async (fileUri: string, fileName: string, fileSize: number) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            // Verificar almacenamiento
            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const blob = await uriToBlob(fileUri);
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/files/${fileName}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo archivo:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir el archivo',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        file: downloadURL,
                        fileName: fileName,
                        fileSize: fileSize,
                        text: '',
                        createdAt: Timestamp.now(),
                        authorId: currentUser.uid,
                        user: {
                            _id: currentUser.uid,
                            name: userData.name || 'Usuario',
                        },
                        delivered: false,
                        read: false,
                        sentAt: Timestamp.now(),
                    });

                    // Actualizar almacenamiento usado
                    const relationshipRef = doc(db, 'relationships', relationshipId);
                    await updateDoc(relationshipRef, {
                        usedStorage: (usedStorage || 0) + fileSize
                    });

                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({
                        type: 'success',
                        text1: 'Archivo enviado',
                    });
                }
            );

        } catch (error) {
            console.error('Error en uploadFile:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo enviar el archivo',
            });
        }
    };

    // Función para mostrar menú de adjuntos
    const showAttachmentMenu = () => {
        const options = ['Cámara', 'Galería', 'Documento', 'Cancelar'];
        const cancelButtonIndex = 3;

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                title: 'Adjuntar archivo',
            },
            async (buttonIndex) => {
                if (buttonIndex === 0) {
                    // Cámara
                    const permission = await ImagePicker.requestCameraPermissionsAsync();
                    if (permission.granted) {
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                            await uploadImage(result.assets[0].uri);
                        }
                    }
                } else if (buttonIndex === 1) {
                    // Galería
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (permission.granted) {
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            quality: 0.8,
                        });

                        if (!result.canceled && result.assets[0]) {
                            await uploadImage(result.assets[0].uri);
                        }
                    }
                } else if (buttonIndex === 2) {
                    // Documento
                    const result = await DocumentPicker.getDocumentAsync({
                        type: '*/*',
                        copyToCacheDirectory: true,
                    });

                    if (!result.canceled && result.assets[0]) {
                        const file = result.assets[0];
                        await uploadFile(file.uri, file.name, file.size || 0);
                    }
                }
            }
        );
    };

    return {
        isUploading,
        uploadProgress,
        checkStorage,
        uploadImage,
        uploadAudio,
        uploadFile,
        showAttachmentMenu,
    };
}
