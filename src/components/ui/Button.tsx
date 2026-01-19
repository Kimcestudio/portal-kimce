import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
}

const variantStyles = {
  primary:
    "bg-primary text-white shadow-[0_12px_32px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(79,70,229,0.35)]",
  secondary:
    "bg-white text-slate-900 border border-slate-200/70 shadow-[0_8px_24px_rgba(17,24,39,0.06)] hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(17,24,39,0.1)]",
  ghost: "bg-transparent text-slate-600 hover:text-slate-900",
};

export default function Button({ variant = "secondary", icon, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition duration-200 ease-out ${variantStyles[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
