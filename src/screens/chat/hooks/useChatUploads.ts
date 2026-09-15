import { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { addDoc, collection, Timestamp, DocumentData } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import Toast from 'react-native-toast-message';
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

// El tope por archivo que impone la regla de Storage. Vive acá además de en
// storage.rules para poder avisar ANTES de subir: el servidor rechaza la
// subida al final y sin explicar por qué.
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// Tope que se le pide al selector del sistema. Con 50 MB por archivo, pasado
// ese largo el video no va a caber casi nunca.
const MAX_VIDEO_SECONDS = 120;

// Subida de imágenes, audios, videos y archivos al chat, con control de
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

                    // 'usedStorage' ya no se toca desde acá: lo cuenta la Cloud
                    // Function de contabilidad de Storage a partir del propio
                    // evento de subida (F-04, F-05, ver
                    // functions/src/storageAccounting.ts) — las reglas ya no
                    // dejan escribirlo desde el cliente.
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

    // Función para subir audio. 'durationMillis' viene de la grabación misma
    // (useAudioRecording ya la tiene al terminar de grabar) para no tener que
    // descargar el audio después solo para medirlo.
    const uploadAudio = async (uri: string, durationMillis?: number) => {
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
                        ...(durationMillis != null ? { audioDuration: durationMillis } : {}),
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

                    // 'usedStorage' ya no se toca desde acá: lo cuenta la Cloud
                    // Function de contabilidad de Storage a partir del propio
                    // evento de subida (F-04, F-05, ver
                    // functions/src/storageAccounting.ts) — las reglas ya no
                    // dejan escribirlo desde el cliente.
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

    // Sprint 9.23: video. Es el adjunto que de verdad llena los 100 MB del
    // plan gratuito, así que pasa por el mismo checkStorage que el resto y no
    // por una excepción: un minuto de video pesa lo que cien fotos.
    //
    // No se comprime acá. ImageManipulator no toca video y meter una
    // transcodificación en el cliente es otra sesión completa; lo que sí se
    // hace es pedirle al selector una calidad más baja y avisar cuando el
    // archivo no cabe, en vez de subir 200 MB y fallar al final.
    const uploadVideo = async (uri: string, durationMillis?: number) => {
        if (!currentUser || !userData?.partnerId) return;

        try {
            setIsUploading(true);
            setUploadProgress(0);

            const blob = await uriToBlob(uri);
            const fileSize = blob.size;

            // El tope de la regla de Storage (50 MB por archivo). Se
            // comprueba acá también para no gastar la subida entera antes de
            // que el servidor la rechace sin decir por qué.
            if (fileSize > MAX_VIDEO_BYTES) {
                setIsUploading(false);
                Toast.show({
                    type: 'error',
                    text1: 'El video es muy pesado',
                    text2: 'El máximo por video son 50 MB. Prueba con uno más corto.',
                });
                return;
            }

            const hasSpace = await checkStorage(fileSize);
            if (!hasSpace) {
                setIsUploading(false);
                return;
            }

            const filename = `${Crypto.randomUUID()}.mp4`;
            const relationshipId = [currentUser.uid, userData.partnerId].sort().join('_');
            const storageRef = ref(storage, `relationships/${relationshipId}/videos/${filename}`);

            const uploadTask = uploadBytesResumable(storageRef, blob);

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Error subiendo video:', error);
                    setIsUploading(false);
                    Toast.show({
                        type: 'error',
                        text1: 'Error',
                        text2: 'No se pudo subir el video',
                    });
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    await addDoc(collection(db, 'relationships', relationshipId, 'messages'), {
                        video: downloadURL,
                        ...(durationMillis != null ? { videoDuration: durationMillis } : {}),
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

                    // 'usedStorage' lo cuenta la Cloud Function a partir del
                    // evento de subida (F-04, F-05), igual que con el resto.
                    setIsUploading(false);
                    setUploadProgress(0);

                    Toast.show({ type: 'success', text1: 'Video enviado' });
                }
            );
        } catch (error) {
            console.error('Error en uploadVideo:', error);
            setIsUploading(false);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo procesar el video',
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

                    // 'usedStorage' ya no se toca desde acá: lo cuenta la Cloud
                    // Function de contabilidad de Storage a partir del propio
                    // evento de subida (F-04, F-05, ver
                    // functions/src/storageAccounting.ts) — las reglas ya no
                    // dejan escribirlo desde el cliente.
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

    // Sprint 7.4b: la hoja de adjuntar pasó a ser un bottom sheet propio de
    // 3 tiles (ver chat.tsx), en vez del action sheet nativo del sistema —
    // este hook ya no decide CÓMO se elige la opción, solo QUÉ pasa al
    // elegir cada una.
    const pickFromCamera = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const pickFromGallery = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
        }
    };

    const pickVideo = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            // Sin recorte: 'allowsEditing' en video abre el recortador del
            // sistema, que en Android devuelve a veces el original sin avisar.
            // Mejor pedir calidad media, que es la palanca que de verdad baja
            // el peso, y dejar el video como está.
            quality: 0.7,
            videoMaxDuration: MAX_VIDEO_SECONDS,
        });
        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            await uploadVideo(asset.uri, asset.duration ?? undefined);
        }
    };

    const pickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets[0]) {
            const file = result.assets[0];
            await uploadFile(file.uri, file.name, file.size || 0);
        }
    };

    return {
        isUploading,
        uploadProgress,
        checkStorage,
        uploadImage,
        uploadAudio,
        uploadVideo,
        uploadFile,
        pickFromCamera,
        pickFromGallery,
        pickVideo,
        pickDocument,
    };
}
