"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { listAttendanceRecords, listRequests, listUsers } from "@/services/firebase/db";

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const users = listUsers();
  const requests = listRequests();
  const attendance = listAttendanceRecords();

  const activeUsers = users.filter((item) => item.active).length;
  const pendingRequests = requests.filter((item) => item.status === "PENDING").length;
  const openAttendance = attendance.filter((item) => item.status === "OPEN").length;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? "Administrador"} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Colaboradores activos</p>
          <p className="text-2xl font-semibold text-slate-900">{activeUsers}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Solicitudes pendientes</p>
          <p className="text-2xl font-semibold text-slate-900">{pendingRequests}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Jornadas abiertas</p>
          <p className="text-2xl font-semibold text-slate-900">{openAttendance}</p>
        </div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Dashboard global</h2>
        <p className="text-xs text-slate-500">Indicadores y alertas administrativas.</p>
        <div className="mt-4 rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500">
          Próximamente: reportes y KPI avanzados.
        </div>
      </div>
    </div>
  );
}
