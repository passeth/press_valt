"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, PageContainer, TopNav } from "@/components/layout";
import { Badge, Button, Skeleton, Tabs } from "@/components/ui";

type PostStatus = "draft" | "published" | "archived" | "unlisted";
type TabKey = "all" | "draft" | "published" | "archived";

interface Post {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "초안",
  published: "발행",
  archived: "보관",
  unlisted: "보관",
};

const STATUS_VARIANT: Record<PostStatus, "default" | "success" | "warning" | "error"> = {
  draft: "warning",
  published: "success",
  archived: "default",
  unlisted: "default",
};

const TABS = [
  { id: "all", label: "전체" },
  { id: "draft", label: "초안" },
  { id: "published", label: "발행" },
  { id: "archived", label: "보관" },
];

function excerptFromMarkdown(markdown: string) {
  const text = markdown.replace(/\s+/g, " ").trim();
  if (text.length <= 150) {
    return text;
  }
  return `${text.slice(0, 150)}...`;
}

export default function MyPressPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/posts", { cache: "no-store" });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const payload = (await response.json()) as { posts?: Post[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "게시글을 불러오지 못했습니다.");
      }

      setPosts(payload.posts ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const filteredPosts = useMemo(() => {
    if (activeTab === "all") {
      return posts;
    }

    if (activeTab === "archived") {
      return posts.filter((post) => post.status === "archived" || post.status === "unlisted");
    }

    return posts.filter((post) => post.status === activeTab);
  }, [activeTab, posts]);

  const updatePostStatus = useCallback(
    async (post: Post, nextStatus: "draft" | "published") => {
      setPendingPostId(post.id);

      try {
        const response = await fetch(`/api/posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus,
            published_at: nextStatus === "published" ? new Date().toISOString() : null,
          }),
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as { post?: Post; error?: string };

        if (!response.ok || !payload.post) {
          throw new Error(payload.error ?? "상태를 변경하지 못했습니다.");
        }

        setPosts((prev) => prev.map((item) => (item.id === payload.post?.id ? payload.post : item)));
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "상태 변경에 실패했습니다.");
      } finally {
        setPendingPostId(null);
      }
    },
    [router]
  );

  const deletePost = useCallback(
    async (post: Post) => {
      if (!window.confirm(`'${post.title}' 글을 삭제할까요?`)) {
        return;
      }

      setPendingPostId(post.id);

      try {
        const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const payload = (await response.json()) as { success?: boolean; error?: string };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "삭제에 실패했습니다.");
        }

        setPosts((prev) => prev.filter((item) => item.id !== post.id));
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "삭제에 실패했습니다.");
      } finally {
        setPendingPostId(null);
      }
    },
    [router]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />

      <PageContainer className="py-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic text-text-primary">
              나의 프레스
            </h1>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              내가 쓴 글을 관리하고 발행 상태를 바꿔보세요.
            </p>
          </div>
          <p className="text-[length:var(--text-small)] text-text-secondary">
            전체 글 <span className="text-text-primary">{posts.length}</span>개
          </p>
        </header>

        <Tabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabKey)} />

        {loading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-28 w-full border border-border" />
            <Skeleton className="h-28 w-full border border-border" />
            <Skeleton className="h-28 w-full border border-border" />
          </div>
        ) : error ? (
          <div className="mt-6 border border-border bg-surface p-6">
            <p className="text-[length:var(--text-body)] text-text-primary">글 목록을 불러오지 못했습니다.</p>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={fetchPosts}>
              다시 시도
            </Button>
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="mt-6 space-y-3">
            {filteredPosts.map((post) => {
              const isPending = pendingPostId === post.id;
              const isPublished = post.status === "published";

              return (
                <article
                  key={post.id}
                  className="group cursor-pointer border border-border bg-background p-5 transition-colors hover:bg-surface"
                  onClick={() => router.push(`/my-press/${post.slug}`)}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                        <span className="text-[length:var(--text-caption)] text-text-secondary">
                          {new Date(post.updated_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <h2 className="text-[length:var(--text-body)] font-semibold text-text-primary transition-colors group-hover:text-accent">
                        {post.title}
                      </h2>
                      <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
                        {excerptFromMarkdown(post.markdown || "내용이 없습니다.")}
                      </p>
                    </div>

                    <div
                      className="flex flex-wrap items-center gap-2"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isPublished ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          isLoading={isPending}
                          onClick={() => updatePostStatus(post, "draft")}
                        >
                          발행 취소
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          isLoading={isPending}
                          onClick={() => updatePostStatus(post, "published")}
                        >
                          발행
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        isLoading={isPending}
                        onClick={() => deletePost(post)}
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 border border-border bg-surface p-8 text-center">
            <p className="text-[length:var(--text-body)] text-text-primary">아직 글이 없습니다.</p>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              아티클을 둘러보고 글쓰기를 시작해보세요.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => router.push("/articles")}>
                아티클 둘러보기
              </Button>
              <Button variant="primary" size="sm" onClick={() => router.push("/collections")}>
                글 쓰기 시작
              </Button>
            </div>
          </div>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
