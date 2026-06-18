"use client";

import { ChevronLeft, ChevronRight, UsersRound } from "lucide-react";

type NavigatorItem = {
  uid: string;
  label: string;
  meta?: string;
  status?: string;
};

type AdminAttendanceWorkspaceNavigatorProps = {
  title?: string;
  subtitle?: string;
  items: NavigatorItem[];
  selectedUserId: string;
  onSelectUser: (uid: string) => void;
};

export default function AdminAttendanceWorkspaceNavigator({
  title = "Cambio rápido",
  subtitle = "Mantén el foco y cambia de colaborador sin volver a la lista lateral.",
  items,
  selectedUserId,
  onSelectUser,
}: AdminAttendanceWorkspaceNavigatorProps) {
  const currentIndex = items.findIndex((item) => item.uid === selectedUserId);
  const fallbackIndex = currentIndex >= 0 ? currentIndex : 0;
  const selectedItem = items[fallbackIndex] ?? null;
  const canGoPrev = fallbackIndex > 0;
  const canGoNext = fallbackIndex >= 0 && fallbackIndex < items.length - 1;

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            <UsersRound size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => canGoPrev && onSelectUser(items[fallbackIndex - 1].uid)}
            disabled={!canGoPrev}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => canGoNext && onSelectUser(items[fallbackIndex + 1].uid)}
            disabled={!canGoNext}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Colaborador en foco
          </span>
          <select
            value={selectedItem?.uid ?? ""}
            onChange={(event) => onSelectUser(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white"
          >
            {items.map((item) => (
              <option key={item.uid} value={item.uid}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Contexto</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {selectedItem?.status || "Sin estado"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {selectedItem?.meta || `${items.length} colaboradores en esta vista`}
          </p>
        </div>
      </div>
    </div>
  );
}
