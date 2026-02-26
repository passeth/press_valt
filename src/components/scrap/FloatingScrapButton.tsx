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
      className="absolute z-[100] bg-accent text-text-inverted px-3 py-1.5 text-[length:var(--text-button)] font-medium shadow-sm hover:bg-accent-hover transition-colors animate-[fade-in_0.15s_ease-out]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: "translateX(-50%)",
      }}
    >
      📝 소재로 추가
    </button>
  );
}
