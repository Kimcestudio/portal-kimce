import Card from "@/components/ui/Card";

interface FinanceChartCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function FinanceChartCard({ title, description, children }: FinanceChartCardProps) {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? <p className="text-xs text-slate-500">{description}</p> : null}
        </div>
        {children}
      </div>
    </Card>
  );
}
