import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  variant?: "default" | "elevated" | "accent";
  className?: string;
}

const variantStyles = {
  default: "bg-white border border-slate-200/60 shadow-[0_8px_24px_rgba(17,24,39,0.06)]",
  elevated: "bg-white border border-slate-200/40 shadow-[0_12px_32px_rgba(17,24,39,0.12)]",
  accent: "bg-gradient-to-br from-[#eef0ff] via-[#f7f7ff] to-white shadow-[0_12px_32px_rgba(79,70,229,0.18)]",
};

export default function Card({ children, variant = "default", className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(17,24,39,0.12)] ${variantStyles[variant]} ${className}`}
    >
      {children}
    </div>
  );
}
