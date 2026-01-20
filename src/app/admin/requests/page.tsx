"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";
import { listRequests, listUsers, updateRequest } from "@/services/firebase/db";
import type { RequestStatus } from "@/services/firebase/types";

const filters: { label: string; value: RequestStatus | "ALL" }[] = [
  { label: "Todas", value: "ALL" },
  { label: "Pendiente", value: "PENDING" },
  { label: "Aprobado", value: "APPROVED" },
  { label: "Rechazado", value: "REJECTED" },
];

export default function AdminRequestsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<RequestStatus | "ALL">("ALL");
  const [refresh, setRefresh] = useState(0);

  const users = listUsers();
  const requests = listRequests();

  const filtered = useMemo(() => {
    if (filter === "ALL") return requests;
    return requests.filter((item) => item.status === filter);
  }, [filter, requests, refresh]);

  const handleUpdate = (id: string, status: RequestStatus) => {
    if (!user) return;
    updateRequest(id, {
      status,
      reviewedBy: user.uid,
      reviewedAt: new Date().toISOString(),
    });
    setRefresh((prev) => prev + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Solicitudes</h2>
        <p className="text-xs text-slate-500">Aprueba o rechaza solicitudes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.value}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filter === item.value
                  ? "bg-indigo-600 text-white shadow-[0_8px_18px_rgba(79,70,229,0.35)]"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
              onClick={() => setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-4 space-y-3">
          {filtered.map((item) => {
            const createdBy = users.find((userItem) => userItem.uid === item.createdBy);
            return (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/60 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.type}</p>
                  <p className="text-xs text-slate-500">
                    {item.date}
                    {item.endDate ? ` - ${item.endDate}` : ""} ·{" "}
                    {item.hours ? `${item.hours}h` : "Jornada completa"} · {item.reason}
                  </p>
                  <p className="text-xs text-slate-400">
                    Creado por {createdBy?.displayName ?? "Colaborador"} ·{" "}
                    {new Date(item.createdAt).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.status === "PENDING"
                        ? "bg-amber-100 text-amber-700"
                        : item.status === "APPROVED"
                        ? "bg-green-100 text-green-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {item.status === "PENDING"
                      ? "Pendiente"
                      : item.status === "APPROVED"
                      ? "Aprobado"
                      : "Rechazado"}
                  </span>
                  <button
                    className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 transition hover:-translate-y-0.5"
                    onClick={() => handleUpdate(item.id, "APPROVED")}
                    type="button"
                  >
                    Aprobar
                  </button>
                  <button
                    className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:-translate-y-0.5"
                    onClick={() => handleUpdate(item.id, "REJECTED")}
                    type="button"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No hay solicitudes para este filtro.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
