"use client";

import { useMemo, useState } from "react";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceClient,
  FinanceCollaborator,
  FinanceMovementType,
} from "@/lib/finance/types";

export type NewFinanceMovement = {
  type: FinanceMovementType;
  amount: number;
  accountFrom?: string;
  accountTo?: string;
  responsible: string;
  category: string;
  description?: string;
  status: "Pendiente" | "Cancelado";
  date: string;
  referenceCode?: string;
  clientId?: string;
  clientName?: string;
  collaboratorId?: string;
};

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewFinanceMovement) => void;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  responsibles: string[];
  clients: FinanceClient[];
  collaborators: FinanceCollaborator[];
  duplicateWarning?: string | null;
  disabled?: boolean;
}

const defaultValue = () => ({
  type: "GastoVariable" as FinanceMovementType,
  amount: 0,
  accountFrom: "",
  accountTo: "",
  responsible: "",
  category: "General",
  description: "",
  status: "Pendiente" as const,
  date: new Date().toISOString().slice(0, 10),
  referenceCode: "",
  clientId: "",
  clientName: "",
  collaboratorId: "",
});

export default function FinanceModal({
  isOpen,
  onClose,
  onSubmit,
  accounts,
  categories,
  responsibles,
  clients,
  collaborators,
  duplicateWarning,
  disabled,
}: FinanceModalProps) {
  const [form, setForm] = useState(defaultValue());

  const categoryOptions = useMemo(() => {
    if (form.type === "Ingreso") {
      return categories.filter((item) => item.type === "income" || item.type === "all");
    }
    if (form.type === "PagoColaborador" || form.type === "GastoFijo" || form.type === "GastoVariable") {
      return categories.filter((item) => item.type === "expense" || item.type === "all");
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
            disabled={disabled}
          >
            Cerrar
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as FinanceMovementType,
                  category: "General",
                })
              }
              disabled={disabled}
            >
              <option value="Ingreso">Ingreso</option>
              <option value="PagoColaborador">Pago colaborador</option>
              <option value="GastoFijo">Gasto fijo</option>
              <option value="GastoVariable">Gasto variable</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Fondo">Fondo</option>
            </select>
          </Field>
          <Field label="Monto">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
              disabled={disabled}
            />
          </Field>
          {form.type === "Ingreso" ? (
            <Field label="Cliente">
              <select
                className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
                value={form.clientId}
                onChange={(event) => {
                  const client = clients.find((item) => item.id === event.target.value);
                  setForm({
                    ...form,
                    clientId: event.target.value,
                    clientName: client?.name ?? "",
                  });
                }}
                disabled={disabled}
              >
                <option value="">-</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {form.type === "PagoColaborador" ? (
            <Field label="Colaborador">
              <select
                className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
                value={form.collaboratorId}
                onChange={(event) => setForm({ ...form, collaboratorId: event.target.value })}
                disabled={disabled}
              >
                <option value="">-</option>
                {collaborators.map((collaborator) => (
                  <option key={collaborator.id} value={collaborator.id}>
                    {collaborator.displayName}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Cuenta origen">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.accountFrom}
              onChange={(event) => setForm({ ...form, accountFrom: event.target.value })}
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              onChange={(event) => setForm({ ...form, status: event.target.value as "Pendiente" | "Cancelado" })}
              disabled={disabled}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </Field>
          <Field label="Fecha">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Referencia">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="text"
              value={form.referenceCode}
              onChange={(event) => setForm({ ...form, referenceCode: event.target.value })}
              disabled={disabled}
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
              disabled={disabled}
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
            disabled={disabled}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
            onClick={() => onSubmit(form)}
            disabled={disabled}
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
