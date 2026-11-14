"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc } from "firebase/firestore";
import { atomicUserWrite } from "@/lib/user/syncProfile";
import type { UserProfile } from "@/services/firebase/types";
import {
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
import { DEFAULT_WORK_SCHEDULE_ID } from "@/services/firebase/workSchedules";

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

function buildDirectoryProfile(profile: Partial<UserProfile> & { uid: string; email: string }) {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName ?? "Usuario",
    photoURL: profile.photoURL ?? "",
    role: profile.role ?? "collab",
    position: profile.position ?? "",
    area: profile.area ?? null,
    workScheduleId: profile.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
    active: profile.active ?? profile.isActive ?? true,
    approved: profile.approved ?? false,
    isActive: profile.isActive ?? true,
    birthDate: profile.birthDate ?? "",
    employmentStartDate: profile.employmentStartDate ?? "",
    updatedAt: serverTimestamp(),
  };
}

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
  const adminAllowlist = ["kimcestudio@gmail.com"]; // Actualiza esta lista para el bootstrap admin.

  const updatePresence = async (uid: string, status: "online" | "offline") => {
    try {
      await setDoc(
        doc(db, "userDirectory", uid),
        {
          onlineStatus: status,
          lastSeenAt: new Date().toISOString(),
          presenceUpdatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[presence] update failed", error);
      }
    }
  };

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
    let isMounted = true;

    const syncSession = async (session: ReturnType<typeof getStoredSession>) => {
      if (!isMounted) return;

      if (!session) {
        setAuthUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setAuthUser({ uid: session.uid, email: session.email });

      const localProfile = getUserById(session.uid);
      let nextProfile = localProfile;

      try {
        const userRef = doc(db, "users", session.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<UserProfile>;

          // Clientes no necesitan workScheduleId — solo team members
          const isClient = data.role === "client";
          if (!data.role || (!isClient && !data.workScheduleId)) {
            await setDoc(
              userRef,
              {
                role: data.role ?? "collab",
                ...(isClient ? {} : { workScheduleId: data.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID }),
                updatedAt: serverTimestamp(),
              },
              { merge: true },
            );

            data.role = data.role ?? "collab";
            if (!isClient) data.workScheduleId = data.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID;
          }

          nextProfile = {
            uid: data.uid ?? session.uid,
            email: data.email ?? session.email,
            displayName: data.displayName ?? localProfile?.displayName ?? "Usuario",
            photoURL: data.photoURL ?? localProfile?.photoURL ?? "",
            role: data.role ?? localProfile?.role ?? "collab",
            brandIds: data.brandIds ?? localProfile?.brandIds,
            position: data.position ?? localProfile?.position ?? "Sin asignar",
            area: data.area ?? localProfile?.area ?? null,
            workScheduleId:
              data.workScheduleId ?? localProfile?.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
            active: data.isActive ?? data.active ?? localProfile?.active ?? true,
            approved: data.approved ?? localProfile?.approved,
            isActive: data.isActive ?? localProfile?.isActive,
            createdAt:
              typeof data.createdAt === "string"
                ? data.createdAt
                : localProfile?.createdAt ?? new Date().toISOString(),
            birthDate: data.birthDate ?? localProfile?.birthDate,
            employmentStartDate: data.employmentStartDate ?? localProfile?.employmentStartDate,
            phone: data.phone ?? localProfile?.phone,
            maritalStatus: data.maritalStatus ?? localProfile?.maritalStatus,
            gender: data.gender ?? localProfile?.gender,
            bankName: data.bankName ?? localProfile?.bankName,
            accountType: data.accountType ?? localProfile?.accountType,
            accountNumber: data.accountNumber ?? localProfile?.accountNumber,
            cci: data.cci ?? localProfile?.cci,
            isAreaLead: data.isAreaLead ?? localProfile?.isAreaLead ?? false,
          };

          upsertUser(nextProfile);
          await setDoc(doc(db, "userDirectory", nextProfile.uid), buildDirectoryProfile(nextProfile), {
            merge: true,
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.log("[auth] Firestore sync failed", error);
        }
      } finally {
        if (!isMounted) return;
        setProfile(nextProfile);
        setLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged((session) => {
      void syncSession(session);
    });

    return () => {
      isMounted = false;
      unsubscribe();
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
    const snapshot = await getDocFromServer(userRef);
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth] Google uid", firebaseUid);
    }
    if (!snapshot.exists()) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[auth] Firestore user missing");
      }
      const isAdmin = adminAllowlist.includes(email.toLowerCase());
      const newProfile: UserProfile = {
        uid: firebaseUid,
        email,
        displayName: firebaseUser.displayName ?? "Usuario",
        photoURL: firebaseUser.photoURL ?? "",
        role: isAdmin ? "admin" : "collab",
        position: "Pendiente",
        workScheduleId: DEFAULT_WORK_SCHEDULE_ID,
        active: true,
        approved: false,
        isActive: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(userRef, {
        uid: newProfile.uid,
        email: newProfile.email,
        displayName: newProfile.displayName,
        photoURL: newProfile.photoURL,
        approved: false,
        isActive: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        role: newProfile.role,
        position: newProfile.position,
        workScheduleId: newProfile.workScheduleId,
      });
      await setDoc(
        doc(db, "userDirectory", newProfile.uid),
        buildDirectoryProfile(newProfile),
        { merge: true },
      );
      upsertUser(newProfile);
      throw new Error("Tu acceso está pendiente de aprobación.");
    }
    const data = snapshot.data() as Partial<UserProfile>;
    if (process.env.NODE_ENV !== "production") {
      console.log("[auth] Firestore user data", data);
    }
    if (!data.role || !data.workScheduleId) {
      await setDoc(
        userRef,
        {
          role: data.role ?? "collab",
          workScheduleId: data.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      data.role = data.role ?? "collab";
      data.workScheduleId = data.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID;
    }
    const approved = data.approved;
    const isActive = data.isActive ?? true;
    if (approved !== true) {
      throw new Error("Tu acceso aún no está habilitado.");
    }
    if (isActive === false) {
      throw new Error("Tu cuenta está desactivada.");
    }
    const existingProfile = email ? getUserByEmail(email) : null;
    const mergedProfile: UserProfile = {
      uid: data.uid ?? firebaseUid,
      email: data.email ?? email,
      displayName: data.displayName ?? firebaseUser.displayName ?? "Usuario",
      photoURL: data.photoURL ?? firebaseUser.photoURL ?? "",
      role: data.role ?? existingProfile?.role ?? "collab",
      position: data.position ?? existingProfile?.position ?? "Sin asignar",
      workScheduleId:
        data.workScheduleId ?? existingProfile?.workScheduleId ?? DEFAULT_WORK_SCHEDULE_ID,
      active: data.isActive ?? data.active ?? existingProfile?.active ?? true,
      approved: data.approved ?? existingProfile?.approved,
      isActive: data.isActive ?? existingProfile?.isActive,
      createdAt:
        typeof data.createdAt === "string"
          ? data.createdAt
          : existingProfile?.createdAt ?? new Date().toISOString(),
      birthDate: data.birthDate ?? existingProfile?.birthDate,
      employmentStartDate: data.employmentStartDate ?? existingProfile?.employmentStartDate,
      phone: data.phone ?? existingProfile?.phone,
      maritalStatus: data.maritalStatus ?? existingProfile?.maritalStatus,
      gender: data.gender ?? existingProfile?.gender,
      bankName: data.bankName ?? existingProfile?.bankName,
      accountType: data.accountType ?? existingProfile?.accountType,
      accountNumber: data.accountNumber ?? existingProfile?.accountNumber,
      cci: data.cci ?? existingProfile?.cci,
    };
    upsertUser(mergedProfile);
    await setDoc(
      doc(db, "userDirectory", mergedProfile.uid),
      buildDirectoryProfile(mergedProfile),
      { merge: true },
    );
    setStoredSession({ uid: mergedProfile.uid, email: mergedProfile.email });
    setAuthUser({ uid: mergedProfile.uid, email: mergedProfile.email });
    setProfile(mergedProfile);
    return mergedProfile;
  };

  const signOutUser = async () => {
    if (profile?.uid) {
      await updatePresence(profile.uid, "offline");
    }
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

    const nextProfile = {
      ...profile,
      ...payload,
    };

    setProfile(nextProfile);
    upsertUser(nextProfile);

    const updated = updateUserProfile(profile.uid, payload);
    if (updated) setProfile(updated);

    void atomicUserWrite(
      profile.uid,
      { ...payload },
      buildDirectoryProfile({
        ...nextProfile,
        ...payload,
        uid: profile.uid,
        email: (payload.email as string | undefined) ?? nextProfile.email,
      }),
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

  useEffect(() => {
    if (!profile?.uid || profile.isActive === false || profile.approved === false) return;
    if (typeof window === "undefined") return;

    const syncOnline = () => {
      const status = document.visibilityState === "visible" ? "online" : "offline";
      void updatePresence(profile.uid, status);
    };
    const syncOffline = () => {
      void updatePresence(profile.uid, "offline");
    };

    syncOnline();
    const interval = window.setInterval(syncOnline, 60_000);
    document.addEventListener("visibilitychange", syncOnline);
    window.addEventListener("focus", syncOnline);
    window.addEventListener("pagehide", syncOffline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", syncOnline);
      window.removeEventListener("focus", syncOnline);
      window.removeEventListener("pagehide", syncOffline);
    };
  }, [profile?.uid, profile?.isActive, profile?.approved]);

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
