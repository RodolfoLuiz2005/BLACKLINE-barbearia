import { readFileSync } from 'node:fs';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function readArg(name) {
  const prefix = `--${name}=`;
  const item = process.argv.find(arg => arg.startsWith(prefix));
  return item ? item.slice(prefix.length) : undefined;
}

function getRequiredUid() {
  const uid = readArg('uid') || process.env.ADMIN_UID;
  if (!uid) {
    throw new Error('Missing admin UID. Use --uid=<firebase-auth-uid> or ADMIN_UID=<firebase-auth-uid>.');
  }
  return uid;
}

function loadCredential() {
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (inlineJson) {
    return cert(JSON.parse(inlineJson));
  }

  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (jsonPath) {
    return cert(JSON.parse(readFileSync(jsonPath, 'utf8')));
  }

  return applicationDefault();
}

const uid = getRequiredUid();
const projectId = readArg('project') || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;

initializeApp({
  credential: loadCredential(),
  ...(projectId ? { projectId } : {})
});

const auth = getAuth();
const user = await auth.getUser(uid);
const claims = { ...(user.customClaims || {}), admin: true };

await auth.setCustomUserClaims(uid, claims);

console.log(`Set admin=true custom claim for UID ${uid}.`);
console.log('Ask the user to sign out and sign in again so the refreshed ID token includes the new claim.');