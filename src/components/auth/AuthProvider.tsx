"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { UserProfile } from "@/services/firebase/types";
import {
  getCurrentUser,
  getStoredSession,
  onAuthStateChanged,
  signInWithEmailPassword,
  signOut,
  updateUserProfile,
} from "@/services/firebase/auth";
import { getUserById } from "@/services/firebase/db";
import { seedFirebaseData } from "@/services/firebase/seed";

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
  signInUser: (email: string, password: string) => Promise<UserProfile>;
  signOutUser: () => void;
  updateUser: (payload: Partial<UserProfile>) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"collaborator" | "admin">(() => {
    if (typeof window === "undefined") return "collaborator";
    const stored = window.localStorage.getItem("view_mode");
    return stored === "admin" ? "admin" : "collaborator";
  });

  useEffect(() => {
    seedFirebaseData();
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

  const signInUser = async (email: string, password: string) => {
    const response = await signInWithEmailPassword(email, password);
    setAuthUser({ uid: response.uid, email: response.email });
    setProfile(response);
    return response;
  };

  const signOutUser = () => {
    signOut();
    setAuthUser(null);
    setProfile(null);
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
      signInUser,
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
