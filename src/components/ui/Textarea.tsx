"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  autoResize?: boolean;
}

export function Textarea({ label, error, autoResize, className = "", ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!autoResize || !ref.current) return;
    const el = ref.current;
    const resize = () => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
    el.addEventListener("input", resize);
    resize();
    return () => el.removeEventListener("input", resize);
  }, [autoResize]);

  return (
    <div className="w-full">
      {label && <label className="block text-[length:var(--text-small)] font-medium text-text-primary mb-1.5">{label}</label>}
      <textarea
        ref={ref}
        className={`w-full border border-border px-3 py-2 text-[length:var(--text-body)] bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-accent resize-none ${error ? "border-error" : ""} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-[length:var(--text-caption)] text-error">{error}</p>}
    </div>
  );
}
