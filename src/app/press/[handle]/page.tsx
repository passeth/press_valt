import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";

interface PressPageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PressPageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, handle")
    .eq("handle", handle)
    .eq("press_is_public", true)
    .maybeSingle();

  if (!profile) return { title: "Not Found" };

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
    .select("slug, title, markdown, published_at, created_at")
    .eq("user_id", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer maxWidth="article" className="pt-16 pb-20">
        {/* Profile header */}
        <header className="mb-12 text-center">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
            {profile.display_name || profile.handle}
          </h1>
          {profile.bio && (
            <p className="text-[length:var(--text-small)] text-text-secondary max-w-lg mx-auto">
              {profile.bio}
            </p>
          )}
        </header>

        <div className="border-t border-border mb-10" />

        {/* Posts */}
        {posts && posts.length > 0 ? (
          <div className="space-y-6">
            {posts.map((post) => (
              <article key={post.slug} className="group">
                <Link
                  href={`/press/${handle}/${post.slug}`}
                  className="block border border-border p-6 hover:bg-surface transition-colors"
                >
                  <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-2 group-hover:text-accent-hover transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-[length:var(--text-small)] text-text-secondary line-clamp-2 mb-3">
                    {post.markdown?.substring(0, 200)}
                  </p>
                  <p className="text-[length:var(--text-caption)] text-text-tertiary">
                    {new Date(
                      post.published_at || post.created_at
                    ).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-text-secondary text-[length:var(--text-body)]">
              아직 발행된 글이 없습니다.
            </p>
          </div>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
