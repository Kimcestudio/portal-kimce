"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import FinanceGate from "@/components/admin/FinanceGate";
import { useAuth } from "@/components/auth/AuthProvider";
import FinanceHeroCard from "@/components/finance/FinanceHeroCard";
import FinanceKpiCard from "@/components/finance/FinanceKpiCard";
import CopyPreviousMonthModal from "@/components/finance/CopyPreviousMonthModal";
import FinancePendingList from "@/components/finance/FinancePendingList";
import FinanceMonthlyChart from "@/components/finance/FinanceMonthlyChart";
import FinanceModal, {
  type CollaboratorFormValues,
  type CollaboratorPaymentFormValues,
  type ExpenseFormValues,
  type IncomeFormValues,
  type TransferFormValues,
} from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import {
  AccountsTab,
  ExpensesTab,
  FinanceFiltersBar,
  FinanceTabs,
  MovementsTab,
  PaymentsTab,
} from "@/modules/finanzas";
import Card from "@/components/ui/Card";
import {
  calcKpis,
  computeAlerts,
  computeCashFlow,
  getMonthlyProjection,
  getMonthlyStatusMetrics,
  computeMonthlySeries,
  computeYearToDateTotals,
  filterMovements,
} from "@/lib/finance/analytics";
import { financeRefs } from "@/lib/finance/refs";
import {
  formatDateOnly,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  getStatusLabel,
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
import { collection, doc, onSnapshot, orderBy, query, updateDoc, type DocumentData } from "firebase/firestore";
import {
  createCollaboratorPayment,
  createExpense,
  createIncomeMovement,
  createTransfer,
  deleteCollaboratorPayment,
  deleteExpense,
  deleteFinanceMovement,
  deleteTransfer,
  updateCollaboratorActive,
  deleteCollaborator,
  updateCollaboratorPayment,
  updateCollaboratorPaymentStatus,
  updateExpense,
  updateExpenseStatus,
  updateFinanceMovementStatus,
  updateIncomeMovement,
  updateTransfer,
  updateTransferStatus,
  getPreviousMonthCopyCandidates,
  copyItemsFromPreviousMonth,
  ensureRecurringMovementsForMonth,
  materializeRecurringMovementById,
  upsertCollaborator,
} from "@/services/finance";
import { db } from "@/services/firebase/client";


const parsePaymentPeriodToMonthKey = (periodo?: string | null) => {
  if (!periodo) return null;
  const raw = periodo.trim();
  const slashMatch = raw.match(/^(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]);
    const year = Number(slashMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  const dashMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (dashMatch) {
    const year = Number(dashMatch[1]);
    const month = Number(dashMatch[2]);
    if (month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }

  return null;
};

const getLastDayOfMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const buildDateForMonth = (monthKey: string, preferredDay: number) => {
  const [yearPart, monthPart] = monthKey.split("-");
  const year = Number(yearPart);
  const month = Number(monthPart);
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  const lastDay = getLastDayOfMonth(year, month);
  const day = Math.max(1, Math.min(preferredDay, lastDay));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const monthInRange = (targetMonthKey: string, startDate?: string | null, endDate?: string | null) => {
  const startMonthKey = startDate ? getMonthKeyFromDate(startDate) : null;
  const endMonthKey = endDate ? getMonthKeyFromDate(endDate) : null;
  if (startMonthKey && targetMonthKey < startMonthKey) return false;
  if (endMonthKey && targetMonthKey > endMonthKey) return false;
  return true;
};

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
  const [users, setUsers] = useState<
    Array<{
      uid: string;
      displayName: string;
      email: string;
      position: string;
      area: string;
      documentId: string;
      phone: string;
      employmentStartDate: string;
      contractEndDate: string;
      contractIndefinite: boolean;
      isActive: boolean;
      active: boolean;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<FinanceModalType>("income");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [editingMovement, setEditingMovement] = useState<FinanceMovement | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingPayment, setEditingPayment] = useState<CollaboratorPayment | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<TransferMovement | null>(null);
  const [editingCollaborator, setEditingCollaborator] = useState<Collaborator | null>(null);
  const [isCollaboratorsModalOpen, setIsCollaboratorsModalOpen] = useState(false);
  const [collaboratorsFilter, setCollaboratorsFilter] = useState<"all" | "active" | "inactive">("active");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProjectionDetailOpen, setIsProjectionDetailOpen] = useState(false);
  const [isDetailModalProjectionOpen, setIsDetailModalProjectionOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isCopyingMonthData, setIsCopyingMonthData] = useState(false);
  const [copySourceData, setCopySourceData] = useState<{
    movements: FinanceMovement[];
    expenses: Expense[];
    payments: CollaboratorPayment[];
  }>({ movements: [], expenses: [], payments: [] });
  const materializingMonthsRef = useRef<Set<string>>(new Set());
  const [detailTab, setDetailTab] = useState<
    "summary" | "income" | "expenses" | "payments" | "accounts"
  >("summary");
  const [isAnnualView, setIsAnnualView] = useState(false);
  const [annualYear, setAnnualYear] = useState(() => new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

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
    includeCancelled: true,
  });

  useEffect(() => {
    const loadFallbackTimeout = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) {
          logDev("[FINANCE] loading fallback timeout reached");
          return false;
        }
        return prev;
      });
    }, 7000);

    let movementsLoaded = false;
    let expensesLoaded = false;
    let paymentsLoaded = false;
    let transfersLoaded = false;
    let collaboratorsLoaded = false;
    let usersLoaded = false;

    const markLoaded = () => {
      if (movementsLoaded && expensesLoaded && paymentsLoaded) {
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
            isActive: data.isActive ?? data.activo ?? true,
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

    const usersRef = collection(db, "users");
    const unsubscribeUsers = onSnapshot(
      usersRef,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as DocumentData;
          return {
            uid: data.uid ?? docSnap.id,
            displayName: data.displayName ?? "",
            email: data.email ?? "",
            position: data.position ?? "",
            area: data.area ?? "",
            documentId: data.documentId ?? data.document ?? "",
            phone: data.phone ?? "",
            employmentStartDate: data.employmentStartDate ?? "",
            contractEndDate: data.contractEndDate ?? "",
            contractIndefinite: data.contractIndefinite ?? false,
            isActive: data.isActive ?? data.active ?? true,
            active: data.active ?? data.isActive ?? true,
          };
        });
        setUsers(items);
      },
      (error) => {
        handleSnapshotError("usuarios", error);
      },
    );

    return () => {
      clearTimeout(loadFallbackTimeout);
      unsubscribeMovements();
      unsubscribeExpenses();
      unsubscribePayments();
      unsubscribeTransfers();
      unsubscribeCollaborators();
      unsubscribeUsers();
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
      const paymentPeriodMonthKey =
        parsePaymentPeriodToMonthKey(payment.periodo) ?? payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago);
      if (paymentPeriodMonthKey && paymentPeriodMonthKey !== filters.monthKey) return false;
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

  useEffect(() => {
    if (isLoading) return;
    const monthKey = filters.monthKey;
    if (!monthKey) return;
    if (materializingMonthsRef.current.has(monthKey)) return;

    const run = async () => {
      materializingMonthsRef.current.add(monthKey);
      try {
        await ensureRecurringMovementsForMonth(monthKey);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[FINANCE] recurring materialization error", error);
      } finally {
        materializingMonthsRef.current.delete(monthKey);
      }
    };

    void run();
  }, [filters.monthKey, isLoading]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const addYear = (monthKey?: string | null) => {
      if (!monthKey) return;
      const [yearPart] = monthKey.split("-");
      const year = Number(yearPart);
      if (!Number.isNaN(year)) {
        years.add(year);
      }
    };
    movements.forEach((movement) => addYear(movement.monthKey));
    expenses.forEach((expense) => addYear(expense.monthKey ?? getMonthKeyFromDate(expense.fechaGasto)));
    payments.forEach((payment) =>
      addYear(parsePaymentPeriodToMonthKey(payment.periodo) ?? payment.monthKey ?? getMonthKeyFromDate(payment.fechaPago)),
    );
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [expenses, movements, payments]);

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (!availableYears.includes(annualYear)) {
      setAnnualYear(availableYears[0]);
    }
  }, [annualYear, availableYears]);

  const collaboratorsForPayments = useMemo(() => {
    const profileById = new Map(collaborators.map((collaborator) => [collaborator.id, collaborator]));
    const mappedUsers = users.map((item) => {
      const profile = profileById.get(item.uid);
      const fallbackName = item.displayName || item.email || "Colaborador";
      return {
        id: item.uid,
        userId: item.uid,
        nombreCompleto: profile?.nombreCompleto ?? fallbackName,
        correo: profile?.correo ?? item.email ?? "",
        rolPuesto: profile?.rolPuesto ?? item.position ?? "",
        area: profile?.area ?? item.area ?? "",
        documento: profile?.documento ?? item.documentId ?? "",
        tipoPago: profile?.tipoPago ?? "MENSUAL",
        montoBase: profile?.montoBase ?? 0,
        moneda: profile?.moneda ?? "PEN",
        cuentaPagoPreferida: profile?.cuentaPagoPreferida ?? "LUIS",
        diaPago: profile?.diaPago ?? null,
        fechaPago: profile?.fechaPago ?? null,
        inicioContrato: item.employmentStartDate || profile?.inicioContrato || "",
        finContrato:
          item.contractIndefinite
            ? null
            : item.contractEndDate || profile?.finContrato || null,
        contratoIndefinido: item.contractIndefinite ?? profile?.contratoIndefinido ?? false,
        activo: item.isActive,
        isActive: item.isActive,
        notas: profile?.notas ?? "",
        createdAt: profile?.createdAt ?? "",
        updatedAt: profile?.updatedAt ?? "",
      } as Collaborator;
    });

    const legacyOnly = collaborators.filter((item) => !users.some((userItem) => userItem.uid === item.id));
    return [...mappedUsers, ...legacyOnly];
  }, [collaborators, users]);

  const collaboratorLookup = useMemo(() => {
    return new Map(collaboratorsForPayments.map((collaborator) => [collaborator.id, collaborator.nombreCompleto]));
  }, [collaboratorsForPayments]);

  const kpis = useMemo(
    () => calcKpis(movements, expenses, filters.monthKey, filters.includeCancelled, filters.account),
    [expenses, filters.account, filters.includeCancelled, filters.monthKey, movements],
  );

  const projection = useMemo(
    () => getMonthlyProjection(movements, expenses, payments, filters.monthKey),
    [expenses, filters.monthKey, movements, payments],
  );

  const monthlyStatusMetrics = useMemo(
    () => getMonthlyStatusMetrics(movements, expenses, payments, transfers, filters.monthKey),
    [expenses, filters.monthKey, movements, payments, transfers],
  );

  const selectedMonthInfo = useMemo(() => {
    const [yearPart, monthPart] = filters.monthKey.split("-");
    return {
      year: Number(yearPart),
      month: Number(monthPart),
    };
  }, [filters.monthKey]);

  const monthlySeries = useMemo(
    () => computeMonthlySeries(movements, expenses, payments, filters.monthKey, 12, filters.account),
    [expenses, filters.account, filters.monthKey, movements, payments],
  );

  const annualSeries = useMemo(
    () => {
      const endMonth = annualYear === currentYear ? currentMonth : 12;
      return computeMonthlySeries(
        movements,
        expenses,
        payments,
        `${annualYear}-${String(endMonth).padStart(2, "0")}`,
        endMonth,
        filters.account,
      );
    },
    [annualYear, currentMonth, currentYear, expenses, filters.account, movements, payments],
  );

  const ytdTotals = useMemo(() => {
    const year = isAnnualView ? annualYear : selectedMonthInfo.year;
    const endMonth =
      isAnnualView
        ? annualYear === currentYear
          ? currentMonth
          : 12
        : selectedMonthInfo.month;
    return computeYearToDateTotals(
      movements,
      expenses,
      payments,
      Number.isNaN(year) ? annualYear : year,
      Number.isNaN(endMonth) ? 12 : endMonth,
      filters.account,
    );
  }, [
    annualYear,
    currentMonth,
    currentYear,
    expenses,
    filters.account,
    isAnnualView,
    movements,
    payments,
    selectedMonthInfo.month,
    selectedMonthInfo.year,
  ]);

  const annualCashFlow = useMemo(
    () =>
      computeCashFlow({
        movements,
        expenses,
        payments,
        transfers,
        year: annualYear,
        account: filters.account,
      }),
    [annualYear, expenses, filters.account, movements, payments, transfers],
  );

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
    const totalIncome = annualSeries.reduce((sum, row) => sum + row.incomeTotal, 0);
    const totalExpenses = annualSeries.reduce((sum, row) => sum + row.expensesTotal, 0);
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

  const annualChartData = useMemo(() => {
    return annualSeries.map((row) => ({
      month: formatMonthLabel(row.monthKey),
      income: row.incomeTotal,
      expenses: row.expensesTotal,
      net: row.net,
    }));
  }, [annualSeries]);

  const actualExpenses = kpis.expensesPaid + projection.paymentsPaid;
  const actualNet = kpis.incomePaid - actualExpenses;
  const realVsProjectedRows = useMemo(
    () => [
      {
        label: "Ingresos",
        real: kpis.incomePaid,
        projected: projection.incomeProjected,
      },
      {
        label: "Egresos",
        real: actualExpenses,
        projected: projection.expensesProjected,
      },
      {
        label: "Utilidad",
        real: actualNet,
        projected: projection.projectedNet,
      },
    ],
    [
      actualExpenses,
      actualNet,
      kpis.incomePaid,
      projection.expensesProjected,
      projection.incomeProjected,
      projection.projectedNet,
    ],
  );

  const heroContent = useMemo(() => {
    if (isAnnualView) {
      return {
        title: `Estado del año – ${annualYear}`,
        incomeLabel: "Ingresos totales",
        expensesLabel: "Egresos totales",
        cashFlowLabel: "Flujo de caja anual",
        netLabel: "Utilidad anual",
        marginLabel: "Margen anual",
        incomePaid: annualStats.totalIncome,
        expensesPaid: annualStats.totalExpenses,
        cashFlow: annualCashFlow.net,
        netIncome: annualStats.net,
        margin: annualStats.margin,
      };
    }
    return {
      title: `Estado del mes – ${formatMonthLabel(filters.monthKey)}`,
      incomeLabel: "Ingresos cobrados",
      expensesLabel: "Gastos pagados",
      cashFlowLabel: "Flujo de caja",
      netLabel: "Utilidad neta",
      marginLabel: "Margen neto",
      incomePaid: monthlyStatusMetrics.incomePaid,
      expensesPaid: monthlyStatusMetrics.expensesPaid,
      cashFlow: monthlyStatusMetrics.cashFlow,
      netIncome: monthlyStatusMetrics.netIncome,
      margin: monthlyStatusMetrics.margin,
    };
  }, [
    annualCashFlow.net,
    annualStats.margin,
    annualStats.net,
    annualStats.totalExpenses,
    annualStats.totalIncome,
    annualYear,
    filters.monthKey,
    isAnnualView,
    monthlyStatusMetrics.cashFlow,
    monthlyStatusMetrics.expensesPaid,
    monthlyStatusMetrics.incomePaid,
    monthlyStatusMetrics.margin,
    monthlyStatusMetrics.netIncome,
  ]);

  const alerts = useMemo(() => {
    if (isAnnualView) return [];
    return computeAlerts({
      projectedIncome: projection.incomeProjected,
      projectedExpenses: projection.expensesProjected,
      projectedNet: projection.projectedNet,
      projectedMargin: projection.projectedMargin,
      incomePending: projection.incomePending,
    });
  }, [isAnnualView, projection]);

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

  const incomeSummary = useMemo(() => {
    const map = new Map<
      string,
      { clientName: string; status: FinanceStatus; total: number; count: number }
    >();
    filteredMovements.forEach((movement) => {
      const key = `${movement.clientName}-${movement.status}`;
      const current = map.get(key) ?? {
        clientName: movement.clientName,
        status: movement.status,
        total: 0,
        count: 0,
      };
      current.total += movement.tax?.total ?? movement.amount;
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredMovements]);

  const expenseSummary = useMemo(() => {
    const map = new Map<
      string,
      { categoria: Expense["categoria"]; status: FinanceStatus; total: number; count: number }
    >();
    filteredExpenses.forEach((expense) => {
      const key = `${expense.categoria}-${expense.status}`;
      const current = map.get(key) ?? {
        categoria: expense.categoria,
        status: expense.status,
        total: 0,
        count: 0,
      };
      current.total += expense.monto;
      current.count += 1;
      map.set(key, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredExpenses]);

  const paymentSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    filteredPayments.forEach((payment) => {
      const name = collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador";
      const current = map.get(name) ?? { name, total: 0, count: 0 };
      current.total += payment.montoFinal;
      current.count += 1;
      map.set(name, current);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [collaboratorLookup, filteredPayments]);

  const exportDetailCsv = () => {
    const rows: string[][] = [
      ["Tipo", "Nombre", "Estado", "Monto", "Fecha"],
    ];
    filteredMovements.forEach((movement) => {
      rows.push([
        "Ingreso",
        movement.clientName,
        movement.status,
        `${movement.tax?.total ?? movement.amount}`,
        movement.incomeDate,
      ]);
    });
    filteredExpenses.forEach((expense) => {
      rows.push([
        "Gasto",
        expense.categoria,
        expense.status,
        `${expense.monto}`,
        expense.fechaGasto,
      ]);
    });
    filteredPayments.forEach((payment) => {
      rows.push([
        "Pago colaborador",
        collaboratorLookup.get(payment.colaboradorId) ?? "Colaborador",
        payment.status,
        `${payment.montoFinal}`,
        payment.fechaPago,
      ]);
    });
    filteredTransfers.forEach((transfer) => {
      rows.push([
        "Transferencia",
        transfer.tipoMovimiento,
        transfer.status,
        `${transfer.monto}`,
        transfer.fecha,
      ]);
    });
    const csvContent = rows.map((row) => row.map((value) => `"${value}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `desglose-finanzas-${filters.monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenCopyPreviousMonth = async () => {
    try {
      const data = await getPreviousMonthCopyCandidates(filters.monthKey);
      setCopySourceData({ movements: data.movements, expenses: data.expenses, payments: data.payments });
      setIsCopyModalOpen(true);
    } catch (error) {
      setToast({ message: "No se pudo cargar el mes anterior", tone: "error" });
    }
  };

  const handleCopyPreviousMonth = async (payload: {
    movementIds: string[];
    expenseIds: string[];
    paymentIds: string[];
    keepStatus: boolean;
  }) => {
    try {
      setIsCopyingMonthData(true);
      const result = await copyItemsFromPreviousMonth({
        currentMonthKey: filters.monthKey,
        movementIds: payload.movementIds,
        expenseIds: payload.expenseIds,
        paymentIds: payload.paymentIds,
        keepStatus: payload.keepStatus,
      });
      setToast({
        message: `Copiados: Movimientos ${result.movements}, Gastos ${result.expenses}, Pagos ${result.payments}`,
        tone: "success",
      });
      setIsCopyModalOpen(false);
    } catch (error) {
      setToast({ message: "Error al copiar elementos", tone: "error" });
    } finally {
      setIsCopyingMonthData(false);
    }
  };

  const openModal = (type: FinanceModalType) => {
    setModalType(type);
    setIsModalOpen(true);
    setIsSubmitting(false);
    setEditingMovement(null);
    setEditingExpense(null);
    setEditingPayment(null);
    setEditingTransfer(null);
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
            monthsCount: payload.recurringMonthsCount,
          },
          recurrenceId:
            payload.recurringEnabled
              ? editingMovement?.recurrenceId ?? editingMovement?.id ?? crypto.randomUUID()
              : null,
          recurrenceSourceId: editingMovement?.recurrenceSourceId ?? null,
          generatedForMonthKey: editingMovement?.generatedForMonthKey ?? null,
        };
        if (editingMovement) {
          await updateIncomeMovement(editingMovement.id, incomePayload);
          if (payload.recurringEnabled && payload.recurringFreq === "monthly") {
            await materializeRecurringMovementById(editingMovement.id);
          }
          setToast({ message: "Ingreso actualizado", tone: "success" });
        } else {
          const created = await createIncomeMovement(incomePayload);
          if (payload.recurringEnabled && payload.recurringFreq === "monthly") {
            await materializeRecurringMovementById(created.id);
          }
          setToast({ message: "Ingreso creado", tone: "success" });
        }
      }

      if (type === "collaborator") {
        const payload = values as CollaboratorFormValues;
        if (!editingCollaborator) {
          setToast({ message: "Selecciona un colaborador activo para completar datos.", tone: "error" });
          return false;
        }
        const collaboratorPayload = {
          nombreCompleto: payload.nombreCompleto,
          rolPuesto: payload.rolPuesto,
          tipoPago: payload.tipoPago,
          montoBase: payload.montoBase,
          moneda: payload.moneda,
          cuentaPagoPreferida: payload.cuentaPagoPreferida,
          diaPago: payload.diaPago === "" ? null : payload.diaPago,
          fechaPago: payload.fechaPago ? new Date(payload.fechaPago).toISOString() : null,
          inicioContrato: payload.inicioContrato ? new Date(payload.inicioContrato).toISOString() : "",
          finContrato: payload.contratoIndefinido ? null : payload.finContrato ? new Date(payload.finContrato).toISOString() : null,
          contratoIndefinido: payload.contratoIndefinido,
          activo: payload.activo,
          notas: payload.notas,
          isActive: payload.activo,
          correo: editingCollaborator?.correo ?? null,
          area: editingCollaborator?.area ?? null,
          documento: editingCollaborator?.documento ?? null,
          userId: editingCollaborator?.userId ?? editingCollaborator?.id,
        };
        if (editingCollaborator) {
          await upsertCollaborator(editingCollaborator.id, collaboratorPayload);
          if (editingCollaborator.userId) {
            await updateDoc(doc(db, "users", editingCollaborator.userId), {
              employmentStartDate: payload.inicioContrato,
              contractEndDate: payload.contratoIndefinido ? "" : payload.finContrato,
              contractIndefinite: payload.contratoIndefinido,
              updatedAt: new Date().toISOString(),
            });
          }
          setToast({ message: "Colaborador actualizado", tone: "success" });
        } else {
          await createCollaborator(collaboratorPayload);
          setToast({ message: "Colaborador creado", tone: "success" });
        }
      }

      if (type === "collaborator_payment") {
        const payload = values as CollaboratorPaymentFormValues;
        const paymentPayload = {
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
        };
        if (editingPayment) {
          await updateCollaboratorPayment(editingPayment.id, paymentPayload);
          setToast({ message: "Pago actualizado", tone: "success" });
        } else {
          await createCollaboratorPayment(paymentPayload);
          setToast({ message: "Pago registrado", tone: "success" });
        }
      }

      if (type === "expense") {
        const payload = values as ExpenseFormValues;
        const expensePayload = {
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
          recurrenceId:
            payload.tipoGasto === "FIJO"
              ? editingExpense?.recurrenceId ?? editingExpense?.id ?? crypto.randomUUID()
              : null,
          recurrenceSourceId: editingExpense?.recurrenceSourceId ?? null,
          generatedForMonthKey: editingExpense?.generatedForMonthKey ?? null,
          fixedStartAt:
            payload.tipoGasto === "FIJO"
              ? editingExpense?.fixedStartAt ?? payload.fechaGasto
              : null,
          fixedEndAt: payload.tipoGasto === "FIJO" ? editingExpense?.fixedEndAt ?? null : null,
        };
        if (editingExpense) {
          await updateExpense(editingExpense.id, expensePayload);
          setToast({ message: "Gasto actualizado", tone: "success" });
        } else {
          await createExpense(expensePayload);
          setToast({ message: "Gasto creado", tone: "success" });
        }
      }

      if (type === "transfer") {
        const payload = values as TransferFormValues;
        const isTransfer = payload.tipoMovimiento === "TRANSFERENCIA";
        const transferPayload = {
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
        };
        if (editingTransfer) {
          await updateTransfer(editingTransfer.id, transferPayload);
          setToast({ message: "Movimiento actualizado", tone: "success" });
        } else {
          await createTransfer(transferPayload);
          setToast({ message: "Movimiento creado", tone: "success" });
        }
      }
      setEditingMovement(null);
      setEditingExpense(null);
      setEditingPayment(null);
      setEditingTransfer(null);
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
    setEditingExpense(null);
    setEditingPayment(null);
    setEditingTransfer(null);
    setModalType("income");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setEditingMovement(null);
    setEditingPayment(null);
    setEditingTransfer(null);
    setModalType("expense");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditPayment = (payment: CollaboratorPayment) => {
    setEditingPayment(payment);
    setEditingMovement(null);
    setEditingExpense(null);
    setEditingTransfer(null);
    setModalType("collaborator_payment");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleEditTransfer = (transfer: TransferMovement) => {
    setEditingTransfer(transfer);
    setEditingMovement(null);
    setEditingExpense(null);
    setEditingPayment(null);
    setModalType("transfer");
    setIsModalOpen(true);
    setIsSubmitting(false);
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
        recurringMonthsCount: editingMovement.recurring?.monthsCount ?? 1,
      }
    : null;

  const expenseInitialValues: Partial<ExpenseFormValues> | null = editingExpense
    ? {
        tipoGasto: editingExpense.tipoGasto,
        categoria: editingExpense.categoria,
        descripcion: editingExpense.descripcion,
        monto: editingExpense.monto,
        fechaGasto: formatDateOnly(editingExpense.fechaGasto) ?? editingExpense.fechaGasto,
        cuentaOrigen: editingExpense.cuentaOrigen,
        status: editingExpense.status,
        requiereDevolucion: editingExpense.requiereDevolucion,
        devolucionMonto: editingExpense.devolucionMonto ?? 0,
        referencia: editingExpense.referencia ?? "",
        notas: editingExpense.notas ?? "",
      }
    : null;

  const paymentInitialValues: Partial<CollaboratorPaymentFormValues> | null = editingPayment
    ? {
        colaboradorId: editingPayment.colaboradorId,
        periodo: editingPayment.periodo,
        montoBase: editingPayment.montoBase,
        bono: editingPayment.bono ?? 0,
        descuento: editingPayment.descuento ?? 0,
        devolucion: editingPayment.devolucion ?? 0,
        montoFinal: editingPayment.montoFinal,
        fechaPago: formatDateOnly(editingPayment.fechaPago) ?? editingPayment.fechaPago,
        cuentaOrigen: editingPayment.cuentaOrigen,
        status: editingPayment.status,
        referencia: editingPayment.referencia ?? "",
        notas: editingPayment.notas ?? "",
      }
    : null;

  const collaboratorInitialValues: Partial<CollaboratorFormValues> | null = editingCollaborator
    ? {
        nombreCompleto: editingCollaborator.nombreCompleto,
        rolPuesto: editingCollaborator.rolPuesto,
        tipoPago: editingCollaborator.tipoPago,
        montoBase: editingCollaborator.montoBase,
        moneda: editingCollaborator.moneda,
        cuentaPagoPreferida: editingCollaborator.cuentaPagoPreferida,
        diaPago: editingCollaborator.diaPago ?? "",
        fechaPago: formatDateOnly(editingCollaborator.fechaPago) ?? "",
        inicioContrato: formatDateOnly(editingCollaborator.inicioContrato) ?? editingCollaborator.inicioContrato,
        finContrato: formatDateOnly(editingCollaborator.finContrato) ?? "",
        contratoIndefinido: editingCollaborator.contratoIndefinido ?? !editingCollaborator.finContrato,
        activo: editingCollaborator.isActive ?? editingCollaborator.activo ?? true,
        notas: editingCollaborator.notas ?? "",
      }
    : null;

  const transferInitialValues: Partial<TransferFormValues> | null = editingTransfer
    ? {
        tipoMovimiento: editingTransfer.tipoMovimiento,
        cuentaOrigen: editingTransfer.cuentaOrigen ?? undefined,
        cuentaDestino: editingTransfer.cuentaDestino ?? undefined,
        monto: editingTransfer.monto,
        fecha: formatDateOnly(editingTransfer.fecha) ?? editingTransfer.fecha,
        status: editingTransfer.status,
        referencia: editingTransfer.referencia ?? "",
        notas: editingTransfer.notas ?? "",
      }
    : null;

  const modalInitialValues = useMemo(() => {
    switch (modalType) {
      case "collaborator":
        return collaboratorInitialValues;
      case "expense":
        return expenseInitialValues;
      case "collaborator_payment":
        return paymentInitialValues;
      case "transfer":
        return transferInitialValues;
      case "income":
      default:
        return incomeInitialValues;
    }
  }, [
    collaboratorInitialValues,
    expenseInitialValues,
    incomeInitialValues,
    modalType,
    paymentInitialValues,
    transferInitialValues,
  ]);

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
    if (!window.confirm("¿Eliminar este ingreso?")) return;
    await deleteFinanceMovement(id);
    setToast({ message: "Movimiento eliminado", tone: "success" });
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm("¿Eliminar este gasto?")) return;
    await deleteExpense(id);
    setToast({ message: "Gasto eliminado", tone: "success" });
  };

  const handleDeletePayment = async (id: string) => {
    if (!window.confirm("¿Eliminar este pago?")) return;
    await deleteCollaboratorPayment(id);
    setToast({ message: "Pago eliminado", tone: "success" });
  };

  const handleDeleteTransfer = async (id: string) => {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    await deleteTransfer(id);
    setToast({ message: "Movimiento eliminado", tone: "success" });
  };

  const collaboratorsWithReadiness = useMemo(() => {
    const requiredKeys: Array<{ key: keyof Collaborator; label: string }> = [
      { key: "rolPuesto", label: "Cargo" },
      { key: "tipoPago", label: "Tipo de pago" },
      { key: "montoBase", label: "Monto base" },
      { key: "cuentaPagoPreferida", label: "Cuenta de pago" },
      { key: "inicioContrato", label: "Inicio de contrato" },
    ];
    return collaboratorsForPayments.map((item) => {
      const missingFields = requiredKeys
        .filter((field) => {
          const value = item[field.key];
          if (typeof value === "number") return value <= 0;
          return !value;
        })
        .map((field) => field.label);
      return {
        ...item,
        missingFields,
        isReadyForPayment: missingFields.length === 0,
      };
    });
  }, [collaboratorsForPayments]);

  const visibleCollaborators = useMemo(() => {
    if (collaboratorsFilter === "active") {
      return collaboratorsWithReadiness.filter((item) => item.isActive ?? item.activo ?? true);
    }
    if (collaboratorsFilter === "inactive") {
      return collaboratorsWithReadiness.filter((item) => !(item.isActive ?? item.activo ?? true));
    }
    return collaboratorsWithReadiness;
  }, [collaboratorsFilter, collaboratorsWithReadiness]);

  const handleEditCollaborator = (collaborator: Collaborator) => {
    setEditingCollaborator(collaborator);
    setModalType("collaborator");
    setIsModalOpen(true);
    setIsSubmitting(false);
  };

  const handleToggleCollaborator = async (collaborator: Collaborator) => {
    const nextActive = !(collaborator.isActive ?? collaborator.activo ?? true);
    await updateDoc(doc(db, "users", collaborator.id), {
      isActive: nextActive,
      active: nextActive,
      updatedAt: new Date().toISOString(),
    });
    await updateCollaboratorActive(collaborator.id, nextActive);
    setToast({
      message: nextActive ? "Colaborador activado" : "Colaborador desactivado",
      tone: "success",
    });
  };

  const handleDeleteCollaborator = async (collaborator: Collaborator) => {
    const confirmed = window.confirm(`¿Eliminar al colaborador ${collaborator.nombreCompleto}? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
      await deleteCollaborator(collaborator.id);
      setToast({
        message: `Colaborador eliminado: ${collaborator.nombreCompleto}`,
        tone: "success",
      });
    } catch (error) {
      console.error("[admin/finanzas] Error eliminando colaborador", error);
      setToast({
        message: "No se pudo eliminar el colaborador.",
        tone: "error",
      });
    }
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
                {isAnnualView
                  ? `${annualYear} · Resumen anual de finanzas.`
                  : `${formatMonthLabel(filters.monthKey)} · Control mensual de ingresos.`}
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
                  onClick={() => setIsCollaboratorsModalOpen(true)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Colaboradores
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleOpenCopyPreviousMonth}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
              >
                Importar del mes anterior
              </button>
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
          <FinanceFiltersBar
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
                    {isAnnualView ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Año</span>
                        <select
                          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                          value={annualYear}
                          onChange={(event) => setAnnualYear(Number(event.target.value))}
                        >
                          {availableYears.map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setDetailTab("summary");
                        setIsDetailOpen(true);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                    >
                      Ver desglose
                    </button>
                  </div>
                  <FinanceHeroCard
                    title={heroContent.title}
                    incomeLabel={heroContent.incomeLabel}
                    expensesLabel={heroContent.expensesLabel}
                    cashFlowLabel={heroContent.cashFlowLabel}
                    netLabel={heroContent.netLabel}
                    marginLabel={heroContent.marginLabel}
                    incomePaid={heroContent.incomePaid}
                    expensesPaid={heroContent.expensesPaid}
                    cashFlow={heroContent.cashFlow}
                    netIncome={heroContent.netIncome}
                    margin={heroContent.margin}
                  />
                  {isAnnualView ? (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <FinanceKpiCard
                          title="Ingresos acumulados"
                          value={annualStats.totalIncome}
                          tone="blue"
                        />
                        <FinanceKpiCard
                          title="Egresos acumulados"
                          value={annualStats.totalExpenses}
                          tone="rose"
                        />
                        <FinanceKpiCard title="Flujo de caja anual" value={annualCashFlow.net} tone="slate" />
                        <FinanceKpiCard title="Utilidad acumulada" value={annualStats.net} tone="green" />
                        <Card className="border border-transparent bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-white">
                          <div className="space-y-2 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Margen acumulado
                            </p>
                            <p className="text-2xl font-semibold text-slate-900">
                              {annualStats.margin.toFixed(1)}%
                            </p>
                          </div>
                        </Card>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
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
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Gráfico mensual del año
                          </p>
                          <div className="mt-4">
                            {annualChartData.length === 0 ? (
                              <div className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
                                Sin datos para el año seleccionado.
                              </div>
                            ) : (
                              <FinanceMonthlyChart data={annualChartData} />
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <FinanceKpiCard title="Ingresos cobrados" value={monthlyStatusMetrics.incomePaid} tone="blue" />
                        <FinanceKpiCard title="Pendiente por cobrar" value={kpis.incomePending} tone="amber" />
                        <FinanceKpiCard title="Gastos pagados" value={monthlyStatusMetrics.expensesPaid} tone="rose" />
                        <FinanceKpiCard title="Flujo de caja" value={monthlyStatusMetrics.cashFlow} tone="slate" />
                        <FinanceKpiCard title="Utilidad neta" value={monthlyStatusMetrics.netIncome} tone="green" />
                      </div>
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
                              <p className="text-xs text-slate-500">Egresos proyectados</p>
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

                          <div className="mt-4 border-t border-slate-100 pt-3">
                            <button
                              type="button"
                              className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                              onClick={() => setIsProjectionDetailOpen((prev) => !prev)}
                            >
                              {isProjectionDetailOpen ? "Ocultar detalle" : "Ver detalle"}
                            </button>

                            {isProjectionDetailOpen ? (
                              <div className="mt-3 space-y-3 text-xs text-slate-500">
                                <p className="font-semibold text-slate-600">📊 Detalle del cálculo</p>

                                <div>
                                  <p className="font-semibold text-slate-600">INGRESOS</p>
                                  <p>- Total ingresos considerados: {formatCurrency(projection.detail.ingresos.total)}</p>
                                  <p>- Cantidad de ingresos considerados: {projection.detail.ingresos.count}</p>
                                </div>

                                <div>
                                  <p className="font-semibold text-slate-600">EGRESOS</p>
                                  <p>
                                    - Pagos a colaboradores (periodo {projection.detail.colaboradores.periodKey}): {" "}
                                    {formatCurrency(projection.detail.colaboradores.total)}
                                  </p>
                                  <p>- Cantidad de pagos considerados: {projection.detail.colaboradores.count}</p>
                                  <p>- Gastos del mes: {formatCurrency(projection.detail.gastos.total)}</p>
                                  <p>- Cantidad de gastos considerados: {projection.detail.gastos.count}</p>
                                  <p>- Total egresos considerados: {formatCurrency(projection.expensesProjected)}</p>
                                </div>

                                <div>
                                  <p className="font-semibold text-slate-600">UTILIDAD Y MARGEN</p>
                                  <p>- Utilidad = Ingresos - Egresos: {formatCurrency(projection.projectedNet)}</p>
                                  <p>- Margen = (Utilidad / Ingresos) × 100: {projection.projectedMargin.toFixed(1)}%</p>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Real vs Proyectado
                          </p>
                          <div className="mt-4 space-y-4 text-sm">
                            {realVsProjectedRows.map((row) => {
                              const maxValue = Math.max(row.real, row.projected, 1);
                              const realPercent = (row.real / maxValue) * 100;
                              const projectedPercent = (row.projected / maxValue) * 100;
                              return (
                                <div key={row.label} className="space-y-2">
                                  <div className="flex items-center justify-between gap-4">
                                    <p className="text-xs font-semibold text-slate-500">{row.label}</p>
                                    <p className="text-xs text-slate-500">
                                      {formatCurrency(row.real)} / {formatCurrency(row.projected)}
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    <div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Real</span>
                                        <span>{realPercent.toFixed(0)}%</span>
                                      </div>
                                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                                        <div
                                          className="h-2 rounded-full bg-indigo-500"
                                          style={{ width: `${realPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                                        <span>Proyectado</span>
                                        <span>{projectedPercent.toFixed(0)}%</span>
                                      </div>
                                      <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                                        <div
                                          className="h-2 rounded-full bg-slate-400"
                                          style={{ width: `${projectedPercent}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Acumulado YTD {selectedMonthInfo.year}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <FinanceKpiCard title="Ingresos acumulados" value={ytdTotals.totalIncome} tone="blue" />
                          <FinanceKpiCard title="Egresos acumulados" value={ytdTotals.totalExpenses} tone="rose" />
                          <FinanceKpiCard title="Utilidad acumulada" value={ytdTotals.net} tone="green" />
                          <div className="rounded-2xl border border-slate-200/60 bg-slate-50/80 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Margen acumulado
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-900">
                              {ytdTotals.margin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Resumen mensual (últimos 12)
                          </p>
                          <div className="mt-4 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                              <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                <tr>
                                  <th className="px-2 py-2">Mes</th>
                                  <th className="px-2 py-2 text-right">Ingresos</th>
                                  <th className="px-2 py-2 text-right">Egresos</th>
                                  <th className="px-2 py-2 text-right">Utilidad</th>
                                </tr>
                              </thead>
                              <tbody>
                                {monthlySeries.map((row) => (
                                  <tr key={row.monthKey} className="border-t border-slate-100">
                                    <td className="px-2 py-2 text-xs text-slate-500">
                                      {formatMonthLabel(row.monthKey)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {formatCurrency(row.incomeTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right">
                                      {formatCurrency(row.expensesTotal)}
                                    </td>
                                    <td className="px-2 py-2 text-right font-semibold text-slate-900">
                                      {formatCurrency(row.net)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
                      <FinancePendingList
                        title="Pendientes por cobrar"
                        items={filteredMovements.filter((movement) => movement.status === "pending")}
                        emptyLabel="Sin pendientes."
                      />
                    </>
                  )}
                </>
              ) : null}

              {activeTab === "movimientos" ? (
                <MovementsTab
                  movements={filteredMovements}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteMovement}
                  onEdit={handleEditMovement}
                  isSubmitting={isSubmitting}
                />
              ) : null}

              {activeTab === "gastos" ? (
                <ExpensesTab
                  expenses={filteredExpenses}
                  isSubmitting={isSubmitting}
                  onStatusChange={handleExpenseStatusChange}
                  onEdit={handleEditExpense}
                  onDelete={handleDeleteExpense}
                />
              ) : null}

              {activeTab === "pagos" ? (
                <PaymentsTab
                  payments={filteredPayments}
                  collaboratorLookup={collaboratorLookup}
                  isSubmitting={isSubmitting}
                  onStatusChange={handlePaymentStatusChange}
                  onEdit={handleEditPayment}
                  onDelete={handleDeletePayment}
                />
              ) : null}

              {activeTab === "cuentas" ? (
                <AccountsTab
                  transfers={filteredTransfers}
                  isSubmitting={isSubmitting}
                  onStatusChange={handleTransferStatusChange}
                  onEdit={handleEditTransfer}
                  onDelete={handleDeleteTransfer}
                />
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                  onClick={exportDetailCsv}
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                  onClick={() => setIsDetailOpen(false)}
                >
                  Cerrar
                </button>
              </div>
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
                          <span className="font-semibold">{formatCurrency(monthlyStatusMetrics.incomePaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Gastos pagados</span>
                          <span className="font-semibold">{formatCurrency(monthlyStatusMetrics.expensesPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Utilidad neta</span>
                          <span className="font-semibold">{formatCurrency(monthlyStatusMetrics.netIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Margen neto</span>
                          <span className="font-semibold">{monthlyStatusMetrics.margin.toFixed(1)}%</span>
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
                          <span>Egresos proyectados</span>
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

                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-slate-500 transition hover:text-slate-700"
                          onClick={() => setIsDetailModalProjectionOpen((prev) => !prev)}
                        >
                          {isDetailModalProjectionOpen ? "Ocultar detalle" : "Ver detalle"}
                        </button>

                        {isDetailModalProjectionOpen ? (
                          <div className="mt-3 space-y-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-600">📊 Detalle del cálculo</p>

                            <div>
                              <p className="font-semibold text-slate-600">INGRESOS</p>
                              <p>- Total ingresos considerados: {formatCurrency(projection.detail.ingresos.total)}</p>
                              <p>- Cantidad de ingresos considerados: {projection.detail.ingresos.count}</p>
                            </div>

                            <div>
                              <p className="font-semibold text-slate-600">EGRESOS</p>
                              <p>
                                - Pagos a colaboradores (periodo {projection.detail.colaboradores.periodKey}): {" "}
                                {formatCurrency(projection.detail.colaboradores.total)}
                              </p>
                              <p>- Cantidad de pagos considerados: {projection.detail.colaboradores.count}</p>
                              <p>- Gastos del mes: {formatCurrency(projection.detail.gastos.total)}</p>
                              <p>- Cantidad de gastos considerados: {projection.detail.gastos.count}</p>
                              <p>- Total egresos considerados: {formatCurrency(projection.expensesProjected)}</p>
                            </div>

                            <div>
                              <p className="font-semibold text-slate-600">UTILIDAD Y MARGEN</p>
                              <p>- Utilidad = Ingresos - Egresos: {formatCurrency(projection.projectedNet)}</p>
                              <p>- Margen = (Utilidad / Ingresos) × 100: {projection.projectedMargin.toFixed(1)}%</p>
                            </div>
                          </div>
                        ) : null}
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
                        <th className="px-4 py-3">Cliente</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {incomeSummary.map((row) => (
                        <tr key={`${row.clientName}-${row.status}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">{row.clientName}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {getStatusLabel(row.status)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{row.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {incomeSummary.length === 0 ? (
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
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseSummary.map((row) => (
                        <tr key={`${row.categoria}-${row.status}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">{row.categoria}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {getStatusLabel(row.status)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{row.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {expenseSummary.length === 0 ? (
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
                        <th className="px-4 py-3">Colaborador</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSummary.map((row) => (
                        <tr key={row.name} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-xs text-slate-500">{row.name}</td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">{row.count}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {formatCurrency(row.total)}
                          </td>
                        </tr>
                      ))}
                      {paymentSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400">
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
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {getStatusLabel(transfer.status)}
                          </td>
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


      {isCollaboratorsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Gestión de colaboradores</h3>
                <p className="text-xs text-slate-500">Vista administrativa de colaboradores activos y campos pendientes para pago.</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
                onClick={() => setIsCollaboratorsModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <select
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                value={collaboratorsFilter}
                onChange={(event) =>
                  setCollaboratorsFilter(event.target.value as "all" | "active" | "inactive")
                }
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-500">
                  Listos para pago: {collaboratorsWithReadiness.filter((item) => item.isReadyForPayment).length} / {collaboratorsWithReadiness.length}
                </p>
                <button
                  type="button"
                  className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    setEditingCollaborator(null);
                    setModalType("collaborator");
                    setIsModalOpen(true);
                    setIsSubmitting(false);
                  }}
                >
                  Nuevo colaborador
                </button>
              </div>
            </div>

            <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Completitud para pago</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCollaborators.map((collaborator) => {
                    const isActive = collaborator.isActive ?? collaborator.activo ?? true;
                    return (
                      <tr key={collaborator.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{collaborator.nombreCompleto}</p>
                          <p className="text-xs text-slate-500">{collaborator.correo ?? "Sin correo"}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {isActive ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {collaborator.isReadyForPayment ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                              Completo
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-xs text-slate-500">{collaborator.missingFields.join(", ")}</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                              onClick={() => handleEditCollaborator(collaborator)}
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600"
                              onClick={() => handleToggleCollaborator(collaborator)}
                              title={isActive ? "Desactivar" : "Activar"}
                              aria-label={isActive ? "Desactivar" : "Activar"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            {collaborator.userId ? null : (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                                onClick={() => handleDeleteCollaborator(collaborator)}
                                title="Eliminar"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {visibleCollaborators.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                        Sin colaboradores para este filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}


      <CopyPreviousMonthModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        onConfirm={handleCopyPreviousMonth}
        movements={copySourceData.movements}
        expenses={copySourceData.expenses}
        payments={copySourceData.payments}
        collaborators={collaboratorsForPayments}
        loading={isCopyingMonthData}
      />

      <FinanceModal
        isOpen={isModalOpen}
        modalType={modalType}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMovement(null);
          setEditingExpense(null);
          setEditingPayment(null);
          setEditingTransfer(null);
          setEditingCollaborator(null);
        }}
        onSubmit={handleCreateMovement}
        disabled={isSubmitting}
        isSubmitting={isSubmitting}
        initialValues={modalInitialValues}
        collaboratorsData={collaboratorsForPayments}
      />
    </div>
  );
}
