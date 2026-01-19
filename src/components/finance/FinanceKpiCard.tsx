import Card from "@/components/ui/Card";
import { formatCurrency } from "@/lib/finance/utils";

interface FinanceKpiCardProps {
  title: string;
  value: number;
  tone?: "blue" | "green" | "amber" | "rose" | "slate";
  subtitle?: string;
}

const toneStyles: Record<NonNullable<FinanceKpiCardProps["tone"]>, string> = {
  blue: "bg-gradient-to-br from-[#eef2ff] via-[#e0e7ff] to-white",
  green: "bg-gradient-to-br from-[#ecfdf3] via-[#dcfce7] to-white",
  amber: "bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-white",
  rose: "bg-gradient-to-br from-[#fff1f2] via-[#ffe4e6] to-white",
  slate: "bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-white",
};

export default function FinanceKpiCard({ title, value, subtitle, tone = "slate" }: FinanceKpiCardProps) {
  return (
    <Card className={`border border-transparent ${toneStyles[tone]}`}>
      <div className="space-y-2 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <p className="text-2xl font-semibold text-slate-900">{formatCurrency(value)}</p>
        {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </Card>
  );
}
