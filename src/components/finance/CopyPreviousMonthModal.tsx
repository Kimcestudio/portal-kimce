"use client";

import { useMemo, useState } from "react";
import type { CollaboratorPayment, Expense, FinanceMovement } from "@/lib/finance/types";
import { formatCurrency, formatShortDate, getStatusLabel } from "@/lib/finance/utils";

type TabKey = "movements" | "expenses" | "payments";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    movementIds: string[];
    expenseIds: string[];
    paymentIds: string[];
    keepStatus: boolean;
  }) => Promise<void>;
  movements: FinanceMovement[];
  expenses: Expense[];
  payments: CollaboratorPayment[];
  loading?: boolean;
}

export default function CopyPreviousMonthModal({
  isOpen,
  onClose,
  onConfirm,
  movements,
  expenses,
  payments,
  loading,
}: Props) {
  const [tab, setTab] = useState<TabKey>("movements");
  const [keepStatus, setKeepStatus] = useState(false);
  const [movementCategory, setMovementCategory] = useState("all");
  const [expenseCategory, setExpenseCategory] = useState("all");
  const [selectedMovements, setSelectedMovements] = useState<Set<string>>(new Set());
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set());

  const movementCategories = useMemo(
    () => ["all", ...Array.from(new Set(movements.map((item) => item.projectService || "Sin categoría")))],
    [movements],
  );
  const expenseCategories = useMemo(
    () => ["all", ...Array.from(new Set(expenses.map((item) => item.categoria)))],
    [expenses],
  );

  const recurrentMovements = movements.filter((m) => m.recurring?.enabled && (movementCategory === "all" || (m.projectService || "Sin categoría") === movementCategory));
  const nonRecurrentMovements = movements.filter((m) => !m.recurring?.enabled && (movementCategory === "all" || (m.projectService || "Sin categoría") === movementCategory));
  const recurrentExpenses = expenses.filter((e) => e.tipoGasto === "FIJO" && (expenseCategory === "all" || e.categoria === expenseCategory));
  const nonRecurrentExpenses = expenses.filter((e) => e.tipoGasto !== "FIJO" && (expenseCategory === "all" || e.categoria === expenseCategory));
  const recurrentPayments = payments.filter((p) => p.isRecurring === true);
  const nonRecurrentPayments = payments.filter((p) => p.isRecurring !== true);

  const toggle = (setter: (value: Set<string>) => void, current: Set<string>, id: string) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const selectAll = (setter: (value: Set<string>) => void, current: Set<string>, ids: string[]) => {
    const allSelected = ids.every((id) => current.has(id));
    const next = new Set(current);
    ids.forEach((id) => {
      if (allSelected) next.delete(id);
      else next.add(id);
    });
    setter(next);
  };

  const selectedCount = selectedMovements.size + selectedExpenses.size + selectedPayments.size;

  if (!isOpen) return null;

  const renderGroup = (
    title: string,
    items: Array<{ id: string; label: string; amount: number; status: string; date?: string }>,
    selected: Set<string>,
    setSelected: (value: Set<string>) => void,
  ) => (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600">{title}</p>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <input
            type="checkbox"
            checked={items.length > 0 && items.every((item) => selected.has(item.id))}
            onChange={() => selectAll(setSelected, selected, items.map((item) => item.id))}
          />
          Seleccionar todo
        </label>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <label key={item.id} className="flex items-start gap-2 rounded-lg border border-slate-100 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              onChange={() => toggle(setSelected, selected, item.id)}
            />
            <span className="flex-1">
              <span className="block font-semibold text-slate-700">{item.label}</span>
              <span className="block text-slate-500">{formatCurrency(item.amount)} · {getStatusLabel(item.status as never)}{item.date ? ` · ${formatShortDate(item.date)}` : ""}</span>
            </span>
          </label>
        ))}
        {items.length === 0 ? <p className="text-xs text-slate-400">Sin elementos.</p> : null}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Copiar elementos del mes anterior</h3>
        <div className="mt-3 flex gap-2 text-xs font-semibold">
          {(["movements", "expenses", "payments"] as TabKey[]).map((key) => (
            <button key={key} type="button" className={`rounded-full px-3 py-1 ${tab === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} onClick={() => setTab(key)}>
              {key === "movements" ? "Movimientos" : key === "expenses" ? "Gastos" : "Pagos colaboradores"}
            </button>
          ))}
        </div>

        {tab === "movements" ? (
          <div className="mt-4 space-y-3">
            <select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={movementCategory} onChange={(e) => setMovementCategory(e.target.value)}>
              {movementCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            {renderGroup("Recurrentes", recurrentMovements.map((m) => ({ id: m.id, label: `${m.clientName} · ${m.projectService || "-"}`, amount: m.amount, status: m.status, date: m.incomeDate })), selectedMovements, setSelectedMovements)}
            {renderGroup("No recurrentes", nonRecurrentMovements.map((m) => ({ id: m.id, label: `${m.clientName} · ${m.projectService || "-"}`, amount: m.amount, status: m.status, date: m.incomeDate })), selectedMovements, setSelectedMovements)}
          </div>
        ) : null}

        {tab === "expenses" ? (
          <div className="mt-4 space-y-3">
            <select className="rounded-lg border border-slate-200 px-2 py-1 text-xs" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)}>
              {expenseCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            {renderGroup("Recurrentes", recurrentExpenses.map((e) => ({ id: e.id, label: `${e.descripcion} · ${e.categoria}`, amount: e.monto, status: e.status, date: e.fechaGasto })), selectedExpenses, setSelectedExpenses)}
            {renderGroup("No recurrentes", nonRecurrentExpenses.map((e) => ({ id: e.id, label: `${e.descripcion} · ${e.categoria}`, amount: e.monto, status: e.status, date: e.fechaGasto })), selectedExpenses, setSelectedExpenses)}
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="mt-4 space-y-3">
            {renderGroup("Recurrentes", recurrentPayments.map((p) => ({ id: p.id, label: `${p.colaboradorId} · ${p.periodo}`, amount: p.montoFinal, status: p.status, date: p.fechaPago })), selectedPayments, setSelectedPayments)}
            {renderGroup("No recurrentes", nonRecurrentPayments.map((p) => ({ id: p.id, label: `${p.colaboradorId} · ${p.periodo}`, amount: p.montoFinal, status: p.status, date: p.fechaPago })), selectedPayments, setSelectedPayments)}
          </div>
        ) : null}

        <div className="mt-4 space-y-1 text-xs text-slate-500">
          <p>{selectedCount} seleccionados</p>
          <p>Se copiarán: Movimientos: {selectedMovements.size}, Gastos: {selectedExpenses.size}, Pagos: {selectedPayments.size}</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={keepStatus} onChange={(e) => setKeepStatus(e.target.checked)} />
            Mantener estado
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="rounded-lg bg-[#4f56d3] px-3 py-2 text-sm font-semibold text-white"
            disabled={loading || selectedCount === 0}
            onClick={() => onConfirm({
              movementIds: Array.from(selectedMovements),
              expenseIds: Array.from(selectedExpenses),
              paymentIds: Array.from(selectedPayments),
              keepStatus,
            })}
          >
            {loading ? "Copiando..." : "Copiar seleccionados"}
          </button>
        </div>
      </div>
    </div>
  );
}
