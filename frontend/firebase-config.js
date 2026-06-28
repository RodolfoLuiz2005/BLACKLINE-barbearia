import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

// Variaveis VITE_ ficam publicas no bundle final. A Firebase apiKey no front-end
// nao e um segredo absoluto; a seguranca real depende de restricoes da chave no
// Google Cloud Console e de regras corretas no Firebase Authentication/Firestore.
const requiredFirebaseEnv = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID
};

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
};

const missingFirebaseEnvVars = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (import.meta.env.DEV && missingFirebaseEnvVars.length) {
  console.error(
    'Firebase nao configurado. Defina as variaveis de ambiente ausentes: ' +
    missingFirebaseEnvVars.join(', ') +
    '. Nenhum valor sensivel foi exibido no console.'
  );
}

let firebaseApp;
let firestoreDb;
let firebaseAuth;

function hasFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
    config.authDomain &&
    config.projectId &&
    config.storageBucket &&
    config.messagingSenderId &&
    config.appId
  );
}

function firebaseConfigError() {
  return new Error('Firebase nao configurado. Defina as variaveis VITE_FIREBASE_* no ambiente de build.');
}

export function getBlacklineApp() {
  if (!hasFirebaseConfig(firebaseConfig)) {
    throw firebaseConfigError();
  }

  if (firebaseApp) return firebaseApp;

  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getBlacklineDb() {
  if (!hasFirebaseConfig(firebaseConfig)) {
    throw firebaseConfigError();
  }

  if (firestoreDb) return firestoreDb;

  const app = getBlacklineApp();
  try {
    firestoreDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    });
  } catch (err) {
    firestoreDb = getFirestore(app);
  }
  return firestoreDb;
}

export function getBlacklineAuth() {
  if (firebaseAuth) return firebaseAuth;

  firebaseAuth = getAuth(getBlacklineApp());
  return firebaseAuth;
}