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

type EditState = {
  uid: string;
  displayName: string;
  position: string;
};

const formatStatusLabel = (status?: FirestoreUser["status"]) => {
  switch (status) {
    case "active":
      return "Activo";
    case "disabled":
      return "Deshabilitado";
    case "pending":
    default:
      return "Pendiente";
  }
};

const formatRoleLabel = (role?: UserProfile["role"]) => (role === "admin" ? "Administrador" : "Colaborador");

const formatApprovedLabel = (approved?: boolean) => (approved === true ? "Aprobado" : "Pendiente");

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
  role: {
    admin: "bg-indigo-50 text-indigo-700 border border-indigo-200",
    collab: "bg-slate-100 text-slate-600 border border-slate-200",
  },
  status: {
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    active: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    disabled: "bg-rose-50 text-rose-700 border border-rose-200",
  },
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<FirestoreUser[]>([]);
  const [editing, setEditing] = useState<EditState | null>(null);

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

  const updateUserDoc = async (uid: string, payload: Record<string, unknown>) => {
    try {
      setSuccess(null);
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        ...payload,
        updatedAt: serverTimestamp(),
      });
      setError(null);
    } catch (err) {
      console.error("[admin/users] Error updating user", err);
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios.";
      setError(message);
    }
  };

  const approveUser = (uid: string) =>
    updateUserDoc(uid, { approved: true, status: "active", isActive: true });

  const rejectUser = (uid: string) =>
    updateUserDoc(uid, { approved: false, status: "disabled", isActive: false });

  const toggleActive = (uid: string, nextValue: boolean) =>
    updateUserDoc(uid, {
      isActive: nextValue,
      status: nextValue ? "active" : "disabled",
    });

  const updateRole = (uid: string, role: UserProfile["role"]) => updateUserDoc(uid, { role });

  const updateProfileFields = (uid: string, fields: { displayName: string; position: string }) =>
    updateUserDoc(uid, fields);

  const startEdit = (item: FirestoreUser) => {
    setEditing({
      uid: item.uid,
      displayName: item.displayName ?? "",
      position: item.position ?? "",
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing) return;
    await updateProfileFields(editing.uid, {
      displayName: editing.displayName.trim(),
      position: editing.position.trim(),
    });
    setSuccess("Cambios guardados.");
    setEditing(null);
  };

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

  const sections = [
    { title: "Pendientes", items: pendingUsers },
    { title: "Activos", items: activeUsers },
    { title: "Otros", items: otherUsers },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Usuarios y Roles</h2>
            <p className="text-xs text-slate-500">Gestiona accesos, roles y estados de aprobación.</p>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-emerald-600">{success}</p> : null}
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Cargando usuarios...</p>
        ) : (
          <div className="mt-4 space-y-8">
            {sections.map(({ title, items }) => (
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
                        <th className="px-4 py-3 font-semibold">Rol</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 text-center font-semibold">Aprobación</th>
                        <th className="px-4 py-3 text-center font-semibold">Activo</th>
                        <th className="px-4 py-3 font-semibold">Creado</th>
                        <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 text-slate-700">
                      {items.map((item) => {
                        const isEditing = editing?.uid === item.uid;
                        return (
                          <tr key={item.uid} className="align-top">
                            <td className="px-4 py-3">{item.email}</td>
                            <td className="px-4 py-3">
                              {isEditing ? (
                                <div className="space-y-2">
                                  <input
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                                    value={editing.displayName}
                                    onChange={(event) =>
                                      setEditing((prev) =>
                                        prev ? { ...prev, displayName: event.target.value } : prev
                                      )
                                    }
                                  />
                                  <input
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                                    value={editing.position}
                                    onChange={(event) =>
                                      setEditing((prev) =>
                                        prev ? { ...prev, position: event.target.value } : prev
                                      )
                                    }
                                    placeholder="Puesto"
                                  />
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-900">{item.displayName}</p>
                                  <p className="text-[11px] text-slate-500">{item.position || "—"}</p>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  item.role === "admin" ? badgeStyles.role.admin : badgeStyles.role.collab
                                }`}
                              >
                                {formatRoleLabel(item.role)}
                              </span>
                              <div className="mt-2">
                                <select
                                  className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
                                  value={item.role ?? "collab"}
                                  onChange={(event) =>
                                    updateRole(item.uid, event.target.value as UserProfile["role"])
                                  }
                                >
                                  <option value="collab">Colaborador</option>
                                  <option value="admin">Administrador</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  badgeStyles.status[item.status ?? "pending"]
                                }`}
                              >
                                {formatStatusLabel(item.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-[11px] font-semibold text-slate-600">
                              {formatApprovedLabel(item.approved)}
                            </td>
                            <td className="px-4 py-3 text-center text-[11px] font-semibold text-slate-600">
                              {item.isActive === false ? "No" : "Sí"}
                            </td>
                            <td className="px-4 py-3 text-[11px] text-slate-500">
                              {formatDateLabel(item.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col items-end gap-2">
                                <div className="flex flex-wrap justify-end gap-2">
                                  {item.approved !== true ? (
                                    <>
                                      <button
                                        className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700"
                                        type="button"
                                        onClick={() => approveUser(item.uid)}
                                      >
                                        Aprobar
                                      </button>
                                      <button
                                        className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600"
                                        type="button"
                                        onClick={() => rejectUser(item.uid)}
                                      >
                                        Rechazar
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {item.isActive === false || item.status === "disabled" ? (
                                        <button
                                          className="rounded-full border border-indigo-200 px-3 py-1 text-[11px] font-semibold text-indigo-600"
                                          type="button"
                                          onClick={() => toggleActive(item.uid, true)}
                                        >
                                          Activar
                                        </button>
                                      ) : (
                                        <button
                                          className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
                                          type="button"
                                          onClick={() => toggleActive(item.uid, false)}
                                        >
                                          Desactivar
                                        </button>
                                      )}
                                    </>
                                  )}
                                  {isEditing ? (
                                    <>
                                      <button
                                        className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
                                        type="button"
                                        onClick={cancelEdit}
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        className="rounded-full bg-indigo-600 px-3 py-1 text-[11px] font-semibold text-white"
                                        type="button"
                                        onClick={saveEdit}
                                      >
                                        Guardar
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
                                      type="button"
                                      onClick={() => startEdit(item)}
                                    >
                                      Editar
                                    </button>
                                  )}
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
                  {items.map((item) => {
                    const isEditing = editing?.uid === item.uid;
                    return (
                      <div key={item.uid} className="rounded-xl border border-slate-200/60 p-4 text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.displayName}</p>
                            <p className="text-xs text-slate-500">{item.email}</p>
                          </div>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
                              item.role === "admin" ? badgeStyles.role.admin : badgeStyles.role.collab
                            }`}
                          >
                            {formatRoleLabel(item.role)}
                          </span>
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
                            {formatApprovedLabel(item.approved)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                            {item.isActive === false ? "Inactivo" : "Activo"}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                            {formatDateLabel(item.createdAt)}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <label className="text-[11px] font-semibold text-slate-500">
                            Rol
                            <select
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              value={item.role ?? "collab"}
                              onChange={(event) =>
                                updateRole(item.uid, event.target.value as UserProfile["role"])
                              }
                            >
                              <option value="collab">Colaborador</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </label>
                          {isEditing ? (
                            <div className="space-y-2">
                              <input
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                                value={editing.displayName}
                                onChange={(event) =>
                                  setEditing((prev) =>
                                    prev ? { ...prev, displayName: event.target.value } : prev
                                  )
                                }
                              />
                              <input
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                                value={editing.position}
                                onChange={(event) =>
                                  setEditing((prev) =>
                                    prev ? { ...prev, position: event.target.value } : prev
                                  )
                                }
                                placeholder="Puesto"
                              />
                              <div className="flex gap-2">
                                <button
                                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600"
                                  type="button"
                                  onClick={cancelEdit}
                                >
                                  Cancelar
                                </button>
                                <button
                                  className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white"
                                  type="button"
                                  onClick={saveEdit}
                                >
                                  Guardar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600"
                              type="button"
                              onClick={() => startEdit(item)}
                            >
                              Editar
                            </button>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {item.approved !== true ? (
                              <>
                                <button
                                  className="rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-700"
                                  type="button"
                                  onClick={() => approveUser(item.uid)}
                                >
                                  Aprobar
                                </button>
                                <button
                                  className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600"
                                  type="button"
                                  onClick={() => rejectUser(item.uid)}
                                >
                                  Rechazar
                                </button>
                              </>
                            ) : item.isActive === false || item.status === "disabled" ? (
                              <button
                                className="rounded-full border border-indigo-200 px-3 py-1 text-[11px] font-semibold text-indigo-600"
                                type="button"
                                onClick={() => toggleActive(item.uid, true)}
                              >
                                Activar
                              </button>
                            ) : (
                              <button
                                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
                                type="button"
                                onClick={() => toggleActive(item.uid, false)}
                              >
                                Desactivar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
