"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: "max-w-[400px]", md: "max-w-[560px]", lg: "max-w-[720px]" };

export function Modal({ isOpen, onClose, title, children, size = "md" }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>("button, [tabindex], input, textarea, select");
      focusable?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        ref={panelRef}
        className={`relative z-10 w-full ${sizeMap[size]} bg-background border border-border shadow-lg animate-slide-up mx-4`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h3 className="text-[length:var(--text-h3)] font-medium not-italic">{title}</h3>
            <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors p-1">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
