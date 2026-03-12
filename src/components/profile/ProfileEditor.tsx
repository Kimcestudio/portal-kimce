"use client";

import { useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/services/firebase/types";

type ProfileTab = "personal" | "laboral";

interface ProfileEditorProps {
  user: UserProfile;
  onSave: (payload: Partial<UserProfile>) => void;
}

export default function ProfileEditor({ user, onSave }: ProfileEditorProps) {
  const [tab, setTab] = useState<ProfileTab>("personal");
  const [form, setForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    const parts = (user.displayName ?? "").trim().split(/\s+/);
    setForm({
      displayName: user.displayName,
      email: user.email,
      position: user.position,
      birthDate: user.birthDate ?? "",
      phone: user.phone ?? "",
      maritalStatus: user.maritalStatus ?? "Soltero",
      gender: user.gender ?? "No especificado",
      bankName: user.bankName ?? "",
      accountType: user.accountType ?? "",
      accountNumber: user.accountNumber ?? "",
      cci: user.cci ?? "",
      // auxiliares en displayName simple
      firstName: parts[0] ?? "",
      lastName: parts[1] ?? "",
      middleName: parts.slice(2).join(" "),
    } as Partial<UserProfile> & Record<string, string>);
  }, [user]);

  const canSave = useMemo(() => {
    return Boolean(form.displayName?.toString().trim() || form.position?.toString().trim());
  }, [form.displayName, form.position]);

  const setNamePart = (key: "firstName" | "lastName" | "middleName", value: string) => {
    const next = {
      ...(form as Record<string, string>),
      [key]: value,
    };
    const displayName = `${next.firstName ?? ""} ${next.lastName ?? ""} ${next.middleName ?? ""}`.trim();
    setForm((prev) => ({ ...prev, ...next, displayName }));
  };

  const submit = () => {
    if (!canSave) return;
    const payload: Partial<UserProfile> = {
      displayName: form.displayName?.toString().trim() ?? user.displayName,
      email: form.email?.toString().trim() ?? user.email,
      position: form.position?.toString().trim() ?? user.position,
      birthDate: form.birthDate?.toString() ?? "",
      phone: form.phone?.toString() ?? "",
      maritalStatus: form.maritalStatus?.toString() ?? "",
      gender: form.gender?.toString() ?? "",
      bankName: form.bankName?.toString() ?? "",
      accountType: form.accountType?.toString() ?? "",
      accountNumber: form.accountNumber?.toString() ?? "",
      cci: form.cci?.toString() ?? "",
    };
    onSave(payload);
  };

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Mi perfil</h2>
          <p className="text-xs text-slate-500">Tu perfil es la fuente principal para administración y finanzas.</p>
        </div>
        <button type="button" onClick={submit} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">
          Guardar cambios
        </button>
      </div>

      <div className="mt-4 flex gap-2 border-b border-slate-200 pb-2">
        <button type="button" className={`rounded-lg px-3 py-1 text-xs font-semibold ${tab === "personal" ? "bg-indigo-100 text-indigo-700" : "text-slate-500"}`} onClick={() => setTab("personal")}>Personal</button>
        <button type="button" className={`rounded-lg px-3 py-1 text-xs font-semibold ${tab === "laboral" ? "bg-indigo-100 text-indigo-700" : "text-slate-500"}`} onClick={() => setTab("laboral")}>Laboral</button>
      </div>

      {tab === "personal" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">Nombre
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={(form as any).firstName ?? ""} onChange={(e) => setNamePart("firstName", e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Apellido paterno
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={(form as any).lastName ?? ""} onChange={(e) => setNamePart("lastName", e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Apellido materno
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={(form as any).middleName ?? ""} onChange={(e) => setNamePart("middleName", e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Fecha de nacimiento
            <input type="date" className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.birthDate?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Correo
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.email?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Teléfono
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.phone?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Estado civil
            <select className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.maritalStatus?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}>
              <option>Soltero</option><option>Casado</option><option>Divorciado</option><option>Viudo</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Género
            <select className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.gender?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}>
              <option>No especificado</option><option>Masculino</option><option>Femenino</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-500">Área / puesto
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.position?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, position: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Banco
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.bankName?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Tipo de cuenta
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.accountType?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, accountType: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500">Número de cuenta
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.accountNumber?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, accountNumber: e.target.value }))} />
          </label>
          <label className="text-xs font-semibold text-slate-500 md:col-span-2">CCI
            <input className="mt-2 w-full rounded-xl border border-slate-200/60 px-3 py-2 text-sm" value={form.cci?.toString() ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, cci: e.target.value }))} />
          </label>
        </div>
      )}
    </div>
  );
}
