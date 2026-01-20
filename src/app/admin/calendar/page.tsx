"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminCalendarPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Calendario global</h2>
        <p className="text-xs text-slate-500">Vista consolidada del equipo.</p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500">
          Próximamente: calendario administrativo.
        </div>
      </div>
    </div>
  );
}
