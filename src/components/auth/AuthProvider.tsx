"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { getUserByEmail, getUserById } from "@/services/firebase/db";

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
    const profile = email ? getUserByEmail(email) : null;
    if (!firebaseUid) {
      throw new Error("No se pudo validar el usuario.");
    }
    if (!profile) {
      throw new Error("Usuario no autorizado.");
    }
    if (!profile.active) {
      throw new Error("Acceso deshabilitado.");
    }
    setStoredSession({ uid: profile.uid, email: profile.email });
    setAuthUser({ uid: profile.uid, email: profile.email });
    setProfile(profile);
    return profile;
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
