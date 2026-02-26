"use client";

import { useToastStore } from "@/stores/toast";

const icons: Record<string, string> = { success: "✓", error: "✕", info: "ℹ" };
const iconColors: Record<string, string> = { success: "text-success", error: "text-error", info: "text-accent" };

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="bg-background border border-border shadow-md px-4 py-3 flex items-center gap-3 animate-slide-down min-w-[280px]">
          <span className={`font-bold ${iconColors[toast.type]}`}>{icons[toast.type]}</span>
          <span className="flex-1 text-[length:var(--text-small)]">{toast.message}</span>
          <button onClick={() => remove(toast.id)} className="text-text-tertiary hover:text-text-primary text-xs">✕</button>
        </div>
      ))}
    </div>
  );
}
