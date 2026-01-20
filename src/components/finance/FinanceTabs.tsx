import type { FinanceTabKey } from "@/lib/finance/types";

const tabs: { key: FinanceTabKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "movimientos", label: "Movimientos" },
  { key: "pagos", label: "Pagos a colaboradores" },
  { key: "gastos", label: "Gastos" },
  { key: "cuentas", label: "Cuentas & Caja" },
  { key: "cierre", label: "Cierre de mes" },
];

interface FinanceTabsProps {
  active: FinanceTabKey;
  onChange: (key: FinanceTabKey) => void;
}

export default function FinanceTabs({ active, onChange }: FinanceTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl bg-white/70 p-2 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ease-out ${
            active === tab.key
              ? "bg-[#4f56d3] text-white shadow-[0_12px_24px_rgba(79,70,229,0.35)]"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
