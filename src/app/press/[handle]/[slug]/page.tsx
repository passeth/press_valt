import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
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
}

const USAGE_LABEL: Record<string, string> = {
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
    .select("id, slug, title, markdown, rendered_html, published_at, created_at")
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
      .select("id, exact_quote, user_note")
      .in("id", scrapIds);

    scraps = scrapRows ?? [];
  }

  const scrapMap = new Map(scraps.map((scrap) => [scrap.id, scrap]));
  const publishedDate = new Date(post.published_at || post.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

        <article className="mt-8">
          {post.rendered_html ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: post.rendered_html }} />
          ) : (
            <div className="prose whitespace-pre-wrap">{post.markdown}</div>
          )}
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
                    <p className="text-[length:var(--text-small)] text-text-primary">
                      {USAGE_LABEL[source.usage] ?? source.usage}
                    </p>
                    {scrap?.exact_quote ? (
                      <p className="mt-2 text-[length:var(--text-small)] italic text-text-secondary">
                        &ldquo;{scrap.exact_quote}&rdquo;
                      </p>
                    ) : (
                      <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
                        스크랩 본문을 불러오지 못했습니다.
                      </p>
                    )}
                    {scrap?.user_note && (
                      <p className="mt-2 text-[length:var(--text-caption)] text-text-secondary">
                        메모: {scrap.user_note}
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
