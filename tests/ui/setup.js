// Dobles de prueba para el entorno de interfaz — Sprint 11.6.
//
// Lo que se simula acá es todo lo que sale del teléfono: Firebase, las
// compras, las notificaciones y el enrutador. La regla es que los dobles se
// comporten como el original en lo que la prueba observa, y que fallen
// ruidosamente en lo que no — un doble demasiado complaciente hace pasar
// pruebas que no prueban nada.

/* eslint-disable */

// --- Firebase ---
// Las funciones devuelven objetos inertes. Cada prueba que necesite un
// comportamiento concreto lo sobreescribe con jest.mocked().
jest.mock('firebase/app', () => ({
    initializeApp: jest.fn(() => ({ name: 'test' })),
}));

jest.mock('firebase/auth', () => ({
    getAuth: jest.fn(() => ({ currentUser: null })),
    initializeAuth: jest.fn(() => ({ currentUser: null })),
    getReactNativePersistence: jest.fn(),
    setPersistence: jest.fn(() => Promise.resolve()),
    browserLocalPersistence: {},
    onAuthStateChanged: jest.fn(() => () => {}),
    getIdTokenResult: jest.fn(() => Promise.resolve({ claims: {} })),
    createUserWithEmailAndPassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    signOut: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
    getFirestore: jest.fn(() => ({})),
    initializeFirestore: jest.fn(() => ({})),
    persistentLocalCache: jest.fn(),
    persistentMultipleTabManager: jest.fn(),
    doc: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
    collection: jest.fn((...args) => ({ path: args.slice(1).join('/') })),
    // onSnapshot no emite nada por defecto: una prueba que dependa de datos
    // tiene que decir explícitamente qué llega.
    onSnapshot: jest.fn(() => () => {}),
    getDoc: jest.fn(() => Promise.resolve({ exists: () => false, data: () => undefined })),
    getDocs: jest.fn(() => Promise.resolve({ docs: [], size: 0, empty: true, forEach: () => {} })),
    setDoc: jest.fn(() => Promise.resolve()),
    addDoc: jest.fn(() => Promise.resolve({ id: 'nuevo' })),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteDoc: jest.fn(() => Promise.resolve()),
    writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), commit: jest.fn(() => Promise.resolve()) })),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    serverTimestamp: jest.fn(() => ({ __type: 'serverTimestamp' })),
    Timestamp: {
        now: jest.fn(() => ({ toDate: () => new Date('2026-09-18T12:00:00Z'), toMillis: () => 1789732800000 })),
        fromDate: jest.fn((d) => ({ toDate: () => d, toMillis: () => d.getTime() })),
    },
    FieldValue: { increment: jest.fn(), serverTimestamp: jest.fn() },
}));

jest.mock('firebase/storage', () => ({
    getStorage: jest.fn(() => ({})),
    ref: jest.fn(),
    uploadBytesResumable: jest.fn(),
    getDownloadURL: jest.fn(),
    deleteObject: jest.fn(),
}));

jest.mock('firebase/functions', () => ({
    getFunctions: jest.fn(() => ({})),
    httpsCallable: jest.fn(() => jest.fn(() => Promise.resolve({ data: {} }))),
}));

// --- Compras ---
jest.mock('react-native-purchases', () => ({
    __esModule: true,
    default: {
        setLogLevel: jest.fn(),
        configure: jest.fn(),
        logIn: jest.fn(),
        logOut: jest.fn(),
        getOfferings: jest.fn(() => Promise.resolve({ all: {}, current: null })),
        purchasePackage: jest.fn(),
        LOG_LEVEL: { DEBUG: 'DEBUG' },
    },
}));

// --- Expo ---
jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { version: '1.0.0-test' } },
}));

jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(() => Promise.resolve({ data: 'tok' })),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
    setNotificationHandler: jest.fn(),
    AndroidImportance: { MAX: 5 },
    setNotificationChannelAsync: jest.fn(),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(), replace: jest.fn(), back: jest.fn(),
    }),
    useSegments: () => [],
    useLocalSearchParams: () => ({}),
    Link: 'Link',
    Stack: 'Stack',
    Tabs: 'Tabs',
}));

jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: { show: jest.fn(), hide: jest.fn() },
}));

// AsyncStorage trae su propio doble oficial.
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Las variables de entorno que firebaseConfig exige para no lanzar.
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '1';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:1:web:1';
process.env.EXPO_PUBLIC_REVENUECAT_API_KEY = 'test';
