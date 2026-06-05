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

  const [{ initializeApp, getApps }, { getFirestore }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
  ]);

  firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  firestoreDb = getFirestore(firebaseApp);
  return firestoreDb;
}
