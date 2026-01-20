"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/useAuth";
import { minutesToHHMM } from "@/lib/attendanceUtils";
import { listAllRecords } from "@/lib/storage/attendanceStorage";

export default function HistoryPage() {
  const { user } = useAuth();

  const records = user ? listAllRecords(user.uid) : [];
  const history = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
        <h2 className="text-base font-semibold text-slate-900">Historial</h2>
        <p className="text-xs text-slate-500">Registro reciente de jornadas.</p>
        <div className="mt-4 space-y-3">
          {history.map((item) => (
            <div
              key={item.date}
              className="flex items-center justify-between rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{item.date}</p>
                <p className="text-xs text-slate-500">Horas: {minutesToHHMM(item.totalMinutes)}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  item.status === "CLOSED"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {item.status === "CLOSED" ? "Completado" : "Pendiente"}
              </span>
            </div>
          ))}
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay jornadas registradas.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
