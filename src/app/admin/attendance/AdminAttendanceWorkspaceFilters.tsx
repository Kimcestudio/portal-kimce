"use client";

import { formatISODate, getWeekStartMonday } from "@/lib/attendanceUtils";
import type { AttendanceMonitorUser } from "@/lib/attendanceUtils";

type AdminAttendanceWorkspaceFiltersProps = {
  weekStart: Date;
  selectedUserId: string;
  users: AttendanceMonitorUser[];
  onWeekChange: (date: Date) => void;
  onUserChange: (uid: string) => void;
};

const getUserDisplayName = (user: AttendanceMonitorUser) =>
  user.displayName || user.fullName || user.name || user.email || "Colaborador";

export default function AdminAttendanceWorkspaceFilters({
  weekStart,
  selectedUserId,
  users,
  onWeekChange,
  onUserChange,
}: AdminAttendanceWorkspaceFiltersProps) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Filtros del workspace</h3>
          <p className="text-xs text-slate-500">Mantén la misma semana y colaborador al moverte entre asistencia, solicitudes y alertas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Semana
            <input
              className="mt-2 block rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="date"
              value={formatISODate(weekStart)}
              onChange={(event) => {
                const next = new Date(event.target.value);
                if (!Number.isNaN(next.getTime())) {
                  onWeekChange(getWeekStartMonday(next));
                }
              }}
            />
          </label>

          <label className="text-xs font-semibold text-slate-500">
            Colaborador
            <select
              className="mt-2 block min-w-[220px] rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={selectedUserId}
              onChange={(event) => onUserChange(event.target.value)}
            >
              <option value="all">Todos</option>
              {users.map((item) => (
                <option key={item.uid} value={item.uid}>
                  {getUserDisplayName(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
