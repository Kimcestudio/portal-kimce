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
import {
  calcKpis,
  computeAlerts,
  computeHistoricalTotals,
  computeMonthProjection,
  computeMonthlySeries,
  filterMovements,
} from "@/lib/finance/analytics";
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
import { onSnapshot, orderBy, query } from "firebase/firestore";
import {
  createCollaborator,
  createCollaboratorPayment,
  createExpense,
  createIncomeMovement,
  createTransfer,
  deleteFinanceMovement,
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
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [editingMovement, setEditingMovement] = useState<FinanceMovement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<
    "summary" | "income" | "expenses" | "payments" | "accounts"
  >("summary");
  const [isAnnualView, setIsAnnualView] = useState(false);

  const logDev = (...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log(...args);
    }
  };

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
        setIsLoading((prev) => {
          if (prev) logDev("[FINANCE] loading complete");
          return false;
        });
      }
    };

    const handleSnapshotError = (label: string, error: { code?: string }) => {
      // eslint-disable-next-line no-console
      console.error(`[FINANCE] ${label} snapshot error`, error.code ?? error);
      if (process.env.NODE_ENV === "development") {
        setToast({ message: `No tienes permisos para ver ${label}.`, tone: "error" });
      }
    };

    const movementsQuery = query(financeRefs.incomesRef, orderBy("createdAt", "desc"));
    const unsubscribeMovements = onSnapshot(
      movementsQuery,
      (snapshot) => {
        const normalized = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as FinanceMovement;
          return {
            ...data,
            id: doc.id,
            monthKey:
              data.monthKey ?? getMonthKeyFromDate(data.incomeDate) ?? getMonthKey(new Date()),
          };
        });
        setMovements(normalized);
        logDev("[FINANCE] movements snapshot", normalized.length);
        if (!movementsLoaded) {
          movementsLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("movimientos", error);
        movementsLoaded = true;
        markLoaded();
      },
    );

    const expensesQuery = query(financeRefs.expensesRef, orderBy("createdAt", "desc"));
    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as Expense;
          return {
            ...data,
            id: doc.id,
          };
        });
        setExpenses(items);
        logDev("[FINANCE] expenses snapshot", items.length);
        if (!expensesLoaded) {
          expensesLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("gastos", error);
        expensesLoaded = true;
        markLoaded();
      },
    );

    const paymentsQuery = query(financeRefs.collaboratorPaymentsRef, orderBy("createdAt", "desc"));
    const unsubscribePayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as CollaboratorPayment;
          return {
            ...data,
            id: doc.id,
          };
        });
        setPayments(items);
        logDev("[FINANCE] payments snapshot", items.length);
        if (!paymentsLoaded) {
          paymentsLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("pagos", error);
        paymentsLoaded = true;
        markLoaded();
      },
    );

    const transfersQuery = query(financeRefs.transfersRef, orderBy("createdAt", "desc"));
    const unsubscribeTransfers = onSnapshot(
      transfersQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as TransferMovement;
          return {
            ...data,
            id: doc.id,
          };
        });
        setTransfers(items);
        logDev("[FINANCE] transfers snapshot", items.length);
        if (!transfersLoaded) {
          transfersLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("transferencias", error);
        transfersLoaded = true;
        markLoaded();
      },
    );

    const collaboratorsQuery = query(financeRefs.collaboratorsRef, orderBy("createdAt", "desc"));
    const unsubscribeCollaborators = onSnapshot(
      collaboratorsQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => {
          const { id: _ignored, ...data } = doc.data() as Collaborator;
          return {
            ...data,
            id: doc.id,
          };
        });
        setCollaborators(items);
        logDev("[FINANCE] collaborators snapshot", items.length);
        if (!collaboratorsLoaded) {
          collaboratorsLoaded = true;
        }
        markLoaded();
      },
      (error) => {
        handleSnapshotError("colaboradores", error);
        collaboratorsLoaded = true;
        markLoaded();
      },
    );

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
    () => calcKpis(movements, expenses, filters.monthKey, filters.includeCancelled, filters.account),
    [expenses, filters.account, filters.includeCancelled, filters.monthKey, movements],
  );

  const projection = useMemo(
    () => computeMonthProjection(movements, expenses, filters.monthKey, filters.account),
    [expenses, filters.account, filters.monthKey, movements],
  );

  const historicalTotals = useMemo(
    () => computeHistoricalTotals(movements, expenses, filters.account),
    [expenses, filters.account, movements],
  );

  const monthlySeries = useMemo(
    () => computeMonthlySeries(movements, expenses, filters.monthKey, 12, filters.account),
    [expenses, filters.account, filters.monthKey, movements],
  );

  const annualSeries = useMemo(() => {
    const [yearPart] = filters.monthKey.split("-");
    return computeMonthlySeries(movements, expenses, `${yearPart}-12`, 12, filters.account);
  }, [expenses, filters.account, filters.monthKey, movements]);

  const annualStats = useMemo(() => {
    if (annualSeries.length === 0) {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        net: 0,
        margin: 0,
        avgNet: 0,
        bestMonth: null as (typeof annualSeries)[number] | null,
        worstMonth: null as (typeof annualSeries)[number] | null,
      };
    }
    const totalIncome = annualSeries.reduce((sum, row) => sum + row.incomePaid + row.incomePending, 0);
    const totalExpenses = annualSeries.reduce((sum, row) => sum + row.expensesPaid + row.expensesPending, 0);
    const net = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (net / totalIncome) * 100 : 0;
    const bestMonth = annualSeries.reduce(
      (best, row) => (best && best.net > row.net ? best : row),
      annualSeries[0],
    );
    const worstMonth = annualSeries.reduce(
      (worst, row) => (worst && worst.net < row.net ? worst : row),
      annualSeries[0],
    );
    const avgNet = annualSeries.length > 0 ? net / annualSeries.length : 0;
    return { totalIncome, totalExpenses, net, margin, avgNet, bestMonth, worstMonth };
  }, [annualSeries]);

  const alerts = useMemo(() => {
    const bestMonthLabel = isAnnualView && annualStats.bestMonth
      ? formatMonthLabel(annualStats.bestMonth.monthKey)
      : null;
    return computeAlerts(
      {
        projectedIncome: projection.incomeProjected,
        projectedExpenses: projection.expensesProjected,
        projectedNet: projection.projectedNet,
        projectedMargin: projection.projectedMargin,
        incomePending: projection.incomePending,
      },
      { bestMonthLabel },
    );
  }, [annualStats.bestMonth, isAnnualView, projection]);

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
    const paid = 0;
    const pending = monthMovements.reduce(
      (sum, movement) =>
        sum + (movement.status === "pending" ? movement.tax?.total ?? movement.amount : 0),
      0
    );
    return { total, paid, pending, igv, net };
  }, [filters.includeCancelled, filters.monthKey, movements]);

  const detailTotals = useMemo(() => {
    const incomeTotal = filteredMovements.reduce(
      (sum, item) => sum + (item.tax?.total ?? item.amount),
      0,
    );
    const expenseTotal = filteredExpenses.reduce((sum, item) => sum + item.monto, 0);
    const paymentTotal = filteredPayments.reduce((sum, item) => sum + item.montoFinal, 0);
    const transferTotal = filteredTransfers.reduce((sum, item) => sum + item.monto, 0);
    return { incomeTotal, expenseTotal, paymentTotal, transferTotal };
  }, [filteredExpenses, filteredMovements, filteredPayments, filteredTransfers]);

  const openModal = (type: FinanceModalType) => {
    setModalType(type);
    setIsModalOpen(true);
    setIsSubmitting(false);
    setEditingMovement(null);
  };

  const handleCreateMovement = async (type: FinanceModalType, values: unknown) => {
    if (isSubmitting) return false;
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
          setToast({ message: "Ingreso actualizado", tone: "success" });
        } else {
          await createIncomeMovement(incomePayload);
          setToast({ message: "Ingreso creado", tone: "success" });
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
        setToast({ message: "Colaborador creado", tone: "success" });
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
        setToast({ message: "Pago registrado", tone: "success" });
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
        setToast({ message: "Gasto creado", tone: "success" });
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
        setToast({ message: "Movimiento creado", tone: "success" });
      }
      setEditingMovement(null);
      setIsModalOpen(false);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[FINANCE] save error", error);
      const message =
        error instanceof Error && error.message
          ? `Error al guardar: ${error.message}`
          : "Error inesperado al guardar.";
      setToast({ message, tone: "error" });
      return false;
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
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handleExpenseStatusChange = async (id: string, status: FinanceStatus) => {
    await updateExpenseStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handleTransferStatusChange = async (id: string, status: FinanceStatus) => {
    await updateTransferStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handlePaymentStatusChange = async (id: string, status: FinanceStatus) => {
    await updateCollaboratorPaymentStatus(id, status);
    setToast({ message: "Estado actualizado", tone: "success" });
  };

  const handleDeleteMovement = async (id: string) => {
    await deleteFinanceMovement(id);
    setToast({ message: "Movimiento eliminado", tone: "success" });
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
            <div
              className={`rounded-2xl border px-4 py-2 text-xs ${
                toast.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {toast.message}
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
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-500">
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${!isAnnualView ? "bg-white text-slate-900 shadow-sm" : ""}`}
                        onClick={() => setIsAnnualView(false)}
                      >
                        Mensual
                      </button>
                      <button
                        type="button"
                        className={`rounded-full px-3 py-1 ${isAnnualView ? "bg-white text-slate-900 shadow-sm" : ""}`}
                        onClick={() => setIsAnnualView(true)}
                      >
                        Anual
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailTab("summary");
                        setIsDetailOpen(true);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                    >
                      Ver detalle del mes
                    </button>
                  </div>
                  <FinanceHeroCard
                    monthKey={filters.monthKey}
                    incomePaid={kpis.incomePaid}
                    expensesPaid={kpis.expensesPaid}
                    netIncome={kpis.netIncome}
                    margin={kpis.margin}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Proyección del mes
                        </p>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                          Estimado
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-500">Ingresos proyectados</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {formatCurrency(projection.incomeProjected)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Gastos proyectados</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {formatCurrency(projection.expensesProjected)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Utilidad proyectada</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {formatCurrency(projection.projectedNet)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Margen proyectado</p>
                          <p className="text-lg font-semibold text-slate-900">
                            {projection.projectedMargin.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Real vs Proyectado
                      </p>
                      <div className="mt-4 space-y-3 text-sm">
                        {[
                          {
                            label: "Ingresos",
                            real: kpis.incomePaid,
                            projected: projection.incomeProjected,
                          },
                          {
                            label: "Gastos",
                            real: kpis.expensesPaid,
                            projected: projection.expensesProjected,
                          },
                          {
                            label: "Utilidad",
                            real: kpis.netIncome,
                            projected: projection.projectedNet,
                          },
                        ].map((row) => {
                          const delta = row.projected - row.real;
                          const percent = row.real !== 0 ? (delta / Math.abs(row.real)) * 100 : 0;
                          return (
                            <div key={row.label} className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-xs text-slate-500">{row.label}</p>
                                <p className="font-semibold text-slate-900">
                                  {formatCurrency(row.real)} → {formatCurrency(row.projected)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-slate-500">Δ</p>
                                <p className={`font-semibold ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {formatCurrency(delta)} ({percent.toFixed(1)}%)
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Acumulado histórico
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <FinanceKpiCard title="Ingresos históricos" value={historicalTotals.totalIncome} tone="blue" />
                      <FinanceKpiCard title="Gastos históricos" value={historicalTotals.totalExpenses} tone="rose" />
                      <FinanceKpiCard title="Utilidad acumulada" value={historicalTotals.net} tone="green" />
                      <div className="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          Margen promedio
                        </p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {historicalTotals.margin.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FinanceKpiCard title="Ingresos cobrados" value={kpis.incomePaid} tone="blue" />
                    <FinanceKpiCard title="Pendiente por cobrar" value={kpis.incomePending} tone="amber" />
                    <FinanceKpiCard title="Gastos pagados" value={kpis.expensesPaid} tone="rose" />
                    <FinanceKpiCard title="Utilidad neta" value={kpis.netIncome} tone="green" />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Mes a mes (últimos 12)
                      </p>
                      <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                            <tr>
                              <th className="px-2 py-2">Mes</th>
                              <th className="px-2 py-2 text-right">Ingresos cobrados</th>
                              <th className="px-2 py-2 text-right">Pendientes</th>
                              <th className="px-2 py-2 text-right">Gastos pagados</th>
                              <th className="px-2 py-2 text-right">Pendientes</th>
                              <th className="px-2 py-2 text-right">Utilidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlySeries.map((row) => (
                              <tr key={row.monthKey} className="border-t border-slate-100">
                                <td className="px-2 py-2 text-xs text-slate-500">
                                  {formatMonthLabel(row.monthKey)}
                                </td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.incomePaid)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.incomePending)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.expensesPaid)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(row.expensesPending)}</td>
                                <td className="px-2 py-2 text-right font-semibold text-slate-900">
                                  {formatCurrency(row.net)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Vista anual
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <FinanceKpiCard title="Total anual" value={annualStats.net} tone="green" />
                          <FinanceKpiCard title="Promedio mensual" value={annualStats.avgNet} tone="blue" />
                          <FinanceKpiCard
                            title="Mejor mes"
                            value={annualStats.bestMonth ? annualStats.bestMonth.net : 0}
                            tone="green"
                          />
                          <FinanceKpiCard
                            title="Peor mes"
                            value={annualStats.worstMonth ? annualStats.worstMonth.net : 0}
                            tone="rose"
                          />
                        </div>
                        {isAnnualView ? (
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                  <th className="px-2 py-2">Mes</th>
                                  <th className="px-2 py-2 text-right">Ingresos</th>
                                  <th className="px-2 py-2 text-right">Gastos</th>
                                  <th className="px-2 py-2 text-right">Utilidad</th>
                                  <th className="px-2 py-2 text-right">Margen</th>
                                </tr>
                              </thead>
                              <tbody>
                                {annualSeries.map((row) => {
                                  const totalIncome = row.incomePaid + row.incomePending;
                                  const totalExpenses = row.expensesPaid + row.expensesPending;
                                  const margin = totalIncome > 0 ? (row.net / totalIncome) * 100 : 0;
                                  return (
                                    <tr key={row.monthKey} className="border-t border-slate-100">
                                      <td className="px-2 py-2 text-xs text-slate-500">
                                        {formatMonthLabel(row.monthKey)}
                                      </td>
                                      <td className="px-2 py-2 text-right">
                                        {formatCurrency(totalIncome)}
                                      </td>
                                      <td className="px-2 py-2 text-right">
                                        {formatCurrency(totalExpenses)}
                                      </td>
                                      <td className="px-2 py-2 text-right font-semibold text-slate-900">
                                        {formatCurrency(row.net)}
                                      </td>
                                      <td className="px-2 py-2 text-right">{margin.toFixed(1)}%</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Insights & alertas
                        </p>
                        <ul className="mt-3 space-y-2 text-sm">
                          {alerts.length === 0 ? (
                            <li className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                              Sin alertas por ahora.
                            </li>
                          ) : (
                            alerts.map((alert, index) => (
                              <li
                                key={`${alert.message}-${index}`}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                                  alert.tone === "danger"
                                    ? "bg-rose-50 text-rose-700"
                                    : alert.tone === "warning"
                                      ? "bg-amber-50 text-amber-700"
                                      : "bg-sky-50 text-sky-700"
                                }`}
                              >
                                {alert.message}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    </div>
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

      {isDetailOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Desglose del mes · {formatMonthLabel(filters.monthKey)}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">Detalle financiero</h2>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                onClick={() => setIsDetailOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
              {[
                { key: "summary", label: "Resumen" },
                { key: "income", label: "Ingresos" },
                { key: "expenses", label: "Gastos" },
                { key: "payments", label: "Pagos a colaboradores" },
                { key: "accounts", label: "Cuentas & Caja" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDetailTab(tab.key as typeof detailTab)}
                  className={`rounded-full px-3 py-1 ${
                    detailTab === tab.key ? "bg-slate-900 text-white" : "bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-4">
              {detailTab === "summary" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FinanceKpiCard title="Ingresos del mes" value={detailTotals.incomeTotal} tone="blue" />
                    <FinanceKpiCard title="Gastos del mes" value={detailTotals.expenseTotal} tone="rose" />
                    <FinanceKpiCard title="Pagos a colaboradores" value={detailTotals.paymentTotal} tone="amber" />
                    <FinanceKpiCard title="Movimientos caja" value={detailTotals.transferTotal} tone="slate" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">KPI del mes</p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Ingresos cobrados</span>
                          <span className="font-semibold">{formatCurrency(kpis.incomePaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Gastos pagados</span>
                          <span className="font-semibold">{formatCurrency(kpis.expensesPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Utilidad neta</span>
                          <span className="font-semibold">{formatCurrency(kpis.netIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Margen neto</span>
                          <span className="font-semibold">{kpis.margin.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Proyección del mes
                      </p>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span>Ingresos proyectados</span>
                          <span className="font-semibold">{formatCurrency(projection.incomeProjected)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Gastos proyectados</span>
                          <span className="font-semibold">{formatCurrency(projection.expensesProjected)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Utilidad proyectada</span>
                          <span className="font-semibold">{formatCurrency(projection.projectedNet)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Margen proyectado</span>
                          <span className="font-semibold">{projection.projectedMargin.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              {detailTab === "income" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map((movement) => (
                        <tr key={movement.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {formatShortDate(movement.incomeDate)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{movement.clientName}</p>
                            <p className="text-xs text-slate-500">{movement.projectService ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{movement.status}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(movement.tax?.total ?? movement.amount)}
                          </td>
                        </tr>
                      ))}
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin ingresos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "expenses" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Descripción</th>
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
                          <td className="px-4 py-3 text-xs text-slate-500">{expense.status}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(expense.monto)}
                          </td>
                        </tr>
                      ))}
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin gastos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "payments" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Colaborador</th>
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
                              {collaboratorLookup.get(payment.colaboradorId) ?? "—"}
                            </p>
                            <p className="text-xs text-slate-500">{payment.periodo}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{payment.status}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(payment.montoFinal)}
                          </td>
                        </tr>
                      ))}
                      {filteredPayments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin pagos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {detailTab === "accounts" ? (
                <div className="rounded-2xl border border-slate-200/60 bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Tipo</th>
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
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {transfer.tipoMovimiento}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{transfer.status}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(transfer.monto)}
                          </td>
                        </tr>
                      ))}
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                            Sin movimientos en este mes.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <FinanceModal
        isOpen={isModalOpen}
        modalType={modalType}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMovement(null);
        }}
        onSubmit={handleCreateMovement}
        disabled={isSubmitting}
        isSubmitting={isSubmitting}
        initialValues={incomeInitialValues}
      />
    </div>
  );
}
