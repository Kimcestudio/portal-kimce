"use client";

import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/components/auth/AuthProvider";

export default function DocumentsPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Documentos</h2>
            <p className="text-xs text-slate-500">Gestión de archivos del colaborador.</p>
          </div>
          <button
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft"
            type="button"
          >
            Subir documento
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-slate-200/70 p-6 text-sm text-slate-500">
          Módulo en construcción.
        </div>
      </div>
    </div>
  );
}
