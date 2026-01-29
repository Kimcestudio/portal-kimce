import Badge from "@/components/ui/Badge";
import type { FinanceMovement } from "@/lib/finance/types";
import { formatCurrency, getStatusLabel, getStatusTone } from "@/lib/finance/utils";

interface FinancePendingListProps {
  title: string;
  items: FinanceMovement[];
  emptyLabel: string;
}

export default function FinancePendingList({ title, items, emptyLabel }: FinancePendingListProps) {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Badge tone={getStatusTone("pending")} label={getStatusLabel("pending")} />
      </div>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-xs text-slate-500">{emptyLabel}</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-slate-900">{item.clientName}</p>
                <p className="text-xs text-slate-500">{item.reference ?? item.projectService ?? "-"}</p>
              </div>
              <span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
