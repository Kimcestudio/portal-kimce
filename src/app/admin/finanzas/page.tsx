"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceGate from "@/components/admin/FinanceGate";
import { useAuth } from "@/components/auth/AuthProvider";
import FinanceTabs from "@/components/finance/FinanceTabs";
import FinanceHeroCard from "@/components/finance/FinanceHeroCard";
import FinanceKpiCard from "@/components/finance/FinanceKpiCard";
import FinanceFilterBar from "@/components/finance/FinanceFilterBar";
import FinanceTable from "@/components/finance/FinanceTable";
import FinancePendingList from "@/components/finance/FinancePendingList";
import FinanceModal, { type NewIncomePayload } from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import { calcKpis, filterMovements } from "@/lib/finance/analytics";
import { formatCurrency, getMonthKey, getMonthLabel } from "@/lib/finance/utils";
import type { FinanceFilters, FinanceMovement, FinanceStatus, FinanceTabKey } from "@/lib/finance/types";
import {
  createIncomeMovement,
  deleteFinanceMovement,
  listFinanceMovements,
  updateFinanceMovementStatus,
} from "@/services/finance";

const tabLabels: Record<FinanceTabKey, string> = {
  dashboard: "Dashboard",
  movimientos: "Movimientos",
  pagos: "Pagos a colaboradores",
  gastos: "Gastos",
  cuentas: "Cuentas & Caja",
  cierre: "Cierre de mes",
};

export default function FinanceModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceTabKey>("dashboard");
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [filters, setFilters] = useState<FinanceFilters>({
    monthKey: getMonthKey(new Date()),
    status: "all",
    account: "all",
    responsible: "all",
    category: "all",
  });

  useEffect(() => {
    setMovements(listFinanceMovements());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const filteredMovements = useMemo(() => filterMovements(movements, filters), [movements, filters]);

  const kpis = useMemo(() => calcKpis(movements, filters.monthKey), [movements, filters.monthKey]);

  const openModal = () => setIsModalOpen(true);

  const handleCreateMovement = (values: NewIncomePayload) => {
    const movement = createIncomeMovement({
      clientName: values.clientName,
      projectService: values.projectService,
      amount: values.amount,
      incomeDate: new Date(values.incomeDate).toISOString(),
      expectedPayDate: values.expectedPayDate ? new Date(values.expectedPayDate).toISOString() : null,
      accountDestination: values.accountDestination,
      responsible: values.responsible,
      status: values.status,
      reference: values.reference,
      notes: values.notes,
    });
    setMovements([movement, ...listFinanceMovements()]);
    setIsModalOpen(false);
    setToast("Ingreso creado");
  };

  const handleStatusChange = (id: string, status: FinanceStatus) => {
    const next = updateFinanceMovementStatus(id, status);
    setMovements(next);
    setToast("Estado actualizado");
  };

  const handleDeleteMovement = (id: string) => {
    const next = deleteFinanceMovement(id);
    setMovements(next);
    setToast("Movimiento eliminado");
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? "Administrador"} />
      <FinanceGate>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Admin / Finanzas / {tabLabels[activeTab]}
              </p>
              <h1 className="text-2xl font-semibold text-slate-900">Finanzas</h1>
              <p className="text-sm text-slate-500">
                {getMonthLabel(filters.monthKey)} · Control mensual de ingresos.
              </p>
            </div>
            <button
              type="button"
              onClick={openModal}
              className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
            >
              Nuevo movimiento
            </button>
          </div>

          {toast ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
              {toast}
            </div>
          ) : null}

          <FinanceTabs active={activeTab} onChange={(key) => setActiveTab(key)} />
          <FinanceFilterBar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
            }}
          />

          {isLoading ? (
            <FinanceSkeleton />
          ) : (
            <div className="space-y-6">
              {activeTab === "dashboard" ? (
                <>
                  <FinanceHeroCard
                    monthKey={filters.monthKey}
                    incomePaid={kpis.incomePaid}
                    expensesPaid={kpis.expensesPaid}
                    netIncome={kpis.netIncome}
                    margin={kpis.margin}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FinanceKpiCard title="Ingresos cobrados" value={kpis.incomePaid} tone="blue" />
                    <FinanceKpiCard title="Pendiente por cobrar" value={kpis.incomePending} tone="amber" />
                    <FinanceKpiCard title="Gastos pagados" value={kpis.expensesPaid} tone="rose" />
                    <FinanceKpiCard title="Utilidad neta" value={kpis.netIncome} tone="green" />
                  </div>
                  <FinancePendingList
                    title="Pendientes por cobrar"
                    items={filteredMovements.filter((movement) => movement.status === "PENDIENTE")}
                    emptyLabel="Sin pendientes."
                  />
                </>
              ) : null}

              {activeTab === "movimientos" ? (
                <FinanceTable
                  movements={filteredMovements}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteMovement}
                />
              ) : null}
            </div>
          )}
        </div>
      </FinanceGate>

      <FinanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateMovement}
      />
    </div>
  );
}
