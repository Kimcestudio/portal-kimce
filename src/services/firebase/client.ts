import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, memoryLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyD-PLACEHOLDERKEY1234567890abcd",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "placeholder.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "placeholder-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "placeholder.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:1234567890:web:placeholder",
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export { app };
export const auth    = getAuth(app);
export const storage = getStorage(app);

// En dev usamos memoryLocalCache para evitar conflictos de IndexedDB con HMR.
// En producción usamos persistentLocalCache para escribir offline y sincronizar al reconectar.
export const db = (() => {
  const cache = process.env.NODE_ENV === 'development' ? memoryLocalCache() : persistentLocalCache();
  try {
    return initializeFirestore(app, { localCache: cache });
  } catch {
    return getFirestore(app);
  }
})();
