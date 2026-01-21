"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/useAuth";
import { listUsers, updateUser } from "@/services/firebase/db";
import type { UserRole } from "@/services/firebase/types";

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [, setRefresh] = useState(0);

  const users = listUsers();
  const activeAdmins = users.filter((item) => item.role === "admin" && item.active);

  const handleRoleChange = (uid: string, role: UserRole) => {
    const current = users.find((item) => item.uid === uid);
    if (!current) return;
    if (current.role === "admin" && role !== "admin" && activeAdmins.length <= 1) {
      setError("Debe existir al menos un admin activo.");
      return;
    }
    updateUser(uid, { role });
    setError(null);
    setRefresh((prev) => prev + 1);
  };

  const handleActiveChange = (uid: string, active: boolean) => {
    const current = users.find((item) => item.uid === uid);
    if (!current) return;
    if (current.role === "admin" && !active && activeAdmins.length <= 1) {
      setError("No puedes desactivar al último admin.");
      return;
    }
    updateUser(uid, { active });
    setError(null);
    setRefresh((prev) => prev + 1);
  };

  const handlePositionChange = (uid: string, position: string) => {
    updateUser(uid, { position });
    setRefresh((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Usuarios y Roles</h2>
        <p className="text-xs text-slate-500">Gestiona accesos y puestos.</p>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-4 space-y-3">
          {users.map((item) => (
            <div
              key={item.uid}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{item.displayName}</p>
                <p className="text-xs text-slate-500">{item.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-semibold text-slate-500">
                  Rol
                  <select
                    className="ml-2 rounded-full border border-slate-200/60 px-2 py-1 text-xs"
                    value={item.role}
                    onChange={(event) => handleRoleChange(item.uid, event.target.value as UserRole)}
                  >
                    <option value="collab">collab</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  Puesto
                  <input
                    className="ml-2 w-40 rounded-full border border-slate-200/60 px-2 py-1 text-xs"
                    value={item.position}
                    onChange={(event) => handlePositionChange(item.uid, event.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                  Activo
                  <input
                    className="h-4 w-4 accent-indigo-600"
                    type="checkbox"
                    checked={item.active}
                    onChange={(event) => handleActiveChange(item.uid, event.target.checked)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
