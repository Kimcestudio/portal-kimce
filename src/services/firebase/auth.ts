import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import type { UserProfile } from "@/services/firebase/types";
import { getUserByEmail, getUserById, updateUser } from "@/services/firebase/db";
import { auth } from "@/services/firebase/client";
import { readStorage, writeStorage } from "@/services/firebase/storage";

const SESSION_KEY = "portal_auth_session";

type AuthSession = {
  uid: string;
  email: string;
};

export function getStoredSession() {
  return readStorage<AuthSession | null>(SESSION_KEY, null);
}

export function onAuthStateChanged(callback: (session: AuthSession | null) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback(getStoredSession());
  window.addEventListener("storage", handler);
  handler();
  return () => window.removeEventListener("storage", handler);
}

export function setStoredSession(session: AuthSession | null) {
  if (session) {
    writeStorage(SESSION_KEY, session);
  } else {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export function getCurrentUser() {
  const session = getStoredSession();
  if (!session) return null;
  return getUserById(session.uid);
}

export async function signInWithEmailPassword(email: string, password: string) {
  if (!email || !password) {
    throw new Error("Completa todos los campos.");
  }
  const user = getUserByEmail(email);
  if (!user) {
    throw new Error("Credenciales inválidas.");
  }
  if (!user.active) {
    throw new Error("Acceso deshabilitado.");
  }
  setStoredSession({ uid: user.uid, email: user.email });
  return user;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

export function signOut() {
  setStoredSession(null);
}

export function updateUserProfile(uid: string, payload: Partial<UserProfile>) {
  return updateUser(uid, payload);
}
