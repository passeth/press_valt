"use client";

interface FloatingScrapButtonProps {
  position: { x: number; y: number };
  onClick: () => void;
}

export function FloatingScrapButton({
  position,
  onClick,
}: FloatingScrapButtonProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "absolute z-[100]",
        // Surface & text — soft warm surface, not harsh dark block
        "bg-surface text-primary",
        // Border & shadow — subtle definition + floating depth
        "border border-border shadow-medium",
        // Shape — pill for floating-action feel
        "rounded-[--radius-pill]",
        // Sizing & typography
        "px-3.5 py-1.5 text-[length:var(--text-button)] font-medium",
        // Layout — icon + text
        "inline-flex items-center gap-1.5",
        // Micro-interactions
        "transition-all duration-150 ease-out",
        "hover:bg-surface-warm hover:shadow-[0_8px_24px_rgb(26_26_26/0.16)] hover:scale-[1.04]",
        "active:scale-[0.97] active:shadow-soft",
        // Entry animation
        "animate-[fade-in_0.15s_ease-out]",
      ].join(" ")}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)",
      }}
    >
      <span className="text-sm leading-none" aria-hidden>📝</span>
      <span>소재로 추가</span>
    </button>
  );
}
