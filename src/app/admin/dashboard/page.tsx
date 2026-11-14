"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { listAttendanceRecords, listRequests, listUsers } from "@/services/firebase/db";
import MonthEndAdminPanel from "./MonthEndAdminPanel";

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
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
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
      <MonthEndAdminPanel users={users} />
    </div>
  );
}
