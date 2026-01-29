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
import FinanceStatusSelect from "@/components/finance/FinanceStatusSelect";
import FinanceModal, {
  type CollaboratorFormValues,
  type CollaboratorPaymentFormValues,
  type ExpenseFormValues,
  type IncomeFormValues,
  type TransferFormValues,
} from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import { calcKpis, filterMovements } from "@/lib/finance/analytics";
import { financeRefs } from "@/lib/finance/refs";
import {
  formatDateOnly,
  formatMonthLabel,
  formatShortDate,
  formatCurrency,
  getMonthKey,
  getMonthKeyFromDate,
} from "@/lib/finance/utils";
import type {
  Collaborator,
  CollaboratorPayment,
  Expense,
  FinanceFilters,
  FinanceModalType,
  FinanceMovement,
  FinanceStatus,
  FinanceTabKey,
  TransferMovement,
} from "@/lib/finance/types";
import {
  createCollaborator,
  createCollaboratorPayment,
  createExpense,
  createIncomeMovement,
  createTransfer,
  deleteFinanceMovement,
  subscribeCollaboratorPayments,
  subscribeCollaborators,
  subscribeExpenses,
  subscribeFinanceMovements,
  subscribeTransfers,
  updateCollaboratorPaymentStatus,
  updateExpenseStatus,
  updateFinanceMovementStatus,
  updateIncomeMovement,
  updateTransferStatus,
} from "@/services/finance";
import { db } from "@/services/firebase/client";

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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<CollaboratorPayment[]>([]);
  const [transfers, setTransfers] = useState<TransferMovement[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<FinanceModalType>("income");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingMovement, setEditingMovement] = useState<FinanceMovement | null>(null);

  const [filters, setFilters] = useState<FinanceFilters>({
    monthKey: getMonthKey(new Date()),
    status: "all",
    account: "all",
    category: "all",
    includeCancelled: false,
  });

  useEffect(() => {
    let movementsLoaded = false;
    let expensesLoaded = false;
    let paymentsLoaded = false;
    let transfersLoaded = false;
    let collaboratorsLoaded = false;

    const markLoaded = () => {
      if (
        movementsLoaded &&
        expensesLoaded &&
        paymentsLoaded &&
        transfersLoaded &&
        collaboratorsLoaded
      ) {
        setIsLoading(false);
      }
    };

    const unsubscribeMovements = subscribeFinanceMovements((items) => {
      setMovements(items);
      if (!movementsLoaded) {
        movementsLoaded = true;
        markLoaded();
      }
    });
    const unsubscribeExpenses = subscribeExpenses((items) => {
      setExpenses(items);
      if (!expensesLoaded) {
        expensesLoaded = true;
        markLoaded();
      }
    });
    const unsubscribePayments = subscribeCollaboratorPayments((items) => {
      setPayments(items);
      if (!paymentsLoaded) {
        paymentsLoaded = true;
        markLoaded();
      }
    });
    const unsubscribeTransfers = subscribeTransfers((items) => {
      setTransfers(items);
      if (!transfersLoaded) {
        transfersLoaded = true;
        markLoaded();
      }
    });
    const unsubscribeCollaborators = subscribeCollaborators((items) => {
      setCollaborators(items);
      if (!collaboratorsLoaded) {
        collaboratorsLoaded = true;
        markLoaded();
      }
    });

    return () => {
      unsubscribeMovements();
      unsubscribeExpenses();
      unsubscribePayments();
      unsubscribeTransfers();
      unsubscribeCollaborators();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "movimientos" && activeTab !== "gastos") return;
    console.log("[FINANCE] projectId:", db.app.options.projectId);
    console.log("[FINANCE] income collection path:", financeRefs.incomesRef.path);
    console.log("[FINANCE] expense collection path:", financeRefs.expensesRef.path);
  }, [activeTab]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const filteredMovements = useMemo(() => filterMovements(movements, filters), [movements, filters]);
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const monthKey = getMonthKeyFromDate(expense.fechaGasto);
      if (monthKey && monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && expense.status === "cancelled") return false;
      if (filters.status !== "all" && expense.status !== filters.status) return false;
      if (filters.account !== "all" && expense.cuentaOrigen !== filters.account) return false;
      return true;
    });
  }, [expenses, filters]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const monthKey = getMonthKeyFromDate(payment.fechaPago);
      if (monthKey && monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && payment.status === "cancelled") return false;
      if (filters.status !== "all" && payment.status !== filters.status) return false;
      if (filters.account !== "all" && payment.cuentaOrigen !== filters.account) return false;
      return true;
    });
  }, [filters, payments]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      const monthKey = getMonthKeyFromDate(transfer.fecha);
      if (monthKey && monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && transfer.status === "cancelled") return false;
      if (filters.status !== "all" && transfer.status !== filters.status) return false;
      if (
        filters.account !== "all" &&
        transfer.cuentaOrigen !== filters.account &&
        transfer.cuentaDestino !== filters.account
      ) {
        return false;
      }
      return true;
    });
  }, [filters, transfers]);

  const collaboratorLookup = useMemo(() => {
    return new Map(collaborators.map((collaborator) => [collaborator.id, collaborator.nombreCompleto]));
  }, [collaborators]);

  const kpis = useMemo(
    () => calcKpis(movements, filters.monthKey, filters.includeCancelled),
    [filters.includeCancelled, filters.monthKey, movements],
  );

  const monthSummary = useMemo(() => {
    const monthMovements = movements.filter((movement) => {
      if (movement.monthKey !== filters.monthKey) return false;
      if (!filters.includeCancelled && movement.status === "cancelled") return false;
      return true;
    });
    const total = monthMovements.reduce(
      (sum, movement) => sum + (movement.tax?.total ?? movement.amount),
      0
    );
    const igv = monthMovements.reduce((sum, movement) => sum + (movement.tax?.igv ?? 0), 0);
    const net = total - igv;
    const paid = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status === "paid" ? movement.tax?.total ?? movement.amount : 0),
      0
    );
    const pending = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status === "pending" ? movement.tax?.total ?? movement.amount : 0),
      0
    );
    return { total, paid, pending, igv, net };
  }, [filters.includeCancelled, filters.monthKey, movements]);

  const monthSummary = useMemo(() => {
    const monthMovements = movements.filter((movement) => movement.monthKey === filters.monthKey);
    const total = monthMovements.reduce(
      (sum, movement) => sum + (movement.tax?.total ?? movement.amount),
      0
    );
    const igv = monthMovements.reduce((sum, movement) => sum + (movement.tax?.igv ?? 0), 0);
    const net = total - igv;
    const paid = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status === "CANCELADO" ? movement.tax?.total ?? movement.amount : 0),
      0
    );
    const pending = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status === "PENDIENTE" ? movement.tax?.total ?? movement.amount : 0),
      0
    );
    return { total, paid, pending, igv, net };
  }, [filters.monthKey, movements]);

  const openModal = (type: FinanceModalType) => {
    setModalType(type);
    setIsModalOpen(true);
    setIsSubmitting(false);
    setEditingMovement(null);
  };

  const handleCreateMovement = async (type: FinanceModalType, values: unknown) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (type === "income") {
        const payload = values as IncomeFormValues;
        const rate = Math.max(0, payload.taxRate) / 100;
        const amount = Math.max(0, payload.amount);
        const taxEnabled = payload.taxEnabled;
        let base = amount;
        let igv = 0;
        let total = amount;
        if (taxEnabled && rate > 0) {
          if (payload.taxMode === "inclusive") {
            base = amount / (1 + rate);
            igv = amount - base;
            total = amount;
          } else {
            base = amount;
            igv = amount * rate;
            total = amount + igv;
          }
        }
        const incomePayload = {
          clientName: payload.clientName,
          projectService: payload.projectService,
          amount,
          incomeDate: payload.incomeDate,
          expectedPayDate: payload.expectedPayDate || null,
          accountDestination: payload.accountDestination,
          status: payload.status,
          reference: payload.reference,
          notes: payload.notes,
          tax: {
            enabled: payload.taxEnabled,
            rate: payload.taxRate,
            mode: payload.taxMode,
            base,
            igv,
            total,
          },
          recurring: {
            enabled: payload.recurringEnabled,
            freq: payload.recurringFreq,
            dayOfMonth: payload.recurringFreq === "monthly" ? payload.recurringDayOfMonth : null,
            startAt: payload.recurringStartAt || null,
            endAt: payload.recurringEndAt || null,
          },
        };
        if (editingMovement) {
          await updateIncomeMovement(editingMovement.id, incomePayload);
          setToast("Ingreso actualizado");
        } else {
          await createIncomeMovement(incomePayload);
          setToast("Ingreso creado");
        }
      }

      if (type === "collaborator") {
        const payload = values as CollaboratorFormValues;
        await createCollaborator({
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
        await createCollaboratorPayment({
          colaboradorId: payload.colaboradorId,
          periodo: payload.periodo,
          montoBase: payload.montoBase,
          bono: payload.bono,
          descuento: payload.descuento,
          devolucion: payload.devolucion,
          montoFinal: payload.montoFinal,
          fechaPago: payload.fechaPago,
          cuentaOrigen: payload.cuentaOrigen,
          status: payload.status,
          referencia: payload.referencia,
          notas: payload.notas,
        });
        setToast("Pago registrado");
      }

      if (type === "expense") {
        const payload = values as ExpenseFormValues;
        await createExpense({
          tipoGasto: payload.tipoGasto,
          categoria: payload.categoria,
          descripcion: payload.descripcion,
          monto: payload.monto,
          fechaGasto: payload.fechaGasto,
          cuentaOrigen: payload.cuentaOrigen,
          status: payload.status,
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
        await createTransfer({
          tipoMovimiento: payload.tipoMovimiento,
          cuentaOrigen:
            isTransfer || payload.tipoMovimiento === "SALIDA_CAJA" ? payload.cuentaOrigen || null : null,
          cuentaDestino:
            isTransfer || payload.tipoMovimiento === "INGRESO_CAJA" ? payload.cuentaDestino || null : null,
          monto: payload.monto,
          fecha: payload.fecha,
          status: payload.status,
          referencia: payload.referencia,
          notas: payload.notas,
        });
        setToast("Movimiento creado");
      }
      setIsModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditMovement = (movement: FinanceMovement) => {
    setEditingMovement(movement);
    setModalType("income");
    setIsModalOpen(true);
  };

  const incomeInitialValues: Partial<IncomeFormValues> | null = editingMovement
    ? {
        clientName: editingMovement.clientName,
        projectService: editingMovement.projectService ?? "",
        amount:
          editingMovement.tax?.enabled && editingMovement.tax.mode === "exclusive"
            ? editingMovement.tax.base
            : editingMovement.tax?.total ?? editingMovement.amount,
        incomeDate: formatDateOnly(editingMovement.incomeDate) ?? editingMovement.incomeDate,
        expectedPayDate: formatDateOnly(editingMovement.expectedPayDate) ?? "",
        accountDestination: editingMovement.accountDestination,
        status: editingMovement.status,
        reference: editingMovement.reference ?? "",
        notes: editingMovement.notes ?? "",
        taxEnabled: editingMovement.tax?.enabled ?? false,
        taxRate: editingMovement.tax?.rate ?? 18,
        taxMode: editingMovement.tax?.mode ?? "exclusive",
        recurringEnabled: editingMovement.recurring?.enabled ?? false,
        recurringFreq: editingMovement.recurring?.freq ?? "monthly",
        recurringDayOfMonth: editingMovement.recurring?.dayOfMonth ?? 1,
        recurringStartAt: formatDateOnly(editingMovement.recurring?.startAt) ?? "",
        recurringEndAt: formatDateOnly(editingMovement.recurring?.endAt) ?? "",
      }
    : null;

  const handleStatusChange = async (id: string, status: FinanceStatus) => {
    await updateFinanceMovementStatus(id, status);
    setToast("Estado actualizado");
  };

  const handleExpenseStatusChange = async (id: string, status: FinanceStatus) => {
    await updateExpenseStatus(id, status);
    setToast("Estado actualizado");
  };

  const handleTransferStatusChange = async (id: string, status: FinanceStatus) => {
    await updateTransferStatus(id, status);
    setToast("Estado actualizado");
  };

  const handlePaymentStatusChange = async (id: string, status: FinanceStatus) => {
    await updateCollaboratorPaymentStatus(id, status);
    setToast("Estado actualizado");
  };

  const handleDeleteMovement = async (id: string) => {
    await deleteFinanceMovement(id);
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
                {formatMonthLabel(filters.monthKey)} · Control mensual de ingresos.
              </p>
              {process.env.NODE_ENV === "development" && db.app.options.projectId ? (
                <p className="text-xs text-slate-400">
                  Firebase Project: {db.app.options.projectId}
                </p>
              ) : null}
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
                    items={filteredMovements.filter((movement) => movement.status === "pending")}
                    emptyLabel="Sin pendientes."
                  />
                </>
              ) : null}

              {activeTab === "movimientos" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <FinanceKpiCard title="Total" value={monthSummary.total} tone="slate" />
                    <FinanceKpiCard title="Cobrado" value={monthSummary.paid} tone="green" />
                    <FinanceKpiCard title="Pendiente" value={monthSummary.pending} tone="amber" />
                    <FinanceKpiCard title="IGV" value={monthSummary.igv} tone="blue" />
                    <FinanceKpiCard title="Neto" value={monthSummary.net} tone="rose" />
                  </div>
                  <FinanceTable
                    movements={filteredMovements}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDeleteMovement}
                    onEdit={handleEditMovement}
                    disabled={isSubmitting}
                  />
                </>
              ) : null}

              {activeTab === "gastos" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(expense.fechaGasto)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{expense.descripcion}</p>
                            <p className="text-xs text-slate-500">{expense.referencia ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{expense.categoria}</td>
                          <td className="px-4 py-3">
                            <FinanceStatusSelect
                              status={expense.status}
                              onChange={(status) => handleExpenseStatusChange(expense.id, status)}
                              disabled={isSubmitting}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(expense.monto)}
                          </td>
                        </tr>
                      ))}
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin gastos registrados en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeTab === "pagos" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3">Periodo</th>
                        <th className="px-4 py-3">Cuenta</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((payment) => (
                        <tr key={payment.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(payment.fechaPago)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">
                              {collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador"}
                            </p>
                            <p className="text-xs text-slate-500">{payment.referencia ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{payment.periodo}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{payment.cuentaOrigen}</td>
                          <td className="px-4 py-3">
                            <FinanceStatusSelect
                              status={payment.status}
                              onChange={(status) => handlePaymentStatusChange(payment.id, status)}
                              disabled={isSubmitting}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(payment.montoFinal)}
                          </td>
                        </tr>
                      ))}
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin pagos registrados en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {activeTab === "cuentas" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Cuenta origen</th>
                        <th className="px-4 py-3">Cuenta destino</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransfers.map((transfer) => (
                        <tr key={transfer.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(transfer.fecha)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.tipoMovimiento}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.cuentaOrigen ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.cuentaDestino ?? "—"}</td>
                          <td className="px-4 py-3">
                            <FinanceStatusSelect
                              status={transfer.status}
                              onChange={(status) => handleTransferStatusChange(transfer.id, status)}
                              disabled={isSubmitting}
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(transfer.monto)}
                          </td>
                        </tr>
                      ))}
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin transferencias registradas en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </FinanceGate>

      <FinanceModal
        isOpen={isModalOpen}
        modalType={modalType}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMovement(null);
        }}
        onSubmit={handleCreateMovement}
        disabled={isSubmitting}
        initialValues={incomeInitialValues}
      />
    </div>
  );
}
