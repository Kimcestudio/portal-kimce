"use client";

import PageHeader from "@/components/PageHeader";
import FinanceGate from "@/components/admin/FinanceGate";
import { useAuth } from "@/components/auth/AuthProvider";

export default function AdminFinancePage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
      <FinanceGate>
        <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
          <h2 className="text-base font-semibold text-slate-900">Finanzas</h2>
          <p className="text-xs text-slate-500">Vista resumida de ingresos y costos.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200/60 px-4 py-3">
              <p className="text-xs text-slate-500">Ingresos proyectados</p>
              <p className="text-2xl font-semibold text-slate-900">$42k</p>
            </div>
            <div className="rounded-xl border border-slate-200/60 px-4 py-3">
              <p className="text-xs text-slate-500">Costos operativos</p>
              <p className="text-2xl font-semibold text-slate-900">$18k</p>
            </div>
          </div>
        </div>
      </FinanceGate>
    </div>
  );
}
