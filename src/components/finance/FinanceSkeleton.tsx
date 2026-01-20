export default function FinanceSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60" />
        <div className="h-72 animate-pulse rounded-2xl bg-slate-200/60" />
      </div>
    </div>
  );
}
