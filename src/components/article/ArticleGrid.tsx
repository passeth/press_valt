interface ArticleGridProps {
  children: React.ReactNode;
  className?: string;
}

export function ArticleGrid({ children, className = "" }: ArticleGridProps) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 ${className}`}
    >
      {children}
    </div>
  );
}
