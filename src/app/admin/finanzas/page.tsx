"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import FinanceGate from "@/components/admin/FinanceGate";
import { useAuth } from "@/components/auth/useAuth";
import FinanceTabs from "@/components/finance/FinanceTabs";
import FinanceHeroCard from "@/components/finance/FinanceHeroCard";
import FinanceKpiCard from "@/components/finance/FinanceKpiCard";
import FinanceFilterBar from "@/components/finance/FinanceFilterBar";
import FinanceTable from "@/components/finance/FinanceTable";
import FinancePendingList from "@/components/finance/FinancePendingList";
import FinanceModal, {
  type CollaboratorFormValues,
  type CollaboratorPaymentFormValues,
  type ExpenseFormValues,
  type IncomeFormValues,
  type TransferFormValues,
} from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import { calcKpis, filterMovements } from "@/lib/finance/analytics";
import { getMonthKey, getMonthLabel } from "@/lib/finance/utils";
import type {
  FinanceFilters,
  FinanceModalType,
  FinanceMovement,
  FinanceStatus,
  FinanceTabKey,
} from "@/lib/finance/types";
import {
  createCollaborator,
  createCollaboratorPayment,
  createExpense,
  createIncomeMovement,
  createTransfer,
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
  const [modalType, setModalType] = useState<FinanceModalType>("income");
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

  const openModal = (type: FinanceModalType) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleCreateMovement = (type: FinanceModalType, values: unknown) => {
    if (type === "income") {
      const payload = values as IncomeFormValues;
      const movement = createIncomeMovement({
        clientName: payload.clientName,
        projectService: payload.projectService,
        amount: payload.amount,
        incomeDate: new Date(payload.incomeDate).toISOString(),
        expectedPayDate: payload.expectedPayDate ? new Date(payload.expectedPayDate).toISOString() : null,
        accountDestination: payload.accountDestination,
        responsible: payload.responsible,
        status: payload.status,
        reference: payload.reference,
        notes: payload.notes,
      });
      setMovements([movement, ...listFinanceMovements()]);
      setToast("Ingreso creado");
    }

    if (type === "collaborator") {
      const payload = values as CollaboratorFormValues;
      createCollaborator({
        nombreCompleto: payload.nombreCompleto,
        rolPuesto: payload.rolPuesto,
        tipoPago: payload.tipoPago,
        montoBase: payload.montoBase,
        moneda: payload.moneda,
        cuentaPagoPreferida: payload.cuentaPagoPreferida,
        diaPago: payload.diaPago === "" ? null : payload.diaPago,
        fechaPago: payload.fechaPago ? new Date(payload.fechaPago).toISOString() : null,
        inicioContrato: new Date(payload.inicioContrato).toISOString(),
        finContrato: payload.finContrato ? new Date(payload.finContrato).toISOString() : null,
        activo: payload.activo,
        notas: payload.notas,
      });
      setToast("Colaborador creado");
    }

    if (type === "collaborator_payment") {
      const payload = values as CollaboratorPaymentFormValues;
      createCollaboratorPayment({
        colaboradorId: payload.colaboradorId,
        periodo: payload.periodo,
        montoBase: payload.montoBase,
        bono: payload.bono,
        descuento: payload.descuento,
        devolucion: payload.devolucion,
        montoFinal: payload.montoFinal,
        fechaPago: new Date(payload.fechaPago).toISOString(),
        cuentaOrigen: payload.cuentaOrigen,
        estado: payload.estado,
        referencia: payload.referencia,
        notas: payload.notas,
      });
      setToast("Pago registrado");
    }

    if (type === "expense") {
      const payload = values as ExpenseFormValues;
      createExpense({
        tipoGasto: payload.tipoGasto,
        categoria: payload.categoria,
        descripcion: payload.descripcion,
        monto: payload.monto,
        fechaGasto: new Date(payload.fechaGasto).toISOString(),
        cuentaOrigen: payload.cuentaOrigen,
        responsable: payload.responsable,
        estado: payload.estado,
        requiereDevolucion: payload.requiereDevolucion,
        devolucionMonto: payload.requiereDevolucion ? payload.devolucionMonto : null,
        referencia: payload.referencia,
        notas: payload.notas,
      });
      setToast("Gasto creado");
    }

    if (type === "transfer") {
      const payload = values as TransferFormValues;
      const isTransfer = payload.tipoMovimiento === "TRANSFERENCIA";
      createTransfer({
        tipoMovimiento: payload.tipoMovimiento,
        cuentaOrigen:
          isTransfer || payload.tipoMovimiento === "SALIDA_CAJA" ? payload.cuentaOrigen || null : null,
        cuentaDestino:
          isTransfer || payload.tipoMovimiento === "INGRESO_CAJA" ? payload.cuentaDestino || null : null,
        monto: payload.monto,
        fecha: new Date(payload.fecha).toISOString(),
        responsable: payload.responsable,
        referencia: payload.referencia,
        notas: payload.notas,
      });
      setToast("Movimiento creado");
    }

    setIsModalOpen(false);
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
      <PageHeader userName={user?.displayName ?? user?.email ?? undefined} />
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
            <div className="flex flex-wrap items-center gap-2">
              {activeTab === "pagos" ? (
                <button
                  type="button"
                  onClick={() => openModal("collaborator")}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Nuevo colaborador
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  openModal(
                    activeTab === "gastos"
                      ? "expense"
                      : activeTab === "cuentas"
                        ? "transfer"
                        : activeTab === "pagos"
                          ? "collaborator_payment"
                          : "income",
                  )
                }
                className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
              >
                {activeTab === "gastos"
                  ? "Nuevo gasto"
                  : activeTab === "cuentas"
                    ? "Transferencia / Movimiento"
                    : activeTab === "pagos"
                      ? "Registrar pago"
                      : "Nuevo ingreso"}
              </button>
            </div>
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
        modalType={modalType}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateMovement}
      />
    </div>
  );
}
