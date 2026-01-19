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
import FinanceModal, { type NewFinanceMovement } from "@/components/finance/FinanceModal";
import FinanceSkeleton from "@/components/finance/FinanceSkeleton";
import {
  calcKpis,
  calculateAccountBalances,
  calculateProjections,
  filterMovements,
  getMonthComparison,
  getMonthlyRunway,
  getPendingItems,
} from "@/lib/finance/analytics";
import {
  addFinanceMovement,
  closeFinanceMonth,
  createFinanceMovement,
  listFinanceAccounts,
  listFinanceCategories,
  listFinanceClients,
  listFinanceCollaborators,
  listFinanceContracts,
  listFinanceMovements,
  listMonthClosures,
  saveFinanceClients,
  saveFinanceContracts,
  seedFinanceData,
  updateFinanceMovementStatus,
} from "@/lib/finance/storage";
import type {
  FinanceClient,
  FinanceContract,
  FinanceFilters,
  FinanceMovement,
  FinanceMovementStatus,
  FinanceTabKey,
  ValidationReference,
} from "@/lib/finance/types";
import { formatCurrency, getMonthKey, getMonthLabel, getPreviousMonthKey } from "@/lib/finance/utils";

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
  const [accounts, setAccounts] = useState(() => listFinanceAccounts());
  const [categories, setCategories] = useState(() => listFinanceCategories());
  const [clients, setClients] = useState<FinanceClient[]>([]);
  const [contracts, setContracts] = useState<FinanceContract[]>([]);
  const [closures, setClosures] = useState(listMonthClosures());
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<FinanceMovement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [validationMode, setValidationMode] = useState(false);
  const [referenceValues, setReferenceValues] = useState<ValidationReference | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);

  const [filters, setFilters] = useState<FinanceFilters>({
    monthKey: getMonthKey(new Date()),
    status: "all",
    account: "all",
    responsible: "all",
    category: "all",
    type: "all",
  });

  useEffect(() => {
    seedFinanceData();
    setMovements(listFinanceMovements());
    setAccounts(listFinanceAccounts());
    setCategories(listFinanceCategories());
    setClients(listFinanceClients());
    setContracts(listFinanceContracts());
    setClosures(listMonthClosures());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (contracts.length === 0) return;
    const existing = listFinanceMovements();
    const monthKey = filters.monthKey;
    const generated = contracts
      .filter((contract) => contract.active)
      .filter((contract) => !existing.some((movement) => movement.monthKey === monthKey && movement.referenceCode === contract.id))
      .map((contract) => {
        const date = new Date();
        date.setDate(contract.payDay);
        const createdAt = new Date().toISOString();
        return {
          id: `mov-${contract.id}-${monthKey}`,
          date: date.toISOString(),
          monthKey,
          type: "PagoColaborador" as const,
          status: "Pendiente" as const,
          amount: contract.amount,
          currency: "PEN" as const,
          accountFrom: contract.defaultAccountFrom,
          responsible: contract.collaboratorName,
          category: "Personal",
          concept: `Pago ${contract.collaboratorName}`,
          referenceCode: contract.id,
          createdAt,
          updatedAt: createdAt,
        };
      });

    if (generated.length > 0) {
      const next = [...generated, ...existing];
      setMovements(next);
    }
  }, [contracts, filters.monthKey]);

  useEffect(() => {
    if (clients.length === 0) return;
    const existing = listFinanceMovements();
    const monthKey = filters.monthKey;
    const generated = clients
      .filter((client) => client.active && client.isRecurring)
      .filter((client) => !existing.some((movement) => movement.monthKey === monthKey && movement.referenceCode === `CLIENT-${client.id}`))
      .map((client) => {
        const date = new Date();
        date.setDate(client.recurringDay);
        const createdAt = new Date().toISOString();
        return {
          id: `mov-client-${client.id}-${monthKey}`,
          date: date.toISOString(),
          monthKey,
          type: "Ingreso" as const,
          status: "Pendiente" as const,
          amount: client.recurringAmount,
          currency: "PEN" as const,
          accountTo: client.defaultAccountTo,
          responsible: "Equipo",
          category: "Ventas",
          clientId: client.id,
          clientName: client.name,
          concept: client.name,
          referenceCode: `CLIENT-${client.id}`,
          createdAt,
          updatedAt: createdAt,
        };
      });

    if (generated.length > 0) {
      const next = [...generated, ...existing];
      setMovements(next);
    }
  }, [clients, filters.monthKey]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const responsibles = useMemo(() => {
    const unique = new Set(movements.map((item) => item.responsible).filter(Boolean));
    const list = Array.from(unique);
    return list.length > 0 ? list : ["Luis", "Alondra", "Kimce"];
  }, [movements]);

  const filteredMovements = useMemo(() => filterMovements(movements, filters), [movements, filters]);

  const kpis = useMemo(() => calcKpis(movements, filters.monthKey), [movements, filters.monthKey]);

  const accountBalances = useMemo(
    () => calculateAccountBalances(movements, accounts, filters.monthKey),
    [movements, accounts, filters.monthKey]
  );

  const totalCash = useMemo(
    () => accountBalances.reduce((total, account) => total + account.balance, 0),
    [accountBalances]
  );

  const projections = useMemo(
    () => calculateProjections(movements, filters.monthKey, totalCash),
    [movements, filters.monthKey, totalCash]
  );

  const runwayWeeks = useMemo(
    () => getMonthlyRunway(movements, filters.monthKey, totalCash),
    [movements, filters.monthKey, totalCash]
  );

  const pendingItems = useMemo(
    () => getPendingItems(movements, filters.monthKey),
    [movements, filters.monthKey]
  );

  const currentClosure = useMemo(
    () => closures.find((closure) => closure.monthKey === filters.monthKey),
    [closures, filters.monthKey]
  );

  const previousClosure = useMemo(
    () => closures.find((closure) => closure.monthKey === getPreviousMonthKey(filters.monthKey)),
    [closures, filters.monthKey]
  );

  const comparison = useMemo(() => {
    if (!currentClosure) return null;
    return getMonthComparison(currentClosure.snapshot, previousClosure?.snapshot);
  }, [currentClosure, previousClosure]);

  const isLocked = currentClosure?.locked ?? false;

  const openModal = () => {
    if (isLocked) return;
    setDuplicateWarning(null);
    setPendingDuplicate(null);
    setIsModalOpen(true);
  };

  const handleCreateMovement = (values: NewFinanceMovement) => {
    if (isLocked) return;
    const clientName = values.type === "Ingreso" ? values.clientName : undefined;
    const { movement, duplicates } = createFinanceMovement({
      date: new Date(values.date).toISOString(),
      type: values.type,
      amount: values.amount,
      accountFrom: values.accountFrom || undefined,
      accountTo: values.accountTo || undefined,
      responsible: values.responsible || "Sin asignar",
      category: values.category,
      status: values.status,
      concept: values.type === "Ingreso" ? clientName ?? "Ingreso" : values.description ?? values.category,
      referenceCode: values.referenceCode || undefined,
      clientId: values.clientId || undefined,
      clientName,
    });

    if (duplicates.length > 0 && (!pendingDuplicate || pendingDuplicate.referenceCode !== movement.referenceCode)) {
      setDuplicateWarning(
        "Se detectó un posible duplicado con la misma fecha, tipo y monto. Confirma el guardado si deseas continuar."
      );
      setPendingDuplicate(movement);
      return;
    }

    addFinanceMovement(movement);
    setMovements(listFinanceMovements());
    setIsModalOpen(false);
    setDuplicateWarning(null);
    setPendingDuplicate(null);
  };

  const handleStatusChange = (id: string, status: FinanceMovementStatus) => {
    if (isLocked) return;
    updateFinanceMovementStatus(id, status);
    setMovements(listFinanceMovements());
    setToast("Estado actualizado");
  };

  const handleKpiClick = (tab: FinanceTabKey, status?: FinanceMovementStatus, type?: FinanceFilters["type"]) => {
    setActiveTab(tab);
    setFilters((prev) => ({
      ...prev,
      status: status ?? "all",
      type: type ?? prev.type,
    }));
  };

  const validationDelta = useMemo(() => {
    if (!validationMode || !referenceValues) return null;
    const deltaIngresos = kpis.incomePaid - referenceValues.ingresosRef;
    const deltaPagos = kpis.expensesPaid - referenceValues.pagosRef;
    const deltaSunat = kpis.sunatPaid - referenceValues.sunatRef;
    const deltaGastos = kpis.expensesPaid - referenceValues.gastosRef;
    const hasDiff = [deltaIngresos, deltaPagos, deltaSunat, deltaGastos].some((delta) => delta !== 0);
    return { hasDiff, deltaIngresos, deltaPagos, deltaSunat, deltaGastos };
  }, [validationMode, referenceValues, kpis]);

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
                {getMonthLabel(filters.monthKey)} · Control mensual de ingresos, gastos y caja.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                onClick={() => setShowValidationModal(true)}
              >
                Modo validación
              </button>
              <button
                type="button"
                onClick={openModal}
                className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)] disabled:opacity-40"
                disabled={isLocked}
              >
                Nuevo movimiento
              </button>
            </div>
          </div>

          {isLocked ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Este mes está cerrado. Las ediciones están bloqueadas hasta el próximo periodo.
            </div>
          ) : null}

          {validationDelta?.hasDiff ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
              Diferencia detectada. Delta ingresos: {formatCurrency(validationDelta.deltaIngresos)} · Delta pagos:{" "}
              {formatCurrency(validationDelta.deltaPagos)} · Delta SUNAT: {formatCurrency(validationDelta.deltaSunat)} ·
              Delta gastos: {formatCurrency(validationDelta.deltaGastos)}
            </div>
          ) : null}

          {validationMode && referenceValues ? (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-4 text-xs text-slate-600">
              <p className="font-semibold text-slate-700">Validación vs Excel</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <span>Ingresos: {formatCurrency(kpis.incomePaid)} / {formatCurrency(referenceValues.ingresosRef)}</span>
                <span>Pagos: {formatCurrency(kpis.expensesPaid)} / {formatCurrency(referenceValues.pagosRef)}</span>
                <span>SUNAT: {formatCurrency(kpis.sunatPaid)} / {formatCurrency(referenceValues.sunatRef)}</span>
                <span>Gastos: {formatCurrency(kpis.expensesPaid)} / {formatCurrency(referenceValues.gastosRef)}</span>
              </div>
            </div>
          ) : null}

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
            accounts={accounts}
            categories={categories}
            responsibles={responsibles}
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
                    <FinanceKpiCard
                      title="Ingresos cobrados"
                      value={kpis.incomePaid}
                      tone="blue"
                      subtitle="Solo cancelados"
                      onClick={() => handleKpiClick("movimientos", "Cancelado", "Ingreso")}
                    />
                    <FinanceKpiCard
                      title="Caja total"
                      value={totalCash}
                      tone="green"
                      subtitle="Suma cuentas activas"
                      onClick={() => handleKpiClick("cuentas")}
                    />
                    <FinanceKpiCard
                      title="Pendiente por cobrar"
                      value={kpis.incomePending}
                      tone="amber"
                      subtitle="No impacta caja"
                      onClick={() => handleKpiClick("movimientos", "Pendiente", "Ingreso")}
                    />
                    <FinanceKpiCard
                      title="Gastos pagados"
                      value={kpis.expensesPaid}
                      tone="rose"
                      subtitle="Incluye SUNAT"
                      onClick={() => handleKpiClick("gastos", "Cancelado")}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FinanceKpiCard
                      title="Proyección ingresos"
                      value={projections.incomeProjection}
                      tone="blue"
                      subtitle="Confirmados + pendientes"
                      onClick={() => handleKpiClick("movimientos", "Pendiente", "Ingreso")}
                    />
                    <FinanceKpiCard
                      title="Proyección gastos"
                      value={projections.expenseProjection}
                      tone="rose"
                      subtitle="Pagados + pendientes"
                      onClick={() => handleKpiClick("gastos")}
                    />
                    <FinanceKpiCard
                      title="Utilidad proyectada"
                      value={projections.projectedProfit}
                      tone="green"
                      subtitle="Proyección del mes"
                    />
                    <FinanceKpiCard
                      title="Cash flow proyectado"
                      value={projections.projectedCash}
                      tone="slate"
                      subtitle="Caja esperada fin de mes"
                      onClick={() => handleKpiClick("cuentas")}
                    />
                  </div>
                  <div className="grid gap-4 lg:grid-cols-3">
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
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Clientes activos</h3>
                      <p className="text-xs text-slate-500">Ingresos vinculados a clientes.</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      onClick={() => setShowClientModal(true)}
                      disabled={isLocked}
                    >
                      Nuevo cliente
                    </button>
                  </div>
                  <FinanceTable
                    movements={filteredMovements}
                    onStatusChange={handleStatusChange}
                    disabled={isLocked}
                  />
                </div>
              ) : null}

              {activeTab === "pagos" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Contratos activos</h3>
                      <p className="text-xs text-slate-500">Pagos programados del mes.</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      onClick={() => setShowContractModal(true)}
                      disabled={isLocked}
                    >
                      Nuevo colaborador
                    </button>
                  </div>
                  <FinanceTable
                    movements={filteredMovements.filter((movement) => movement.type === "PagoColaborador")}
                    onStatusChange={handleStatusChange}
                    disabled={isLocked}
                  />
                </div>
              ) : null}

              {activeTab === "gastos" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white p-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Gastos fijos y variables</h3>
                      <p className="text-xs text-slate-500">Separados por tipo de gasto.</p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600"
                      onClick={openModal}
                      disabled={isLocked}
                    >
                      Nuevo gasto
                    </button>
                  </div>
                  <FinanceTable
                    movements={filteredMovements.filter((movement) =>
                      ["GastoFijo", "GastoVariable"].includes(movement.type)
                    )}
                    onStatusChange={handleStatusChange}
                    disabled={isLocked}
                  />
                </div>
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
                    {comparison ? (
                      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">Comparativo vs mes anterior</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <span>Ingresos: {comparison.income.toFixed(1)}%</span>
                          <span>Gastos: {comparison.expenses.toFixed(1)}%</span>
                          <span>Utilidad: {comparison.net.toFixed(1)}%</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
                    <h3 className="text-sm font-semibold text-slate-900">Checklist de cierre</h3>
                    <p className="text-xs text-slate-500">Acciones sugeridas antes de bloquear el mes.</p>
                    <button
                      type="button"
                      className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                      disabled={isLocked}
                      onClick={() => {
                        if (!user) return;
                        closeFinanceMonth({
                          monthKey: filters.monthKey,
                          closedBy: user.uid,
                          closedAt: new Date().toISOString(),
                          locked: true,
                          snapshot: {
                            monthKey: filters.monthKey,
                            incomePaid: kpis.incomePaid,
                            expensesPaid: kpis.expensesPaid,
                            netIncome: kpis.netIncome,
                          },
                        });
                        setClosures(listMonthClosures());
                      }}
                    >
                      {isLocked ? "Mes cerrado" : "Marcar mes como cerrado"}
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
        onSubmit={handleCreateMovement}
        accounts={accounts}
        categories={categories}
        responsibles={responsibles}
        clients={clients}
        collaborators={listFinanceCollaborators()}
        duplicateWarning={duplicateWarning}
        disabled={isLocked}
      />

      {showValidationModal ? (
        <ValidationModal
          onClose={() => setShowValidationModal(false)}
          onSave={(values) => {
            setReferenceValues(values);
            setValidationMode(true);
            setShowValidationModal(false);
          }}
        />
      ) : null}

      {showClientModal ? (
        <ClientModal
          onClose={() => setShowClientModal(false)}
          onSave={(client) => {
            const next = [client, ...clients];
            saveFinanceClients(next);
            setClients(next);
            setShowClientModal(false);
          }}
        />
      ) : null}

      {showContractModal ? (
        <ContractModal
          onClose={() => setShowContractModal(false)}
          onSave={(contract) => {
            const next = [contract, ...contracts];
            saveFinanceContracts(next);
            setContracts(next);
            setShowContractModal(false);
          }}
        />
      ) : null}
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

function ValidationModal({ onClose, onSave }: { onClose: () => void; onSave: (values: ValidationReference) => void }) {
  const [values, setValues] = useState({ ingresosRef: 0, pagosRef: 0, sunatRef: 0, gastosRef: 0 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <h3 className="text-lg font-semibold text-slate-900">Modo validación</h3>
        <p className="text-xs text-slate-500">Ingresa valores de referencia del Excel.</p>
        <div className="mt-4 grid gap-3">
          {(
            [
              { key: "ingresosRef", label: "Ingresos" },
              { key: "pagosRef", label: "Pagos" },
              { key: "sunatRef", label: "SUNAT" },
              { key: "gastosRef", label: "Gastos" },
            ] as const
          ).map((item) => (
            <label key={item.key} className="text-xs font-semibold text-slate-500">
              {item.label}
              <input
                className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
                type="number"
                value={values[item.key]}
                onChange={(event) => setValues({ ...values, [item.key]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => onSave(values)}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientModal({ onClose, onSave }: { onClose: () => void; onSave: (client: FinanceClient) => void }) {
  const [form, setForm] = useState({
    name: "",
    isRecurring: true,
    recurringAmount: 0,
    recurringDay: 1,
    defaultAccountTo: "LUIS",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <h3 className="text-lg font-semibold text-slate-900">Nuevo cliente</h3>
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Nombre
            <input
              className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white"
            onClick={() =>
              onSave({
                id: `client-${Date.now()}`,
                name: form.name,
                isRecurring: form.isRecurring,
                recurringAmount: form.recurringAmount,
                recurringDay: form.recurringDay,
                defaultAccountTo: form.defaultAccountTo as FinanceClient["defaultAccountTo"],
                active: true,
              })
            }
          >
            Guardar cliente
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractModal({ onClose, onSave }: { onClose: () => void; onSave: (contract: FinanceContract) => void }) {
  const [form, setForm] = useState({
    collaboratorName: "",
    amount: 0,
    frequency: "mensual",
    payDay: 1,
    defaultAccountFrom: "LUIS",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <h3 className="text-lg font-semibold text-slate-900">Nuevo contrato</h3>
        <div className="mt-4 grid gap-3">
          <label className="text-xs font-semibold text-slate-500">
            Colaborador
            <input
              className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.collaboratorName}
              onChange={(event) => setForm({ ...form, collaboratorName: event.target.value })}
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white"
            onClick={() =>
              onSave({
                id: `contract-${Date.now()}`,
                collaboratorId: `collab-${Date.now()}`,
                collaboratorName: form.collaboratorName,
                amount: form.amount,
                frequency: form.frequency as FinanceContract["frequency"],
                payDay: form.payDay,
                startDate: new Date().toISOString(),
                defaultAccountFrom: form.defaultAccountFrom as FinanceContract["defaultAccountFrom"],
                active: true,
              })
            }
          >
            Guardar contrato
          </button>
        </div>
      </div>
    </div>
  );
}
