"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { UserProfile } from "@/services/firebase/types";
import { auth, db } from "@/lib/firebase";

interface AuthContextValue {
  authUser: User | null;
  profile: UserProfile | null;
  user: UserProfile | null;
  loading: boolean;
  viewMode: "collaborator" | "admin";
  setViewMode: (mode: "collaborator" | "admin") => void;
  signInWithEmail: (email: string, password: string) => Promise<UserProfile>;
  signInWithGoogle: () => Promise<UserProfile>;
  signOutUser: () => Promise<void>;
  updateUser: (payload: Partial<UserProfile>) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const buildDefaultProfile = (user: User): UserProfile => ({
  uid: user.uid,
  email: user.email ?? "",
  displayName: user.displayName ?? "",
  photoURL: user.photoURL ?? "",
  role: "collab",
  position: "",
  active: true,
});

const mergeProfile = (user: User, data?: Partial<UserProfile> | null): UserProfile => ({
  ...buildDefaultProfile(user),
  ...data,
  email: data?.email ?? user.email ?? "",
  displayName: data?.displayName ?? user.displayName ?? "",
  photoURL: data?.photoURL ?? user.photoURL ?? "",
  role: data?.role ?? "collab",
  active: data?.active ?? true,
  position: data?.position ?? "",
});

const upsertProfile = async (user: User) => {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);
  const data = snapshot.exists() ? (snapshot.data() as Partial<UserProfile>) : null;
  const profile = mergeProfile(user, data);
  await setDoc(
    userRef,
    {
      ...profile,
      createdAt: snapshot.exists() ? data?.createdAt ?? serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  const refreshed = await getDoc(userRef);
  return mergeProfile(user, refreshed.exists() ? (refreshed.data() as Partial<UserProfile>) : profile);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"collaborator" | "admin">(() => {
    if (typeof window === "undefined") return "collaborator";
    const stored = window.localStorage.getItem("view_mode");
    return stored === "admin" ? "admin" : "collaborator";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (profile?.role !== "admin" && viewMode !== "collaborator") {
      setViewMode("collaborator");
    }
  }, [profile?.role, viewMode]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (!user) {
        setAuthUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      setAuthUser(user);
      try {
        const nextProfile = await upsertProfile(user);
        setProfile(nextProfile);
      } catch {
        setProfile(mergeProfile(user, null));
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const nextProfile = await upsertProfile(result.user);
    setAuthUser(result.user);
    setProfile(nextProfile);
    return nextProfile;
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const nextProfile = await upsertProfile(result.user);
    setAuthUser(result.user);
    setProfile(nextProfile);
    return nextProfile;
  };

  const signOutUser = async () => {
    await signOut(auth);
    setAuthUser(null);
    setProfile(null);
    setViewMode("collaborator");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sidebar_view");
      window.localStorage.removeItem("view_mode");
    }
    router.replace("/login");
  };

  const updateUser = async (payload: Partial<UserProfile>) => {
    if (!authUser) return;
    const userRef = doc(db, "users", authUser.uid);
    await setDoc(
      userRef,
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const snapshot = await getDoc(userRef);
    setProfile(
      mergeProfile(authUser, snapshot.exists() ? (snapshot.data() as Partial<UserProfile>) : null)
    );
  };

  const value = useMemo(
    () => ({
      authUser,
      profile,
      user: profile,
      loading,
      viewMode,
      setViewMode,
      signInWithEmail,
      signInWithGoogle,
      signOutUser,
      updateUser,
    }),
    [authUser, profile, loading, viewMode]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    console.info("[auth] navigation", {
      path: pathname,
      uid: authUser?.uid ?? null,
      displayName: profile?.displayName ?? null,
      role: profile?.role ?? null,
      viewMode,
    });
  }, [pathname, authUser, profile, viewMode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
