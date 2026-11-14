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
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 shadow-[0_2px_8px_rgba(17,24,39,0.05)]">
      <p className="shrink-0 text-xs font-semibold text-slate-400">Filtrar</p>

      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        Semana
        <input
          className="rounded-xl border border-slate-200/60 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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

      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        Colaborador
        <select
          className="min-w-[200px] rounded-xl border border-slate-200/60 px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
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
  );
}
