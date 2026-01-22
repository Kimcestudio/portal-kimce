"use client";

import { collection, doc, onSnapshot, serverTimestamp, setDoc, type DocumentData } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/services/firebase/client";
import type { UserProfile } from "@/services/firebase/types";

type FirestoreUser = UserProfile & {
  approved?: boolean;
  isActive?: boolean;
  status?: "pending" | "active" | "disabled";
  createdAt?: string;
  updatedAt?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FirestoreUser[]>([]);

  useEffect(() => {
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          if (data.status === "admin") {
            const userRef = doc(db, "users", docSnap.id);
            setDoc(
              userRef,
              {
                role: "admin",
                status: "active",
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            ).catch((error) => {
              console.error("[admin/users] Failed to migrate legacy status", error);
            });
          }
          const toTimestamp = (value: unknown) => value as FirestoreTimestamp | undefined;
          const createdAt = toTimestamp(data.createdAt)?.toDate?.()?.toISOString() ?? data.createdAt;
          const updatedAt = toTimestamp(data.updatedAt)?.toDate?.()?.toISOString() ?? data.updatedAt;
          return {
            uid: data.uid ?? docSnap.id,
            email: data.email ?? "",
            displayName: data.displayName ?? "Usuario",
            photoURL: data.photoURL ?? "",
            role: (data.role as UserProfile["role"]) ?? "collab",
            position: data.position ?? "",
            active: data.active ?? data.isActive ?? true,
            approved: data.approved,
            isActive: data.isActive,
            status: (data.status as FirestoreUser["status"]) ?? "pending",
            createdAt,
            updatedAt,
          };
        });
        setUsers(nextUsers);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[admin/users] Error loading users", err);
        const message = err?.message ?? "No se pudieron cargar los usuarios.";
        const code = err?.code ? ` (${err.code})` : "";
        setError(`${message}${code}`);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const sortedUsers = useMemo(() => {
    const getSortableValue = (item: FirestoreUser) => {
      if (item.createdAt) {
        const createdAtMs = Date.parse(item.createdAt);
        if (!Number.isNaN(createdAtMs)) return createdAtMs;
      }
      if (item.updatedAt) {
        const updatedAtMs = Date.parse(item.updatedAt);
        if (!Number.isNaN(updatedAtMs)) return updatedAtMs;
      }
      return item.email.toLowerCase();
    };
    return [...users].sort((a, b) => {
      const aValue = getSortableValue(a);
      const bValue = getSortableValue(b);
      if (typeof aValue === "number" && typeof bValue === "number") {
        return bValue - aValue;
      }
      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue);
      }
      if (typeof aValue === "number") return -1;
      if (typeof bValue === "number") return 1;
      return 0;
    });
  }, [users]);

  const pendingUsers = useMemo(
    () => sortedUsers.filter((item) => item.approved !== true || item.status === "pending"),
    [sortedUsers]
  );
  const activeUsers = useMemo(
    () =>
      sortedUsers.filter(
        (item) => item.approved === true && item.status === "active" && item.isActive === true
      ),
    [sortedUsers]
  );
  const otherUsers = useMemo(
    () => sortedUsers.filter((item) => !pendingUsers.includes(item) && !activeUsers.includes(item)),
    [sortedUsers, pendingUsers, activeUsers]
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Usuarios y Roles</h2>
        <p className="text-xs text-slate-500">Gestiona accesos y puestos.</p>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Cargando usuarios...</p>
        ) : (
          <div className="mt-4 space-y-6">
            {[
              { title: "Pendientes", items: pendingUsers },
              { title: "Activos", items: activeUsers },
              { title: "Otros", items: otherUsers },
            ].map(({ title, items }) => (
              <div key={title} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {title} ({items.length})
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-200/60">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Email</th>
                        <th className="px-3 py-2 font-semibold">Nombre</th>
                        <th className="px-3 py-2 font-semibold">Rol</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 font-semibold">Approved</th>
                        <th className="px-3 py-2 font-semibold">isActive</th>
                        <th className="px-3 py-2 font-semibold">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 text-slate-700">
                      {items.map((item) => (
                        <tr key={item.uid}>
                          <td className="px-3 py-2">{item.email}</td>
                          <td className="px-3 py-2">{item.displayName}</td>
                          <td className="px-3 py-2">{item.role}</td>
                          <td className="px-3 py-2">{item.status ?? "-"}</td>
                          <td className="px-3 py-2">{item.approved === true ? "true" : "false"}</td>
                          <td className="px-3 py-2">{item.isActive === true ? "true" : "false"}</td>
                          <td className="px-3 py-2">{item.createdAt ?? item.updatedAt ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {items.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-slate-400">Sin usuarios en esta sección.</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
