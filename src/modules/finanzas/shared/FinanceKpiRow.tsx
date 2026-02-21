import type { ComponentProps } from "react";
import FinanceKpiCard from "@/components/finance/FinanceKpiCard";

type KpiTone = ComponentProps<typeof FinanceKpiCard>["tone"];

export interface FinanceKpiItem {
  title: string;
  value: number;
  tone: KpiTone;
}

interface FinanceKpiRowProps {
  items: FinanceKpiItem[];
}

export default function FinanceKpiRow({ items }: FinanceKpiRowProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item) => (
        <FinanceKpiCard key={item.title} title={item.title} value={item.value} tone={item.tone} />
      ))}
    </div>
  );
}
