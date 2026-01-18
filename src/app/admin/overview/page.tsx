"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { minutesToHHMM } from "@/lib/attendanceUtils";
import { listAttendanceRecords, listRequests, listUsers } from "@/services/firebase/db";

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const users = listUsers();
  const requests = listRequests();
  const attendance = listAttendanceRecords();

  const activeUsers = users.filter((item) => item.active).length;
  const pendingRequests = requests.filter((item) => item.status === "PENDING").length;
  const globalBalanceMinutes = attendance.reduce((total, record) => total + record.totalMinutes, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? "Administrador"} />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Colaboradores activos</p>
          <p className="text-3xl font-semibold text-slate-900">{activeUsers}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Solicitudes pendientes</p>
          <p className="text-3xl font-semibold text-slate-900">{pendingRequests}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <p className="text-xs text-slate-500">Horas registradas</p>
          <p className="text-3xl font-semibold text-slate-900">
            {minutesToHHMM(globalBalanceMinutes)}
          </p>
        </div>
      </div>
    </div>
  );
}
