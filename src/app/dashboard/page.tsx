import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata = {
  title: "대시보드",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/dashboard");
  }

  // Fetch user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Fetch counts in parallel
  const [scrapsResult, collectionsResult, postsResult] = await Promise.all([
    supabase
      .from("scraps")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("collections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
    supabase
      .from("user_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const scrapCount = scrapsResult.count ?? 0;
  const collectionCount = collectionsResult.count ?? 0;
  const postCount = postsResult.count ?? 0;

  // Fetch recent scraps
  const { data: recentScraps } = await supabase
    .from("scraps")
    .select("id, exact_quote, user_note, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  // Fetch recent collections
  const { data: recentCollections } = await supabase
    .from("collections")
    .select("id, title, status, updated_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(5);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
            {profile?.display_name || profile?.handle || "대시보드"}
          </h1>
          <p className="text-[length:var(--text-small)] text-text-secondary">
            나의 활동 현황
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <Link
            href="/collections"
            className="border border-border p-6 hover:bg-surface transition-colors group"
          >
            <p className="text-[length:var(--text-caption)] text-text-tertiary uppercase tracking-[1px] mb-2">
              스크랩
            </p>
            <p className="text-[length:var(--text-hero)] font-serif font-bold italic tracking-[-1px]">
              {scrapCount}
            </p>
          </Link>
          <Link
            href="/collections"
            className="border border-border p-6 hover:bg-surface transition-colors group"
          >
            <p className="text-[length:var(--text-caption)] text-text-tertiary uppercase tracking-[1px] mb-2">
              컬렉션
            </p>
            <p className="text-[length:var(--text-hero)] font-serif font-bold italic tracking-[-1px]">
              {collectionCount}
            </p>
          </Link>
          <Link
            href="/my-press"
            className="border border-border p-6 hover:bg-surface transition-colors group"
          >
            <p className="text-[length:var(--text-caption)] text-text-tertiary uppercase tracking-[1px] mb-2">
              발행한 글
            </p>
            <p className="text-[length:var(--text-hero)] font-serif font-bold italic tracking-[-1px]">
              {postCount}
            </p>
          </Link>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent scraps */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic">
                최근 스크랩
              </h2>
              <Link
                href="/collections"
                className="text-[length:var(--text-caption)] text-text-tertiary hover:text-text-primary transition-colors"
              >
                전체보기 →
              </Link>
            </div>
            {recentScraps && recentScraps.length > 0 ? (
              <div className="space-y-3">
                {recentScraps.map((scrap) => (
                  <div
                    key={scrap.id}
                    className="border border-border p-4 hover:bg-surface transition-colors"
                  >
                    <p className="text-[length:var(--text-small)] text-text-primary line-clamp-2 italic mb-2">
                      &ldquo;{scrap.exact_quote}&rdquo;
                    </p>
                    {scrap.user_note && (
                      <p className="text-[length:var(--text-caption)] text-text-secondary line-clamp-1">
                        {scrap.user_note}
                      </p>
                    )}
                    <p className="text-[length:var(--text-caption)] text-text-tertiary mt-2">
                      {new Date(scrap.created_at).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-border p-8 text-center">
                <p className="text-text-secondary text-[length:var(--text-small)]">
                  아직 스크랩이 없습니다.
                </p>
                <Link
                  href="/articles"
                  className="inline-block mt-3 text-[length:var(--text-caption)] text-accent hover:text-accent-hover transition-colors"
                >
                  아티클 둘러보기 →
                </Link>
              </div>
            )}
          </section>

          {/* Recent collections */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic">
                최근 컬렉션
              </h2>
              <Link
                href="/collections"
                className="text-[length:var(--text-caption)] text-text-tertiary hover:text-text-primary transition-colors"
              >
                전체보기 →
              </Link>
            </div>
            {recentCollections && recentCollections.length > 0 ? (
              <div className="space-y-3">
                {recentCollections.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collections/${collection.id}`}
                    className="block border border-border p-4 hover:bg-surface transition-colors"
                  >
                    <p className="text-[length:var(--text-body)] font-medium mb-1">
                      {collection.title}
                    </p>
                    <p className="text-[length:var(--text-caption)] text-text-tertiary">
                      {new Date(collection.updated_at).toLocaleDateString("ko-KR")}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border border-border p-8 text-center">
                <p className="text-text-secondary text-[length:var(--text-small)]">
                  아직 컬렉션이 없습니다.
                </p>
                <p className="mt-2 text-[length:var(--text-caption)] text-text-tertiary">
                  아티클에서 텍스트를 스크랩하면 컬렉션에 모을 수 있습니다.
                </p>
              </div>
            )}
          </section>
        </div>
      </PageContainer>

      <Footer />
    </div>
  );
}
