import { type ReactNode } from "react";

type BadgeVariant = "default" | "category" | "status" | "success" | "warning" | "error";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface text-text-secondary",
  category: "bg-accent/10 text-accent",
  status: "bg-success/10 text-success",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex px-2.5 py-0.5 text-[length:var(--text-badge)] font-bold uppercase tracking-[1px] rounded-[var(--radius-badge)] ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
