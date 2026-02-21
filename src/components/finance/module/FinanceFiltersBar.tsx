import FinanceFilterBar from "@/components/finance/FinanceFilterBar";
import type { FinanceFilters } from "@/lib/finance/types";

interface FinanceFiltersBarProps {
  filters: FinanceFilters;
  onChange: (filters: FinanceFilters) => void;
}

export default function FinanceFiltersBar({ filters, onChange }: FinanceFiltersBarProps) {
  return <FinanceFilterBar filters={filters} onChange={onChange} />;
}
