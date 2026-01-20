"use client";

import { useState } from "react";
import { isFinanceUnlocked, lockFinance, unlockFinance, verifyFinanceKey } from "@/services/firebase/finance";

export default function FinanceGate({ children }: { children: React.ReactNode }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(isFinanceUnlocked());
  const [loading, setLoading] = useState(false);

  const handleUnlock = async () => {
    setLoading(true);
    const valid = await verifyFinanceKey(pin);
    if (valid) {
      unlockFinance();
      setUnlocked(true);
      setError(null);
    } else {
      setError("Clave inválida.");
    }
    setLoading(false);
  };

  if (!unlocked) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-[0_8px_24px_rgba(17,24,39,0.08)]">
        <h2 className="text-base font-semibold text-slate-900">Zona restringida</h2>
        <p className="text-xs text-slate-500">Ingresa la clave de finanzas para continuar.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            className="rounded-xl border border-slate-200/60 px-3 py-2 text-sm"
            type="password"
            value={pin}
            onChange={(event) => setPin(event.target.value)}
            placeholder="Clave"
          />
          <button
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={handleUnlock}
            type="button"
            disabled={loading}
          >
            {loading ? "Validando..." : "Desbloquear"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        className="rounded-full border border-slate-200/60 px-3 py-1 text-xs font-semibold text-slate-500"
        onClick={() => {
          lockFinance();
          setUnlocked(false);
        }}
        type="button"
      >
        Bloquear finanzas
      </button>
      {children}
    </div>
  );
}
