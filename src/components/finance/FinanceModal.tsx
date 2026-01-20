"use client";

import { useMemo, useState } from "react";
import type { FinanceAccountName, FinanceStatus } from "@/lib/finance/types";

export type NewIncomePayload = {
  clientName: string;
  projectService?: string;
  amount: number;
  incomeDate: string;
  expectedPayDate?: string;
  accountDestination: FinanceAccountName;
  responsible: FinanceAccountName;
  status: FinanceStatus;
  reference?: string;
  notes?: string;
};

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: NewIncomePayload) => void;
  disabled?: boolean;
}

const defaultValue = () => ({
  clientName: "",
  projectService: "",
  amount: 0,
  incomeDate: new Date().toISOString().slice(0, 10),
  expectedPayDate: "",
  accountDestination: "LUIS" as FinanceAccountName,
  responsible: "LUIS" as FinanceAccountName,
  status: "PENDIENTE" as FinanceStatus,
  reference: "",
  notes: "",
});

export default function FinanceModal({ isOpen, onClose, onSubmit, disabled }: FinanceModalProps) {
  const [form, setForm] = useState(defaultValue());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isValid = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    if (!form.clientName.trim()) nextErrors.clientName = "Cliente es requerido";
    if (!form.incomeDate) nextErrors.incomeDate = "Fecha requerida";
    if (form.amount < 0 || Number.isNaN(form.amount)) nextErrors.amount = "Monto inválido";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }, [form]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-[0_30px_60px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Nuevo ingreso</h3>
            <p className="text-xs text-slate-500">Registra un ingreso y asocia el cliente.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500"
            onClick={() => {
              setForm(defaultValue());
              setErrors({});
              onClose();
            }}
            disabled={disabled}
          >
            Cancelar
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              placeholder="Ej: Belcorp"
              value={form.clientName}
              onChange={(event) => setForm({ ...form, clientName: event.target.value })}
              disabled={disabled}
            />
            {errors.clientName ? <ErrorText message={errors.clientName} /> : null}
          </Field>
          <Field label="Proyecto/Servicio">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              placeholder="Ej: Marketing"
              value={form.projectService}
              onChange={(event) => setForm({ ...form, projectService: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Monto">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="number"
              placeholder="0"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })}
              disabled={disabled}
            />
            {errors.amount ? <ErrorText message={errors.amount} /> : null}
          </Field>
          <Field label="Fecha de ingreso">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="date"
              value={form.incomeDate}
              onChange={(event) => setForm({ ...form, incomeDate: event.target.value })}
              disabled={disabled}
            />
            {errors.incomeDate ? <ErrorText message={errors.incomeDate} /> : null}
          </Field>
          <Field label="Fecha de pago esperada">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              type="date"
              value={form.expectedPayDate}
              onChange={(event) => setForm({ ...form, expectedPayDate: event.target.value })}
              disabled={disabled}
            />
          </Field>
          <Field label="Cuenta destino">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.accountDestination}
              onChange={(event) =>
                setForm({ ...form, accountDestination: event.target.value as FinanceAccountName })
              }
              disabled={disabled}
            >
              <option value="LUIS">Luis</option>
              <option value="ALONDRA">Alondra</option>
              <option value="KIMCE">Kimce</option>
            </select>
          </Field>
          <Field label="Responsable">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.responsible}
              onChange={(event) => setForm({ ...form, responsible: event.target.value as FinanceAccountName })}
              disabled={disabled}
            >
              <option value="LUIS">Luis</option>
              <option value="ALONDRA">Alondra</option>
              <option value="KIMCE">Kimce</option>
            </select>
          </Field>
          <Field label="Estado">
            <select
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as FinanceStatus })}
              disabled={disabled}
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </Field>
          <Field label="Referencia / código interno">
            <input
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              placeholder="REF-VENTA-001"
              value={form.reference}
              onChange={(event) => setForm({ ...form, reference: event.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Notas">
            <textarea
              className="w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
              rows={3}
              placeholder="Observaciones…"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              disabled={disabled}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
            onClick={() => {
              setForm(defaultValue());
              setErrors({});
              onClose();
            }}
            disabled={disabled}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#4f56d3] px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(79,70,229,0.3)]"
            onClick={() => {
              if (!isValid) return;
              onSubmit(form);
              setForm(defaultValue());
              setErrors({});
            }}
            disabled={disabled || !isValid}
          >
            Guardar
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

function ErrorText({ message }: { message: string }) {
  return <span className="text-xs text-rose-600">{message}</span>;
}
