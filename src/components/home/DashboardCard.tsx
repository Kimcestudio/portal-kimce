import type { ReactNode } from "react";

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function DashboardCard({ title, subtitle, rightSlot, children, className = "" }: DashboardCardProps) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 shadow-soft ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          {subtitle ? <p className="text-xs text-muted">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}
