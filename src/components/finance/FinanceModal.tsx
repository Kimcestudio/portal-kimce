"use client";

import { useMemo, useState } from "react";
import type { FinanceAccount, FinanceCategory, FinanceTransactionType } from "@/lib/finance/types";

export type NewFinanceTransaction = {
  type: FinanceTransactionType;
  amount: number;
  accountFrom?: string;
  accountTo?: string;
  responsible: string;
  category: string;
  description?: string;
  status: "pending" | "paid";
  date: string;
  referenceId?: string;
};

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewFinanceTransaction) => void;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  responsibles: string[];
  duplicateWarning?: string | null;
}

const defaultValue = () => ({
  type: "expense" as FinanceTransactionType,
  amount: 0,
  accountFrom: "",
  accountTo: "",
  responsible: "",
  category: "General",
  description: "",
  status: "pending" as const,
  date: new Date().toISOString().slice(0, 10),
  referenceId: "",
});

export default function FinanceModal({
  isOpen,
  onClose,
  onSubmit,
  accounts,
  categories,
  responsibles,
  duplicateWarning,
}: FinanceModalProps) {
  const [form, setForm] = useState(defaultValue());

  const categoryOptions = useMemo(() => {
    if (form.type === "income") {
      return categories.filter((item) => item.type === "income" || item.type === "all");
    }
    if (form.type === "expense" || form.type === "collaborator_payment" || form.type === "tax") {
      return categories.filter((item) =>
        ["expense", "collaborator_payment", "tax", "all"].includes(item.type)
      );
    }
    return categories;
  }, [categories, form.type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo movimiento</h3>
            <p className="text-xs text-slate-500">Registra ingresos, gastos o transferencias.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
            onClick={() => {
              setForm(defaultValue());
              onClose();
            }}
          >
            Cerrar
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.type}
              onChange={(event) => setForm({ ...form, type: event.target.value as FinanceTransactionType })}
            >
              <option value="income">Ingreso</option>
              <option value="expense">Gasto</option>
              <option value="collaborator_payment">Pago colaborador</option>
              <option value="transfer">Transferencia</option>
              <option value="tax">Impuesto</option>
              <option value="refund">Reembolso</option>
            </select>
          </Field>
          <Field label="Monto">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
            />
          </Field>
          <Field label="Cuenta origen">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.accountFrom}
              onChange={(event) => setForm({ ...form, accountFrom: event.target.value })}
            >
              <option value="">-</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cuenta destino">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.accountTo}
              onChange={(event) => setForm({ ...form, accountTo: event.target.value })}
            >
              <option value="">-</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsable">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.responsible}
              onChange={(event) => setForm({ ...form, responsible: event.target.value })}
            >
              <option value="">-</option>
              {responsibles.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Categoría">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.label}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as "pending" | "paid" })}
            >
              <option value="pending">Pendiente</option>
              <option value="paid">Cancelado</option>
            </select>
          </Field>
          <Field label="Fecha">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </Field>
          <Field label="Referencia">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="text"
              value={form.referenceId}
              onChange={(event) => setForm({ ...form, referenceId: event.target.value })}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Descripción">
            <textarea
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
        </div>
        {duplicateWarning ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            {duplicateWarning}
          </div>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={() => {
              setForm(defaultValue());
              onClose();
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
            onClick={() => onSubmit(form)}
          >
            Guardar movimiento
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
      {label}
      {children}
    </label>
  );
}
