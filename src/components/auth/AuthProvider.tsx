"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { UserProfile } from "@/services/firebase/types";
import {
  getCurrentUser,
  getStoredSession,
  onAuthStateChanged,
  signInWithEmailPassword,
  signInWithGoogle,
  setStoredSession,
  signOut,
  updateUserProfile,
} from "@/services/firebase/auth";
import { db } from "@/services/firebase/client";
import { getUserByEmail, getUserById, upsertUser } from "@/services/firebase/db";

type AuthUser = {
  uid: string;
  email: string;
};

interface AuthContextValue {
  authUser: AuthUser | null;
  profile: UserProfile | null;
  user: UserProfile | null;
  loading: boolean;
  viewMode: "collaborator" | "admin";
  setViewMode: (mode: "collaborator" | "admin") => void;
  signInWithEmail: (email: string, password: string) => Promise<UserProfile>;
  signInWithGoogle: () => Promise<UserProfile>;
  signOutUser: () => Promise<void>;
  updateUser: (payload: Partial<UserProfile>) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"collaborator" | "admin">(() => {
    if (typeof window === "undefined") return "collaborator";
    const stored = window.localStorage.getItem("view_mode");
    return stored === "admin" ? "admin" : "collaborator";
  });

  useEffect(() => {
    const session = getStoredSession();
    const currentProfile = getCurrentUser();
    setAuthUser(session ? { uid: session.uid, email: session.email } : null);
    setProfile(currentProfile);
    setLoading(false);
  }, []);

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
    const unsubscribe = onAuthStateChanged((session) => {
      setAuthUser(session ? { uid: session.uid, email: session.email } : null);
      setProfile(session ? getUserById(session.uid) : null);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    const response = await signInWithEmailPassword(email, password);
    setAuthUser({ uid: response.uid, email: response.email });
    setProfile(response);
    return response;
  };

  const signInWithGoogleUser = async () => {
    const credential = await signInWithGoogle();
    const firebaseUser = credential.user;
    const firebaseUid = firebaseUser.uid;
    const email = firebaseUser.email ?? "";
    if (!firebaseUid) {
      throw new Error("No se pudo validar el usuario.");
    }
    const userRef = doc(db, "users", firebaseUid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      const newProfile: UserProfile = {
        uid: firebaseUid,
        email,
        displayName: firebaseUser.displayName ?? "Usuario",
        photoURL: firebaseUser.photoURL ?? "",
        role: "collab",
        position: "Pendiente",
        active: false,
        approved: false,
        isActive: false,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, {
        uid: newProfile.uid,
        email: newProfile.email,
        displayName: newProfile.displayName,
        photoURL: newProfile.photoURL,
        approved: false,
        isActive: false,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      upsertUser(newProfile);
      throw new Error("Tu acceso está pendiente de aprobación.");
    }
    const data = snapshot.data() as Partial<UserProfile>;
    const approved =
      Boolean(data.approved) || Boolean(data.isActive) || data.status === "active" || data.active === true;
    if (!approved) {
      throw new Error("Tu acceso está pendiente de aprobación.");
    }
    const existingProfile = email ? getUserByEmail(email) : null;
    const mergedProfile: UserProfile = {
      uid: data.uid ?? firebaseUid,
      email: data.email ?? email,
      displayName: data.displayName ?? firebaseUser.displayName ?? "Usuario",
      photoURL: data.photoURL ?? firebaseUser.photoURL ?? "",
      role: data.role ?? existingProfile?.role ?? "collab",
      position: data.position ?? existingProfile?.position ?? "Sin asignar",
      active: data.active ?? existingProfile?.active ?? true,
      approved: data.approved ?? existingProfile?.approved,
      isActive: data.isActive ?? existingProfile?.isActive,
      status: (data.status as UserProfile["status"]) ?? existingProfile?.status,
      createdAt:
        typeof data.createdAt === "string"
          ? data.createdAt
          : existingProfile?.createdAt ?? new Date().toISOString(),
    };
    upsertUser(mergedProfile);
    setStoredSession({ uid: mergedProfile.uid, email: mergedProfile.email });
    setAuthUser({ uid: mergedProfile.uid, email: mergedProfile.email });
    setProfile(mergedProfile);
    return mergedProfile;
  };

  const signOutUser = async () => {
    signOut();
    setAuthUser(null);
    setProfile(null);
    setViewMode("collaborator");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sidebar_view");
      window.localStorage.removeItem("view_mode");
    }
    router.replace("/login");
  };

  const updateUser = (payload: Partial<UserProfile>) => {
    if (!profile) return;
    const updated = updateUserProfile(profile.uid, payload);
    if (updated) setProfile(updated);
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
      signInWithGoogle: signInWithGoogleUser,
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
