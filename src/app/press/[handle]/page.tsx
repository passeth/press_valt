import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";


interface PressPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PressPageProps): Promise<Metadata> {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("handle", handle)
    .eq("press_is_public", true)
    .maybeSingle();

  if (!profile) return { title: "페이지를 찾을 수 없음" };

  return {
    title: `${profile.display_name || profile.handle}의 프레스`,
  };
}

export default async function PressPage({ params }: PressPageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  // Fetch public profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, bio")
    .eq("handle", handle)
    .eq("press_is_public", true)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  // Fetch published posts
  const { data: posts } = await supabase
    .from("user_posts")
    .select("slug, title, markdown, rendered_html, published_at, created_at, thumbnail_url")
    .eq("user_id", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const normalizeExcerpt = (raw: string | null) => {
    const cleaned = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return "요약이 아직 없습니다.";
    }
    if (cleaned.length <= 180) {
      return cleaned;
    }
    return `${cleaned.slice(0, 180)}...`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-12">
        <header className="mb-10 border-b border-border pb-6">
          <p className="text-[length:var(--text-caption)] uppercase tracking-[0.08em] text-text-secondary">
            공개 프레스
          </p>
          <h1 className="mt-2 text-[length:var(--text-display)] font-serif font-bold italic text-text-primary">
            {profile.display_name || profile.handle}
          </h1>
          {profile.bio && (
            <p className="mt-3 max-w-2xl text-[length:var(--text-body)] text-text-secondary">
              {profile.bio}
            </p>
          )}
        </header>

        {posts && posts.length > 0 ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <article key={post.slug} className="group border border-border bg-background overflow-hidden transition-colors hover:bg-surface">
                <Link
                  href={`/press/${handle}/${post.slug}`}
                  className="block"
                >
                  {post.thumbnail_url && (
                    <div className="w-full aspect-[16/9] overflow-hidden">
                      <img
                        src={post.thumbnail_url}
                        alt={post.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic text-text-primary transition-colors group-hover:text-accent">
                      {post.title}
                    </h2>
                    <p className="mt-3 text-[length:var(--text-small)] text-text-secondary">
                      {normalizeExcerpt(post.markdown)}
                    </p>
                    <p className="mt-4 text-[length:var(--text-caption)] text-text-secondary">
                      {new Date(
                        post.published_at || post.created_at
                      ).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-border bg-surface p-10 text-center">
            <p className="text-[length:var(--text-body)] text-text-primary">
              아직 발행된 글이 없습니다.
            </p>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              조금 뒤에 다시 방문해보세요.
            </p>
          </div>
        )}
      </main>

      <footer className="w-full max-w-2xl mx-auto px-5 pb-8">
        <p className="text-[length:var(--text-caption)] text-text-tertiary text-center">
          {profile.display_name || profile.handle}&apos;s Press
        </p>
      </footer>
    </div>
  );
}
