import { formatCurrency } from "@/lib/finance/utils";

interface FinanceHeroCardProps {
  title: string;
  incomeLabel: string;
  expensesLabel: string;
  cashFlowLabel: string;
  netLabel: string;
  marginLabel: string;
  incomePaid: number;
  expensesPaid: number;
  cashFlow: number;
  netIncome: number;
  margin: number;
}

export default function FinanceHeroCard({
  title,
  incomeLabel,
  expensesLabel,
  cashFlowLabel,
  netLabel,
  marginLabel,
  incomePaid,
  expensesPaid,
  cashFlow,
  netIncome,
  margin,
}: FinanceHeroCardProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#3b4bd8] via-[#4338ca] to-[#1e1b4b] p-6 text-white shadow-[0_20px_50px_rgba(67,56,202,0.35)]">
      <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/3 translate-x-1/4 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute bottom-0 left-0 h-32 w-32 -translate-x-1/3 translate-y-1/4 rounded-full bg-white/10 blur-2xl" />
      <div className="relative z-10 space-y-3">
        <div className="text-xs uppercase tracking-[0.3em] text-white/70">{title}</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs text-white/70">{incomeLabel}</p>
            <p className="text-xl font-semibold">{formatCurrency(incomePaid)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">{expensesLabel}</p>
            <p className="text-xl font-semibold">{formatCurrency(expensesPaid)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">{cashFlowLabel}</p>
            <p className="text-xl font-semibold">{formatCurrency(cashFlow)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">{netLabel}</p>
            <p className="text-xl font-semibold">{formatCurrency(netIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-white/70">{marginLabel}</p>
            <p className="text-xl font-semibold">{margin.toFixed(1)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
