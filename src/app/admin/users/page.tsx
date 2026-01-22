"use client";

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { db } from "@/services/firebase/client";
import type { UserProfile } from "@/services/firebase/types";

type FirestoreUser = UserProfile & {
  isActive?: boolean;
  status?: "pending" | "active" | "inactive" | "disabled";
  createdAt?: string;
  updatedAt?: string;
};

type FirestoreTimestamp = {
  toDate?: () => Date;
  toMillis?: () => number;
};

const formatStatusLabel = (status?: FirestoreUser["status"]) => {
  switch (status) {
    case "active":
      return "Activo";
    case "inactive":
      return "Inactivo";
    case "disabled":
      return "Deshabilitado";
    case "pending":
    default:
      return "Pendiente";
  }
};

const formatDateLabel = (value?: string) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const badgeStyles = {
  status: {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    inactive: "bg-rose-50 text-rose-700 border border-rose-200",
    disabled: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FirestoreUser[]>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    const usersRef = collection(db, "users");
    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        const nextUsers = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
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
  }, [user?.role]);

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
    () => sortedUsers.filter((item) => item.status === "pending"),
    [sortedUsers]
  );
  const activeUsers = useMemo(
    () =>
      sortedUsers.filter((item) => item.status === "active"),
    [sortedUsers]
  );
  const otherUsers = useMemo(
    () => sortedUsers.filter((item) => !pendingUsers.includes(item) && !activeUsers.includes(item)),
    [sortedUsers, pendingUsers, activeUsers]
  );

  const updateUserDoc = async (uid: string, payload: Record<string, unknown>) => {
    try {
      setSuccess(null);
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      setSuccess("Cambios guardados.");
      setError(null);
    } catch (err) {
      console.error("[admin/users] Error updating user", err);
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios.";
      setError(message);
    }
  };

  const toggleActive = (uid: string, nextValue: boolean) =>
    updateUserDoc(uid, {
      status: nextValue ? "active" : "inactive",
    });

  const updateRole = (uid: string, role: UserProfile["role"]) => updateUserDoc(uid, { role });

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          No tienes permisos para ver esta sección.
        </div>
      </div>
    );
  }

  const userSections = [
    { title: "Pendientes", items: pendingUsers },
    { title: "Activos", items: activeUsers },
    { title: "Otros", items: otherUsers },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="mx-auto w-full max-w-6xl rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Usuarios y Roles</h2>
            <p className="text-xs text-slate-500">Gestiona accesos, roles y estados de usuario.</p>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Cargando usuarios...</p>
        ) : (
          <div className="mt-4 space-y-8">
            {userSections.map(({ title, items }) => (
              <div key={title} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {title} ({items.length})
                  </p>
                </div>
                <div className="hidden overflow-x-auto rounded-xl border border-slate-200/60 md:block">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Correo</th>
                        <th className="px-4 py-3 font-semibold">Nombre</th>
                        <th className="px-4 py-3 text-center font-semibold">Rol</th>
                        <th className="px-4 py-3 text-center font-semibold">Estado</th>
                        <th className="px-4 py-3 text-center font-semibold">Activo</th>
                        <th className="px-4 py-3 font-semibold">Creado</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 text-slate-700">
                      {items.map((item) => {
                        return (
                          <tr key={item.uid} className="align-middle">
                            <td className="px-4 py-3">{item.email}</td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-900">{item.displayName}</p>
                                <p className="text-[11px] text-slate-500">{item.position || "—"}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <select
                                className="w-36 rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                value={item.role ?? "collab"}
                                onChange={(event) =>
                                  updateRole(item.uid, event.target.value as UserProfile["role"])
                                }
                              >
                                <option value="admin">Administrador</option>
                                <option value="collab">Colaborador</option>
                              </select>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  badgeStyles.status[item.status ?? "pending"]
                                }`}
                              >
                                {formatStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <label className="inline-flex items-center justify-center">
                                <input
                                  className="peer sr-only"
                                  type="checkbox"
                                  checked={item.status === "active"}
                                  onChange={(event) => toggleActive(item.uid, event.target.checked)}
                                />
                                <span className="flex h-5 w-9 items-center rounded-full bg-slate-200 p-0.5 transition peer-checked:bg-emerald-500">
                                  <span className="h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                                </span>
                              </label>
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-500">
                              {formatDateLabel(item.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex flex-wrap justify-end gap-2">
                                  <button
                                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                      item.status === "pending"
                                        ? "border border-emerald-200 text-emerald-700"
                                        : "border border-amber-200 text-amber-700"
                                    }`}
                                    type="button"
                                    onClick={() =>
                                      updateUserDoc(item.uid, {
                                        status: item.status === "pending" ? "active" : "pending",
                                      })
                                    }
                                  >
                                    {item.status === "pending" ? "Aprobar" : "Marcar pendiente"}
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {items.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-slate-400">Sin usuarios en esta sección.</p>
                  ) : null}
                </div>
                <div className="space-y-3 md:hidden">
                  {items.length === 0 ? (
                    <div className="rounded-xl border border-slate-200/60 p-4 text-xs text-slate-400">
                      Sin usuarios en esta sección.
                    </div>
                  ) : null}
                  {items.map((item) => (
                      <div key={item.uid} className="rounded-xl border border-slate-200/60 p-4 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.displayName}</p>
                            <p className="text-xs text-slate-500">{item.email}</p>
                          </div>
                          <select
                            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"
                            value={item.role ?? "collab"}
                            onChange={(event) =>
                              updateRole(item.uid, event.target.value as UserProfile["role"])
                            }
                          >
                            <option value="admin">Administrador</option>
                            <option value="collab">Colaborador</option>
                          </select>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span
                            className={`rounded-full px-2 py-1 font-semibold ${
                              badgeStyles.status[item.status ?? "pending"]
                            }`}
                          >
                            {formatStatusLabel(item.status)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                            {formatDateLabel(item.createdAt)}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                              Activo
                              <input
                                className="peer sr-only"
                                type="checkbox"
                                checked={item.status === "active"}
                                onChange={(event) => toggleActive(item.uid, event.target.checked)}
                              />
                              <span className="flex h-5 w-9 items-center rounded-full bg-slate-200 p-0.5 transition peer-checked:bg-emerald-500">
                                <span className="h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
