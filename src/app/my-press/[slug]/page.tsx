import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";

interface MyPressPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: MyPressPostPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { title: "로그인 필요" };

  const { data: post } = await supabase
    .from("user_posts")
    .select("title")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!post) return { title: "Not Found" };

  return { title: post.title };
}

export default async function MyPressPostPage({ params }: MyPressPostPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: post } = await supabase
    .from("user_posts")
    .select("*")
    .eq("slug", slug)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!post) {
    notFound();
  }

  // Fetch source scraps
  const { data: sources } = await supabase
    .from("post_sources")
    .select("id, scrap_id, usage")
    .eq("post_id", post.id);

  let scraps: { id: string; exact_quote: string }[] = [];
  if (sources && sources.length > 0) {
    const scrapIds = sources.map((s) => s.scrap_id);
    const { data: scrapData } = await supabase
      .from("scraps")
      .select("id, exact_quote")
      .in("id", scrapIds);
    scraps = scrapData ?? [];
  }

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date(post.created_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const statusLabel: Record<string, string> = {
    draft: "초안",
    published: "발행",
    archived: "보관",
  };

  const statusVariant: Record<string, "default" | "success" | "warning" | "error"> = {
    draft: "warning",
    published: "success",
    archived: "default",
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer maxWidth="article" className="pt-16 pb-20">
        {/* Back link */}
        <Link
          href="/my-press"
          className="inline-block text-[length:var(--text-caption)] text-text-tertiary hover:text-text-primary transition-colors mb-8"
        >
          ← 나의 프레스
        </Link>

        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Badge variant={statusVariant[post.status]}>
              {statusLabel[post.status]}
            </Badge>
          </div>
          <h1 className="text-[length:var(--text-display)] font-serif font-bold italic tracking-[-2px] leading-[1.05] mb-4">
            {post.title}
          </h1>
          <p className="text-[length:var(--text-caption)] text-text-tertiary">
            {formattedDate}
          </p>
        </header>

        <div className="border-t border-border mb-10" />

        {/* Content */}
        {post.rendered_html ? (
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: post.rendered_html }}
          />
        ) : (
          <div className="prose whitespace-pre-wrap">{post.markdown}</div>
        )}

        {/* Sources */}
        {scraps.length > 0 && (
          <section className="mt-16 pt-8 border-t border-border">
            <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-6">
              참고 소재
            </h2>
            <div className="space-y-3">
              {scraps.map((scrap) => (
                <div
                  key={scrap.id}
                  className="border-l-3 border-border pl-4 py-2"
                >
                  <p className="text-[length:var(--text-small)] text-text-secondary italic">
                    &ldquo;{scrap.exact_quote}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
