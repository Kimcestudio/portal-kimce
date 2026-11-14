import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
}

const variantStyles = {
  primary:
    "bg-primary text-white shadow-[0_12px_32px_rgba(79,70,229,0.3)] hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(79,70,229,0.35)]",
  secondary:
    "bg-white text-ink border border-line shadow-soft hover:-translate-y-0.5 hover:shadow-card",
  ghost: "bg-transparent text-muted hover:text-ink",
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
