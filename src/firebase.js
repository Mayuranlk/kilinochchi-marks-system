import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const emulatorEnabled = process.env.REACT_APP_USE_FIREBASE_EMULATORS === "true";
const emulatorHost = process.env.REACT_APP_FIREBASE_EMULATOR_HOST || "127.0.0.1";
const firestoreEmulatorPort = Number(process.env.REACT_APP_FIRESTORE_EMULATOR_PORT || 8085);
const authEmulatorPort = Number(process.env.REACT_APP_AUTH_EMULATOR_PORT || 9099);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1"]);

if (emulatorEnabled) {
  if (!String(firebaseConfig.projectId || "").startsWith("demo-")) {
    throw new Error("Firebase emulator mode requires a demo- project ID.");
  }
  if (!loopbackHosts.has(emulatorHost)) {
    throw new Error("Firebase emulator mode requires a loopback host.");
  }
  if (!Number.isInteger(firestoreEmulatorPort) || !Number.isInteger(authEmulatorPort)) {
    throw new Error("Firebase emulator ports must be integers.");
  }
}

export const firebaseEmulatorConfig = Object.freeze({
  enabled: emulatorEnabled,
  host: emulatorHost,
  firestorePort: firestoreEmulatorPort,
  authPort: authEmulatorPort,
});

const app = initializeApp(firebaseConfig);
let firestoreDb;

try {
  firestoreDb = initializeFirestore(app, {
    // Emulator sessions use memory-only state so synthetic test records cannot
    // persist into later browser sessions. Production retains the existing
    // multi-tab persistent cache.
    localCache: emulatorEnabled
      ? memoryLocalCache()
      : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
if (emulatorEnabled) {
  connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort);
}

const connectedAuthInstances = new WeakSet();

export function connectAuthToConfiguredEmulator(authInstance) {
  if (emulatorEnabled && !connectedAuthInstances.has(authInstance)) {
    connectAuthEmulator(
      authInstance,
      `http://${emulatorHost}:${authEmulatorPort}`,
      { disableWarnings: true }
    );
    connectedAuthInstances.add(authInstance);
  }
  return authInstance;
}

export const auth = connectAuthToConfiguredEmulator(getAuth(app));
export default app;
