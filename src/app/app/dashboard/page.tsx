"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/useAuth";
import { listAllRecords } from "@/lib/storage/attendanceStorage";
import { minutesToHHMM } from "@/lib/attendanceUtils";
import { listRequests } from "@/services/firebase/db";

export default function DashboardPage() {
  const { user } = useAuth();
  const records = user ? listAllRecords(user.uid) : [];
  const totalMinutes = records.reduce((sum, record) => sum + record.totalMinutes, 0);
  const pendingRequests = user
    ? listRequests().filter((item) => item.status === "PENDING" && item.createdBy === user.uid).length
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Horas registradas</p>
          <p className="text-2xl font-semibold text-slate-900">{minutesToHHMM(totalMinutes)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Jornadas</p>
          <p className="text-2xl font-semibold text-slate-900">{records.length}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Solicitudes pendientes</p>
          <p className="text-2xl font-semibold text-slate-900">{pendingRequests}</p>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Panel personal</h2>
        <p className="text-xs text-slate-500">Resumen rápido de tu actividad.</p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500">
          Próximamente: alertas, recordatorios y métricas.
        </div>
      </div>
    </div>
  );
}
