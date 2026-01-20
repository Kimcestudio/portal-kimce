"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/useAuth";
import {
  expectedMinutesForDate,
  formatISODate,
  formatTime,
  getWeekDates,
  getWeekStartMonday,
  minutesToHHMM,
} from "@/lib/attendanceUtils";
import { listAttendanceRecords, listUsers } from "@/services/firebase/db";
import type { AdminAttendanceRecord } from "@/services/firebase/types";

function computeBreakMinutes(record: AdminAttendanceRecord | null) {
  if (!record) return 0;
  return record.breaks.reduce((total, current) => {
    if (!current.endAt) return total;
    const start = new Date(current.startAt).getTime();
    const end = new Date(current.endAt).getTime();
    return total + Math.max(0, Math.round((end - start) / 60000));
  }, 0);
}

function isSameWeek(date: Date, weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return date >= weekStart && date < end;
}

export default function AdminHoursPage() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStartMonday(new Date()));
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const users = listUsers();
  const records = listAttendanceRecords();
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const summaries = useMemo(() => {
    const scopedUsers = selectedUserId === "all"
      ? users
      : users.filter((item) => item.uid === selectedUserId);
    return scopedUsers.map((item) => {
      const weekRecords = records.filter((record) => {
        if (record.userId !== item.uid) return false;
        return isSameWeek(new Date(`${record.date}T00:00:00`), weekStart);
      });
      const totalMinutes = weekRecords.reduce((total, record) => total + record.totalMinutes, 0);
      const expectedMinutes = weekDates.reduce((total, date) => total + expectedMinutesForDate(date), 0);
      const diffMinutes = totalMinutes - expectedMinutes;
      const status = diffMinutes < 0 ? "Pendiente" : "Al día";
      return { user: item, weekRecords, totalMinutes, expectedMinutes, diffMinutes, status };
    });
  }, [records, selectedUserId, users, weekDates, weekStart]);

  const detailUser = detailUserId
    ? users.find((item) => item.uid === detailUserId) ?? null
    : null;

  const detailRecords = detailUser
    ? records.filter(
        (record) =>
          record.userId === detailUser.uid &&
          isSameWeek(new Date(`${record.date}T00:00:00`), weekStart)
      )
    : [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Horarios</h2>
            <p className="text-xs text-slate-500">Vista semanal por colaborador.</p>
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
                    setWeekStart(getWeekStartMonday(next));
                  }
                }}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500">
              Colaborador
              <select
                className="mt-2 block rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="all">Todos</option>
                {users.map((item) => (
                  <option key={item.uid} value={item.uid}>
                    {item.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {summaries.map((item) => (
            <button
              key={item.user.uid}
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]"
              onClick={() => setDetailUserId(item.user.uid)}
            >
              <div>
                <p className="font-semibold text-slate-900">{item.user.displayName}</p>
                <p className="text-xs text-slate-500">
                  {item.user.position} · Semana {formatISODate(weekStart)}
                </p>
              </div>
              <div className="text-xs text-slate-500">
                {minutesToHHMM(item.totalMinutes)} ·{" "}
                {item.diffMinutes < 0
                  ? `Debes ${minutesToHHMM(Math.abs(item.diffMinutes))}`
                  : `A favor ${minutesToHHMM(item.diffMinutes)}`}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === "Pendiente"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {item.status}
              </span>
            </button>
          ))}
          {summaries.length === 0 ? (
            <p className="text-sm text-slate-500">No hay registros para esta semana.</p>
          ) : null}
        </div>
      </div>
      {detailUser ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Detalle semanal</h3>
              <p className="text-xs text-slate-500">
                {detailUser.displayName} · {detailUser.position}
              </p>
            </div>
            <button
              className="rounded-full border border-slate-200/60 px-3 py-1 text-xs font-semibold text-slate-500"
              onClick={() => setDetailUserId(null)}
              type="button"
            >
              Cerrar detalle
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {weekDates.map((date) => {
              const dateISO = formatISODate(date);
              const record = detailRecords.find((item) => item.date === dateISO) ?? null;
              const breakMinutes = computeBreakMinutes(record);
              return (
                <div
                  key={dateISO}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{dateISO}</p>
                    <p className="text-xs text-slate-500">
                      Entrada {formatTime(record?.checkInAt ?? null)} · Salida{" "}
                      {formatTime(record?.checkOutAt ?? null)}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Descanso {minutesToHHMM(breakMinutes)} · Total{" "}
                    {minutesToHHMM(record?.totalMinutes ?? 0)}
                  </div>
                  <span className="text-xs text-slate-500">{record?.notes ?? "Sin notas"}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
