import type { FinanceAccount, FinanceCategory, FinanceFilters } from "@/lib/finance/types";
import { buildMonthOptions } from "@/lib/finance/utils";

interface FinanceFilterBarProps {
  filters: FinanceFilters;
  onChange: (filters: FinanceFilters) => void;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  responsibles: string[];
}

export default function FinanceFilterBar({
  filters,
  onChange,
  accounts,
  categories,
  responsibles,
}: FinanceFilterBarProps) {
  const monthOptions = buildMonthOptions(8);

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
          { value: "Pendiente", label: "Pendiente" },
          { value: "Cancelado", label: "Cancelado" },
        ]}
      />
      <Select
        label="Tipo"
        value={filters.type}
        onChange={(value) => onChange({ ...filters, type: value as FinanceFilters["type"] })}
        options={[
          { value: "all", label: "Todos" },
          { value: "Ingreso", label: "Ingreso" },
          { value: "PagoColaborador", label: "Pago colaborador" },
          { value: "GastoFijo", label: "Gasto fijo" },
          { value: "GastoVariable", label: "Gasto variable" },
          { value: "Transferencia", label: "Transferencia" },
          { value: "Fondo", label: "Fondo" },
        ]}
      />
      <Select
        label="Cuenta"
        value={filters.account}
        onChange={(value) => onChange({ ...filters, account: value as FinanceFilters["account"] })}
        options={[
          { value: "all", label: "Todas" },
          ...accounts.map((account) => ({ value: account.id, label: account.name })),
        ]}
      />
      <Select
        label="Responsable"
        value={filters.responsible}
        onChange={(value) => onChange({ ...filters, responsible: value })}
        options={[{ value: "all", label: "Todos" }, ...responsibles.map((name) => ({ value: name, label: name }))]}
      />
      <Select
        label="Categoría"
        value={filters.category}
        onChange={(value) => onChange({ ...filters, category: value })}
        options={[
          { value: "all", label: "Todas" },
          ...categories.map((category) => ({ value: category.label, label: category.label })),
        ]}
      />
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
