import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { marked } from "marked";
import { createClient } from "@/lib/supabase/server";


interface PressPostPageProps {
  params: Promise<{ handle: string; slug: string }>;
}

interface PostSource {
  id: string;
  scrap_id: string;
  usage: string;
}

interface Scrap {
  id: string;
  exact_quote: string;
  user_note: string | null;
  source_revision_id: string;
  article_slug: string | null;
  article_title: string | null;
  article_thumbnail_url: string | null;
}

const USAGE_LABEL: Record<string, string> = {
  quotation: "인용",
  quote: "직접 인용",
  paraphrase: "재서술",
  insight: "인사이트",
  context: "맥락 참고",
};

export async function generateMetadata({ params }: PressPostPageProps): Promise<Metadata> {
  const { handle, slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, handle")
    .eq("handle", handle)
    .eq("press_is_public", true)
    .maybeSingle();

  if (!profile) {
    return { title: "페이지를 찾을 수 없음" };
  }

  const { data: post } = await supabase
    .from("user_posts")
    .select("title")
    .eq("user_id", profile.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) {
    return { title: "페이지를 찾을 수 없음" };
  }

  return {
    title: `${post.title} | ${profile.display_name || profile.handle}의 프레스`,
  };
}

export default async function PressPostPage({ params }: PressPostPageProps) {
  const { handle, slug } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, handle")
    .eq("handle", handle)
    .eq("press_is_public", true)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const { data: post } = await supabase
    .from("user_posts")
    .select("id, slug, title, markdown, rendered_html, published_at, created_at, thumbnail_url")
    .eq("user_id", profile.id)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) {
    notFound();
  }

  const { data: sourceRows } = await supabase
    .from("post_sources")
    .select("id, scrap_id, usage")
    .eq("post_id", post.id);

  const sources: PostSource[] = sourceRows ?? [];
  let scraps: Scrap[] = [];

  if (sources.length > 0) {
    const scrapIds = sources.map((source) => source.scrap_id);
    const { data: scrapRows } = await supabase
      .from("scraps")
      .select("id, exact_quote, user_note, source_revision_id")
      .in("id", scrapIds);

    const enrichedScraps: Scrap[] = [];
    if (scrapRows && scrapRows.length > 0) {
      const revisionIds = [...new Set(scrapRows.map((s) => s.source_revision_id))];
      const { data: revisions } = await supabase
        .from("admin_article_revisions")
        .select("id, article_id")
        .in("id", revisionIds);

      const revToArticle = new Map<string, string>();
      (revisions ?? []).forEach((r) => revToArticle.set(r.id, r.article_id));

      const articleIds = [...new Set(Array.from(revToArticle.values()))];
      const { data: articles } = await supabase
        .from("admin_articles")
        .select("id, slug, title, thumbnail_url")
        .in("id", articleIds);

      const articleMap = new Map<string, { slug: string; title: string; thumbnail_url: string | null }>();
      (articles ?? []).forEach((a) =>
        articleMap.set(a.id, {
          slug: a.slug,
          title: a.title,
          thumbnail_url: a.thumbnail_url,
        }),
      );

      for (const scrap of scrapRows) {
        const artId = revToArticle.get(scrap.source_revision_id);
        const art = artId ? articleMap.get(artId) : null;

        enrichedScraps.push({
          id: scrap.id,
          exact_quote: scrap.exact_quote,
          user_note: scrap.user_note,
          source_revision_id: scrap.source_revision_id,
          article_slug: art?.slug ?? null,
          article_title: art?.title ?? null,
          article_thumbnail_url: art?.thumbnail_url ?? null,
        });
      }
    }

    scraps = enrichedScraps;
  }

  const scrapMap = new Map(scraps.map((scrap) => [scrap.id, scrap]));
  const publishedDate = new Date(post.published_at || post.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const renderedMarkdown = post.rendered_html || (marked.parse(post.markdown, { async: false }) as string);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-12">
        <Link
          href={`/press/${handle}`}
          className="text-[length:var(--text-caption)] text-text-secondary transition-colors hover:text-text-primary"
        >
          ← {profile.display_name || profile.handle}의 프레스로 돌아가기
        </Link>

        <header className="mt-5 border-b border-border pb-6">
          <p className="text-[length:var(--text-caption)] text-text-secondary">{publishedDate}</p>
          <h1 className="mt-3 text-[length:var(--text-display)] font-serif font-bold italic text-text-primary">
            {post.title}
          </h1>
        </header>
        {post.thumbnail_url && (
          <div className="mt-6 w-full aspect-[16/9] overflow-hidden border border-border">
            <img
              src={post.thumbnail_url}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <article className="mt-8">
          <div
            className="prose whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        </article>

        {sources.length > 0 && (
          <section className="mt-14 border-t border-border pt-8">
            <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic text-text-primary">
              출처 스크랩
            </h2>
            <ul className="mt-4 space-y-3">
              {sources.map((source) => {
                const scrap = scrapMap.get(source.scrap_id);

                return (
                  <li key={source.id} className="border border-border bg-surface p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-[length:var(--text-caption)] text-text-tertiary font-medium shrink-0 pt-0.5">
                        {USAGE_LABEL[source.usage] ?? source.usage}
                      </span>
                    </div>
                    {scrap ? (
                      <div className="mt-2">
                        {scrap.article_slug ? (
                          <Link
                            href={`/articles/${scrap.article_slug}`}
                            className="flex items-start gap-4 group transition-colors hover:bg-background p-2 -mx-2"
                          >
                            {scrap.article_thumbnail_url && (
                              <div className="w-16 h-16 shrink-0 overflow-hidden border border-border">
                                <img
                                  src={scrap.article_thumbnail_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[length:var(--text-small)] italic text-text-secondary group-hover:text-text-primary transition-colors">
                                &ldquo;{scrap.exact_quote}&rdquo;
                              </p>
                              {scrap.article_title && (
                                <p className="mt-1 text-[length:var(--text-caption)] text-text-tertiary">
                                  {scrap.article_title}
                                </p>
                              )}
                            </div>
                          </Link>
                        ) : (
                          <p className="text-[length:var(--text-small)] italic text-text-secondary">
                            &ldquo;{scrap.exact_quote}&rdquo;
                          </p>
                        )}
                        {scrap.user_note && (
                          <p className="mt-2 text-[length:var(--text-caption)] text-text-secondary">
                            메모: {scrap.user_note}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
                        스크랩 본문을 불러오지 못했습니다.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>

      <footer className="w-full max-w-2xl mx-auto px-5 pb-8 border-t border-border pt-6">
        <Link
          href={`/press/${handle}`}
          className="text-[length:var(--text-caption)] text-text-tertiary transition-colors hover:text-text-secondary"
        >
          {profile.display_name || profile.handle}&apos;s Press
        </Link>
      </footer>
    </div>
  );
}
