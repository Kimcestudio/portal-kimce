"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import PageHeader from "@/components/PageHeader";

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user.displayName} />
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
        <h2 className="text-base font-semibold text-slate-900">Mi perfil</h2>
        <p className="text-xs text-slate-500">Actualiza tus datos básicos.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">
            Nombre
            <input
              className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={user.displayName}
              onChange={(event) => updateUser({ displayName: event.target.value })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Puesto
            <input
              className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={user.position}
              onChange={(event) => updateUser({ position: event.target.value })}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
