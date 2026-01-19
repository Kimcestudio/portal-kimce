interface BadgeProps {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}

const toneStyles: Record<NonNullable<BadgeProps["tone"]>, string> = {
  success: "bg-green-100 text-green-700 shadow-[0_2px_8px_rgba(34,197,94,0.25)]",
  warning: "bg-amber-100 text-amber-700 shadow-[0_2px_8px_rgba(245,158,11,0.25)]",
  danger: "bg-rose-100 text-rose-700 shadow-[0_2px_8px_rgba(244,63,94,0.25)]",
  info: "bg-teal-100 text-teal-700 shadow-[0_2px_8px_rgba(20,184,166,0.25)]",
  neutral: "bg-slate-100 text-slate-600 shadow-[0_2px_8px_rgba(100,116,139,0.2)]",
};

export default function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${toneStyles[tone]}`}>
      {label}
    </span>
  );
}
