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
    <section className={`rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_28px_rgba(79,70,229,0.06)] ${className}`}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}
