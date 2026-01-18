"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/services/firebase/types";
import { getCurrentUser, signInWithEmailPassword, signOut, updateUserProfile } from "@/services/firebase/auth";
import { seedFirebaseData } from "@/services/firebase/seed";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  signInUser: (email: string, password: string) => Promise<UserProfile>;
  signOutUser: () => void;
  updateUser: (payload: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedFirebaseData();
    setUser(getCurrentUser());
    setLoading(false);
  }, []);

  const signInUser = async (email: string, password: string) => {
    const response = await signInWithEmailPassword(email, password);
    setUser(response);
    return response;
  };

  const signOutUser = () => {
    signOut();
    setUser(null);
  };

  const updateUser = (payload: Partial<UserProfile>) => {
    if (!user) return;
    const updated = updateUserProfile(user.uid, payload);
    if (updated) setUser(updated);
  };

  const value = useMemo(
    () => ({ user, loading, signInUser, signOutUser, updateUser }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
