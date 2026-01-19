"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import FinanceGate from "@/components/admin/FinanceGate";
import { useAuth } from "@/components/auth/AuthProvider";
import FinanceTabs from "@/components/finance/FinanceTabs";
import FinanceHeroCard from "@/components/finance/FinanceHeroCard";
import FinanceKpiCard from "@/components/finance/FinanceKpiCard";
import FinanceChartCard from "@/components/finance/FinanceChartCard";
import FinanceFilterBar from "@/components/finance/FinanceFilterBar";
import FinanceTable from "@/components/finance/FinanceTable";
import FinancePendingList from "@/components/finance/FinancePendingList";
import FinanceModal, { type NewFinanceTransaction } from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import {
  calculateAccountBalances,
  calculateKPIs,
  filterTransactions,
  getMonthlyRunway,
  getPendingItems,
  groupExpenseCategories,
  groupWeeklyTotals,
} from "@/lib/finance/analytics";
import {
  addFinanceTransaction,
  createFinanceTransaction,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceTransactions,
  seedFinanceData,
} from "@/lib/finance/storage";
import type {
  FinanceFilters,
  FinanceTabKey,
  FinanceTransaction,
  FinanceTransactionType,
} from "@/lib/finance/types";
import { formatCurrency, getMonthKey } from "@/lib/finance/utils";

const donutColors = ["#6366f1", "#22c55e", "#f59e0b", "#f97316", "#ef4444"];

export default function FinanceModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FinanceTabKey>("dashboard");
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [accounts, setAccounts] = useState(() => listFinanceAccounts());
  const [categories, setCategories] = useState(() => listFinanceCategories());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<FinanceTransaction | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [filters, setFilters] = useState<FinanceFilters>({
    monthKey: getMonthKey(new Date()),
    status: "all",
    account: "all",
    responsible: "all",
    category: "all",
  });

  useEffect(() => {
    seedFinanceData();
    setTransactions(listFinanceTransactions());
    setAccounts(listFinanceAccounts());
    setCategories(listFinanceCategories());
    setIsLoading(false);
  }, []);

  const responsibles = useMemo(() => {
    const unique = new Set(transactions.map((item) => item.responsible).filter(Boolean));
    const list = Array.from(unique);
    return list.length > 0 ? list : ["Luis", "Alondra", "Kimce"];
  }, [transactions]);

  const filteredTransactions = useMemo(() => filterTransactions(transactions, filters), [transactions, filters]);

  const kpis = useMemo(() => calculateKPIs(transactions, filters.monthKey), [transactions, filters.monthKey]);

  const weeklyData = useMemo(
    () => groupWeeklyTotals(transactions, filters.monthKey),
    [transactions, filters.monthKey]
  );

  const expenseData = useMemo(
    () => groupExpenseCategories(transactions, filters.monthKey),
    [transactions, filters.monthKey]
  );

  const accountBalances = useMemo(
    () => calculateAccountBalances(transactions, accounts, filters.monthKey),
    [transactions, accounts, filters.monthKey]
  );

  const totalCash = useMemo(
    () => accountBalances.reduce((total, account) => total + account.balance, 0),
    [accountBalances]
  );

  const runwayWeeks = useMemo(
    () => getMonthlyRunway(transactions, filters.monthKey, totalCash),
    [transactions, filters.monthKey, totalCash]
  );

  const pendingItems = useMemo(
    () => getPendingItems(transactions, filters.monthKey),
    [transactions, filters.monthKey]
  );

  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * 6;
    return filteredTransactions.slice(start, start + 6);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / 6) || 1;

  const openModal = () => {
    setDuplicateWarning(null);
    setPendingDuplicate(null);
    setIsModalOpen(true);
  };

  const handleCreateTransaction = (values: NewFinanceTransaction) => {
    const paidAt = values.status === "paid" ? new Date(values.date).toISOString() : undefined;
    const { transaction, duplicates } = createFinanceTransaction({
      date: new Date(values.date).toISOString(),
      type: values.type as FinanceTransactionType,
      amount: values.amount,
      accountFrom: values.accountFrom || undefined,
      accountTo: values.accountTo || undefined,
      responsible: values.responsible || "Sin asignar",
      category: values.category,
      status: values.status,
      notes: values.description,
      referenceId: values.referenceId || undefined,
      paidAt,
    });

    if (duplicates.length > 0 && (!pendingDuplicate || pendingDuplicate.referenceId !== transaction.referenceId)) {
      setDuplicateWarning(
        "Se detectó un posible duplicado con la misma fecha, tipo y monto. Confirma el guardado si deseas continuar."
      );
      setPendingDuplicate(transaction);
      return;
    }

    addFinanceTransaction(transaction);
    setTransactions(listFinanceTransactions());
    setAccounts(listFinanceAccounts());
    setCategories(listFinanceCategories());
    setIsModalOpen(false);
    setDuplicateWarning(null);
    setPendingDuplicate(null);
  };

  const renderEmptyState = () => (
    <div className="rounded-2xl border border-dashed border-slate-200/80 bg-white p-8 text-center text-sm text-slate-500">
      <p className="font-semibold text-slate-700">Aún no hay movimientos este mes</p>
      <p className="mt-2">Registra el primer movimiento para activar el dashboard.</p>
      <button
        type="button"
        onClick={openModal}
        className="mt-4 rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
      >
        Nuevo movimiento
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader userName={user?.displayName ?? "Administrador"} />
      <FinanceGate>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Finanzas</h1>
              <p className="text-sm text-slate-500">
                Control mensual de ingresos, gastos y caja en un solo lugar.
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

          <FinanceTabs active={activeTab} onChange={(key) => setActiveTab(key)} />
          <FinanceFilterBar
            filters={filters}
            onChange={(next) => {
              setFilters(next);
              setCurrentPage(1);
            }}
            accounts={accounts}
            categories={categories}
            responsibles={responsibles}
          />

          {isLoading ? (
            <FinanceSkeleton />
          ) : filteredTransactions.length === 0 ? (
            renderEmptyState()
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
                    <FinanceKpiCard
                      title="Ingresos cobrados"
                      value={kpis.incomePaid}
                      tone="blue"
                      subtitle="Solo cancelados"
                    />
                    <FinanceKpiCard
                      title="Caja total"
                      value={totalCash}
                      tone="green"
                      subtitle="Suma cuentas activas"
                    />
                    <FinanceKpiCard
                      title="Pendiente por cobrar"
                      value={kpis.incomePending}
                      tone="amber"
                      subtitle="No impacta caja"
                    />
                    <FinanceKpiCard
                      title="Gastos pagados"
                      value={kpis.expensesPaid}
                      tone="rose"
                      subtitle="Incluye SUNAT y pagos"
                    />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <FinanceChartCard title="Ingresos vs Gastos" description="Comparativo semanal del mes">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyData} barSize={18}>
                            <XAxis dataKey="name" tickLine={false} axisLine={false} />
                            <YAxis tickLine={false} axisLine={false} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="ingresos" fill="#6366f1" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="gastos" fill="#f97316" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </FinanceChartCard>
                    <FinanceChartCard title="Gastos por categoría" description="Distribución de pagos">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={expenseData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                              {expenseData.map((entry, index) => (
                                <Cell key={`${entry.name}-${index}`} fill={donutColors[index % donutColors.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </FinanceChartCard>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
                    <FinanceChartCard title="Caja por cuenta" description="Saldo actual acumulado">
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={accountBalances} layout="vertical" barSize={14}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="id" width={80} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="balance" fill="#22c55e" radius={[6, 6, 6, 6]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </FinanceChartCard>
                    <FinancePendingList
                      title="Pendientes por cobrar"
                      items={pendingItems.pendingIncome}
                      emptyLabel="No hay ingresos pendientes este mes."
                    />
                    <FinancePendingList
                      title="Pendientes por pagar"
                      items={pendingItems.pendingExpenses}
                      emptyLabel="No hay gastos pendientes por pagar."
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                      <h3 className="text-sm font-semibold text-slate-900">Utilidad neta</h3>
                      <p className="text-xs text-slate-500">Ingresos cobrados - gastos pagados</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">
                        {formatCurrency(kpis.netIncome)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                      <h3 className="text-sm font-semibold text-slate-900">Runway estimado</h3>
                      <p className="text-xs text-slate-500">Semanas de operación con caja actual</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-900">
                        {runwayWeeks ? `${runwayWeeks.toFixed(1)} semanas` : "Sin data"}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}

              {activeTab === "movimientos" ? (
                <div className="space-y-4">
                  <FinanceTable transactions={paginatedTransactions} />
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onChange={setCurrentPage}
                  />
                </div>
              ) : null}

              {activeTab === "pagos" ? (
                <FinanceTable
                  transactions={filteredTransactions.filter((item) => item.type === "collaborator_payment")}
                />
              ) : null}

              {activeTab === "gastos" ? (
                <FinanceTable
                  transactions={filteredTransactions.filter((item) =>
                    ["expense", "tax"].includes(item.type)
                  )}
                />
              ) : null}

              {activeTab === "cuentas" ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {accountBalances.map((account) => (
                    <div
                      key={account.id}
                      className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{account.id}</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {formatCurrency(account.balance)}
                      </p>
                      <p className="text-xs text-slate-500">{account.name}</p>
                    </div>
                  ))}
                  <div className="rounded-2xl bg-gradient-to-br from-[#22c55e] via-[#16a34a] to-[#15803d] p-5 text-white shadow-[0_16px_32px_rgba(34,197,94,0.3)]">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/70">Caja total</p>
                    <p className="mt-3 text-2xl font-semibold">{formatCurrency(totalCash)}</p>
                    <p className="mt-1 text-xs text-white/70">Solo movimientos cancelados.</p>
                  </div>
                </div>
              ) : null}

              {activeTab === "cierre" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                    <h3 className="text-sm font-semibold text-slate-900">Resumen del mes</h3>
                    <p className="text-xs text-slate-500">KPIs finales del cierre.</p>
                    <div className="mt-4 space-y-3 text-sm">
                      <SummaryRow label="Ingresos cobrados" value={formatCurrency(kpis.incomePaid)} />
                      <SummaryRow label="Gastos pagados" value={formatCurrency(kpis.expensesPaid)} />
                      <SummaryRow label="Utilidad neta" value={formatCurrency(kpis.netIncome)} />
                      <SummaryRow label="Pendiente por pagar" value={formatCurrency(kpis.expensesPending)} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                    <h3 className="text-sm font-semibold text-slate-900">Checklist de cierre</h3>
                    <p className="text-xs text-slate-500">Acciones sugeridas antes de bloquear el mes.</p>
                    <ul className="mt-4 space-y-3 text-sm text-slate-600">
                      <li>✔ Revisar pagos pendientes y conciliaciones.</li>
                      <li>✔ Validar transferencias entre cuentas.</li>
                      <li>✔ Documentar notas del cierre y responsables.</li>
                    </ul>
                    <button
                      type="button"
                      className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Marcar mes como cerrado
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </FinanceGate>

      <FinanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateTransaction}
        accounts={accounts}
        categories={categories}
        responsibles={responsibles}
        duplicateWarning={duplicateWarning}
      />
    </div>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <span>
        Página {currentPage} de {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-40"
          onClick={() => onChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 disabled:opacity-40"
          onClick={() => onChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
