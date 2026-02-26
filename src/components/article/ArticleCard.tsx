import Link from "next/link";

interface ArticleCardProps {
  slug: string;
  title: string;
  category?: string | null;
  summary?: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  tags?: string[];
}

export function ArticleCard({
  slug,
  title,
  category,
  summary,
  thumbnail_url,
  created_at,
  tags,
}: ArticleCardProps) {
  const formattedDate = new Date(created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="group">
      <Link href={`/articles/${slug}`} className="block">
        {/* Thumbnail */}
        <div className="aspect-[16/10] bg-surface mb-4 overflow-hidden">
          {thumbnail_url ? (
            <img
              src={thumbnail_url}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-text-tertiary text-[length:var(--text-caption)]">
                No Image
              </span>
            </div>
          )}
        </div>

        {/* Category badge */}
        {category && (
          <span className="inline-block text-[length:var(--text-badge)] font-medium uppercase tracking-[1px] text-text-secondary mb-2">
            {category}
          </span>
        )}

        {/* Title */}
        <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic leading-tight mb-2 group-hover:text-accent-hover transition-colors">
          {title}
        </h2>

        {/* Summary */}
        {summary && (
          <p className="text-[length:var(--text-small)] text-text-secondary leading-relaxed line-clamp-2 mb-3">
            {summary}
          </p>
        )}

        {/* Meta: date + tags */}
        <div className="flex items-center gap-3 text-[length:var(--text-caption)] text-text-tertiary">
          <time dateTime={created_at}>{formattedDate}</time>
          {tags && tags.length > 0 && (
            <>
              <span>·</span>
              <span>{tags.slice(0, 3).join(", ")}</span>
            </>
          )}
        </div>
      </Link>
    </article>
  );
}
