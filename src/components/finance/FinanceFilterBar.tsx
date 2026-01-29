import type { FinanceFilters } from "@/lib/finance/types";
import { buildMonthOptions } from "@/lib/finance/utils";

interface FinanceFilterBarProps {
  filters: FinanceFilters;
  onChange: (filters: FinanceFilters) => void;
}

export default function FinanceFilterBar({ filters, onChange }: FinanceFilterBarProps) {
  const monthOptions = buildMonthOptions();

  return (
    <div className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <Select
        label="Mes"
        value={filters.monthKey}
        onChange={(value) => onChange({ ...filters, monthKey: value })}
        options={monthOptions}
      />
      <Select
        label="Estado"
        value={filters.status}
        onChange={(value) => onChange({ ...filters, status: value as FinanceFilters["status"] })}
        options={[
          { value: "all", label: "Todo" },
          { value: "pending", label: "Pendiente" },
          { value: "cancelled", label: "Cancelado" },
        ]}
      />
      <Select
        label="Cuenta"
        value={filters.account}
        onChange={(value) => onChange({ ...filters, account: value as FinanceFilters["account"] })}
        options={[
          { value: "all", label: "Todas" },
          { value: "LUIS", label: "Luis" },
          { value: "ALONDRA", label: "Alondra" },
          { value: "KIMCE", label: "Kimce" },
        ]}
      />
      <label className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border border-slate-300"
          checked={filters.includeCancelled}
          onChange={(event) => onChange({ ...filters, includeCancelled: event.target.checked })}
        />
        Incluir cancelados
      </label>
    </div>
  );
}

interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <label className="flex min-w-[160px] flex-1 flex-col gap-2 text-xs font-semibold text-slate-500">
      {label}
      <select
        className="rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm font-medium text-slate-700"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
