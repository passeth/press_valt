interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: "content" | "article";
  className?: string;
}

export function PageContainer({
  children,
  maxWidth = "content",
  className = "",
}: PageContainerProps) {
  const widthClass =
    maxWidth === "article"
      ? "max-w-[var(--width-article)]"
      : "max-w-[var(--width-content)]";

  return (
    <div className={`mx-auto px-[var(--page-padding-x)] py-[var(--page-padding-y)] ${widthClass} ${className}`}>
      {children}
    </div>
  );
}
