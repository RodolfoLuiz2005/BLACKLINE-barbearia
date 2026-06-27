const firebaseEnv = import.meta.env || {};

// As variáveis VITE_ são públicas no bundle final. A apiKey do Firebase no front-end
// não é um segredo absoluto; a segurança real depende de restrições da chave no
// Google Cloud Console e de regras corretas no Firebase Authentication/Firestore.
export const firebaseConfig = {
  apiKey: firebaseEnv.VITE_FIREBASE_API_KEY || '',
  authDomain: firebaseEnv.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: firebaseEnv.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: firebaseEnv.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: firebaseEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: firebaseEnv.VITE_FIREBASE_APP_ID || ''
};

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
  return new Error('Firebase não configurado. Defina VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID e VITE_FIREBASE_APP_ID no ambiente de build.');
}

export async function getBlacklineDb() {
  if (!hasFirebaseConfig(firebaseConfig)) {
    throw firebaseConfigError();
  }

  if (firestoreDb) return firestoreDb;

  firebaseApp = await getBlacklineApp();
  const { getFirestore, initializeFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  try {
    firestoreDb = initializeFirestore(firebaseApp, {
      experimentalAutoDetectLongPolling: true
    });
  } catch (err) {
    firestoreDb = getFirestore(firebaseApp);
  }
  return firestoreDb;
}

export async function getBlacklineApp() {
  if (!hasFirebaseConfig(firebaseConfig)) {
    throw firebaseConfigError();
  }

  if (firebaseApp) return firebaseApp;

  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return firebaseApp;
}

export async function getBlacklineAuth() {
  if (firebaseAuth) return firebaseAuth;

  const app = await getBlacklineApp();
  const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}