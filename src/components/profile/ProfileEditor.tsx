"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, CalendarDays, CreditCard, Landmark, Mail, Phone, UserRound } from "lucide-react";
import type { UserProfile } from "@/services/firebase/types";

type ProfileTab = "personal" | "laboral";

type NameForm = Partial<UserProfile> & {
  firstName?: string;
  lastName?: string;
  middleName?: string;
};

interface ProfileEditorProps {
  user: UserProfile;
  onSave: (payload: Partial<UserProfile>) => void;
  canEditEmploymentStartDate?: boolean;
}

interface FieldProps {
  label: string;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function Field({ label, icon, className, children }: FieldProps) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClassName =
  "w-full rounded-xl border border-sky-100 bg-white/90 px-3 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-300 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100";

export default function ProfileEditor({ user, onSave, canEditEmploymentStartDate = false }: ProfileEditorProps) {
  const [tab, setTab] = useState<ProfileTab>("personal");
  const [form, setForm] = useState<NameForm>({});

  useEffect(() => {
    const parts = (user.displayName ?? "").trim().split(/\s+/);
    setForm({
      displayName: user.displayName,
      email: user.email,
      position: user.position,
      birthDate: user.birthDate ?? "",
      employmentStartDate: user.employmentStartDate ?? "",
      contractEndDate: user.contractEndDate ?? "",
      contractIndefinite: user.contractIndefinite ?? false,
      phone: user.phone ?? "",
      maritalStatus: user.maritalStatus ?? "Soltero",
      gender: user.gender ?? "No especificado",
      bankName: user.bankName ?? "",
      accountType: user.accountType ?? "",
      accountNumber: user.accountNumber ?? "",
      cci: user.cci ?? "",
      firstName: parts[0] ?? "",
      lastName: parts[1] ?? "",
      middleName: parts.slice(2).join(" "),
    });
  }, [user]);

  const canSave = useMemo(() => {
    return Boolean(form.displayName?.trim() || form.position?.trim());
  }, [form.displayName, form.position]);

  const setNamePart = (key: "firstName" | "lastName" | "middleName", value: string) => {
    const next = {
      ...form,
      [key]: value,
    };
    const displayName = `${next.firstName ?? ""} ${next.lastName ?? ""} ${next.middleName ?? ""}`.trim();
    setForm({ ...next, displayName });
  };

  const submit = () => {
    if (!canSave) return;
    onSave({
      displayName: form.displayName?.trim() ?? user.displayName,
      email: form.email?.trim() ?? user.email,
      position: form.position?.trim() ?? user.position,
      birthDate: form.birthDate ?? "",
      employmentStartDate: form.employmentStartDate ?? "",
      contractEndDate: form.contractIndefinite ? "" : form.contractEndDate ?? "",
      contractIndefinite: form.contractIndefinite ?? false,
      phone: form.phone ?? "",
      maritalStatus: form.maritalStatus ?? "",
      gender: form.gender ?? "",
      bankName: form.bankName ?? "",
      accountType: form.accountType ?? "",
      accountNumber: form.accountNumber ?? "",
      cci: form.cci ?? "",
    });
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/60 via-white to-sky-50/80 shadow-[0_20px_55px_rgba(8,145,178,0.12)]">
      <div className="border-b border-cyan-100/70 bg-white/80 px-5 py-4 md:px-7 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-lg shadow-cyan-200">
              <UserRound className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Mi perfil</h2>
              <p className="text-xs text-slate-500">Fuente principal sincronizada con administración y finanzas.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!canSave}
            className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Guardar cambios
          </button>
        </div>

        <div className="mt-4 inline-flex rounded-xl bg-cyan-100/70 p-1">
          {([
            ["personal", "Personal"],
            ["laboral", "Laboral y bancaria"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === key ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-cyan-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 md:px-7 md:py-6">
        {tab === "personal" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre" icon={<UserRound className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.firstName ?? ""} onChange={(e) => setNamePart("firstName", e.target.value)} />
            </Field>
            <Field label="Apellido paterno">
              <input className={inputClassName} value={form.lastName ?? ""} onChange={(e) => setNamePart("lastName", e.target.value)} />
            </Field>
            <Field label="Apellido materno">
              <input className={inputClassName} value={form.middleName ?? ""} onChange={(e) => setNamePart("middleName", e.target.value)} />
            </Field>
            <Field label="Fecha de nacimiento" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <input type="date" className={inputClassName} value={form.birthDate ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))} />
            </Field>
            <Field label="Correo" icon={<Mail className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.email ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </Field>
            <Field label="Teléfono" icon={<Phone className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.phone ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </Field>
            <Field label="Estado civil">
              <select className={inputClassName} value={form.maritalStatus ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}>
                <option>Soltero</option>
                <option>Casado</option>
                <option>Divorciado</option>
                <option>Viudo</option>
              </select>
            </Field>
            <Field label="Género">
              <select className={inputClassName} value={form.gender ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}>
                <option>No especificado</option>
                <option>Masculino</option>
                <option>Femenino</option>
              </select>
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Área / puesto" icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.position ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))} />
            </Field>
            <Field label="Inicio de contrato" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <input
                type="date"
                className={inputClassName}
                value={form.employmentStartDate ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, employmentStartDate: e.target.value }))}
                disabled={!canEditEmploymentStartDate}
                readOnly={!canEditEmploymentStartDate}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {canEditEmploymentStartDate
                  ? "Este dato se comparte con Finanzas para pagos de colaboradores."
                  : "Solo administradores pueden editar este dato."}
              </p>
            </Field>
            <Field label="Contrato indefinido">
              <select
                className={inputClassName}
                value={form.contractIndefinite ? "yes" : "no"}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    contractIndefinite: e.target.value === "yes",
                    contractEndDate: e.target.value === "yes" ? "" : prev.contractEndDate,
                  }))
                }
                disabled={!canEditEmploymentStartDate}
              >
                <option value="yes">Sí</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Fin de contrato" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              <input
                type="date"
                className={inputClassName}
                value={form.contractEndDate ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, contractEndDate: e.target.value }))}
                disabled={!canEditEmploymentStartDate || Boolean(form.contractIndefinite)}
                readOnly={!canEditEmploymentStartDate || Boolean(form.contractIndefinite)}
              />
            </Field>
            <Field label="Banco" icon={<Landmark className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.bankName ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))} />
            </Field>
            <Field label="Tipo de cuenta" icon={<Building2 className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.accountType ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, accountType: e.target.value }))} />
            </Field>
            <Field label="Número de cuenta" icon={<CreditCard className="h-3.5 w-3.5" />}>
              <input className={inputClassName} value={form.accountNumber ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))} />
            </Field>
            <Field label="CCI" className="md:col-span-2">
              <input className={inputClassName} value={form.cci ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, cci: e.target.value }))} />
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}
