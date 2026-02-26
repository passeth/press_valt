"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface Post {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function MyPressPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/posts");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
      }
    } finally {
      setLoading(false);
    }
  };

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

      <PageContainer>
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
            나의 프레스
          </h1>
          <p className="text-[length:var(--text-small)] text-text-secondary">
            내가 작성하고 발행한 글 모아보기
          </p>
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="space-y-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/my-press/${post.slug}`}
                className="block border border-border p-5 hover:bg-surface transition-colors group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={statusVariant[post.status]}>
                        {statusLabel[post.status]}
                      </Badge>
                    </div>
                    <h3 className="text-[length:var(--text-body)] font-medium group-hover:text-accent transition-colors mb-1">
                      {post.title}
                    </h3>
                    <p className="text-[length:var(--text-small)] text-text-secondary line-clamp-2">
                      {post.markdown?.substring(0, 150)}...
                    </p>
                  </div>
                  <p className="text-[length:var(--text-caption)] text-text-tertiary shrink-0">
                    {new Date(post.updated_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-border">
            <p className="text-text-secondary text-[length:var(--text-body)] mb-2">
              아직 작성한 글이 없습니다.
            </p>
            <p className="text-text-tertiary text-[length:var(--text-small)]">
              컬렉션에서 소재를 모은 후 글 쓰기를 시작해보세요.
            </p>
            <Link
              href="/articles"
              className="inline-block mt-4 text-accent hover:text-accent-hover transition-colors text-[length:var(--text-small)]"
            >
              아티클 둘러보기 →
            </Link>
          </div>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
