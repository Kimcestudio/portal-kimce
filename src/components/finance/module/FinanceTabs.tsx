import type { FinanceTabKey } from "@/lib/finance/types";

const tabs: Array<{ key: FinanceTabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "movimientos", label: "Movimientos" },
  { key: "pagos", label: "Pagos a colaboradores" },
  { key: "gastos", label: "Gastos" },
  { key: "cuentas", label: "Cuentas & Caja" },
  { key: "cierre", label: "Cierre de mes" },
];

interface FinanceTabsProps {
  active: FinanceTabKey;
  onChange: (tab: FinanceTabKey) => void;
}

export default function FinanceTabs({ active, onChange }: FinanceTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
            active === tab.key
              ? "bg-slate-900 text-white"
              : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
