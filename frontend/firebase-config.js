export const firebaseConfig = {
  apiKey: "AIzaSyBk-VMGDd9pRMl9WJsCnFySpTlwkvmqUpA",
  authDomain: "blackline-93c09.firebaseapp.com",
  projectId: "blackline-93c09",
  storageBucket: "blackline-93c09.firebasestorage.app",
  messagingSenderId: "233160577064",
  appId: "1:233160577064:web:d476597596bc4b20cb251d",
  measurementId: "G-RCK9ZC6JVM"
};

let firebaseApp;
let firestoreDb;
let firebaseAuth;

function hasFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
    config.projectId &&
    config.appId &&
    config.apiKey !== 'COLOCAR_API_KEY_AQUI' &&
    config.appId !== 'COLOCAR_APP_ID_AQUI' &&
    config.messagingSenderId !== 'COLOCAR_MESSAGING_SENDER_ID_AQUI' &&
    config.projectId === 'blackline-93c09'
  );
}

export async function getBlacklineDb() {
  if (!hasFirebaseConfig(firebaseConfig)) {
    throw new Error('Firebase nao configurado para o projeto blackline-93c09. Preencha apiKey, messagingSenderId e appId em frontend/firebase-config.js.');
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
    throw new Error('Firebase nao configurado para o projeto blackline-93c09. Preencha apiKey, messagingSenderId e appId em frontend/firebase-config.js.');
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
