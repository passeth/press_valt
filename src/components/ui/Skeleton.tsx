interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className = "", width, height }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-surface rounded-[var(--radius-card)] ${className}`}
      style={{ width, height }}
    />
  );
}
