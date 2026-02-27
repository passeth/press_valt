"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, PageContainer, TopNav } from "@/components/layout";
import { Badge, Button, Modal, Skeleton, Tabs } from "@/components/ui";

type PostStatus = "draft" | "published" | "archived" | "unlisted";
type TabKey = "all" | "draft" | "published" | "archived";

interface Post {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  status: PostStatus;
  published_at: string | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
}

interface BookmarkedArticle {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  category: string | null;
  bookmarked_at: string;
}

interface CollectionOption {
  id: string;
  title: string;
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
  const [bookmarkedArticles, setBookmarkedArticles] = useState<BookmarkedArticle[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(false);


  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [startingWriting, setStartingWriting] = useState(false);
  const [writingError, setWritingError] = useState("");

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

  useEffect(() => {
    if (activeTab !== "archived") {
      return;
    }

    const fetchBookmarks = async () => {
      setLoadingBookmarks(true);
      try {
        const res = await fetch("/api/articles/bookmarked", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { articles?: BookmarkedArticle[] };
          setBookmarkedArticles(data.articles ?? []);
        }
      } catch {}
      finally {
        setLoadingBookmarks(false);
      }
    };

    void fetchBookmarks();
  }, [activeTab]);

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

  const openCollectionPicker = async () => {
    setShowCollectionPicker(true);
    setWritingError("");
    setSelectedCollectionId("");
    setLoadingCollections(true);

    try {
      const res = await fetch("/api/collections");
      if (!res.ok) {
        setWritingError("컬렉션을 불러오지 못했습니다.");
        return;
      }
      const data = (await res.json()) as { collections?: CollectionOption[] };
      setCollections(data.collections ?? []);
    } catch {
      setWritingError("컬렉션을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleStartWriting = async () => {
    if (!selectedCollectionId) return;

    setStartingWriting(true);
    setWritingError("");

    try {
      const res = await fetch("/api/writing/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection_id: selectedCollectionId,
          model_provider: "anthropic",
          model_name: "claude-sonnet-4-20250514",
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { session: { id: string } };
        router.push(`/write/${data.session.id}`);
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setWritingError(data.error ?? "글쓰기 세션 생성에 실패했습니다.");
    } catch {
      setWritingError("글쓰기 세션 생성 중 문제가 발생했습니다.");
    } finally {
      setStartingWriting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />

      <PageContainer>
        <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic text-text-primary">
              나의 프레스
            </h1>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              내가 쓴 글을 관리하고 발행 상태를 바꿔보세요.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[length:var(--text-small)] text-text-secondary">
              전체 글 <span className="text-text-primary">{posts.length}</span>개
            </p>
            <Button variant="primary" size="sm" onClick={() => void openCollectionPicker()}>
              글 쓰기 시작
            </Button>
          </div>
        </header>

        <Tabs tabs={TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabKey)} />

        {loading ? (
          <div className="mt-6 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-border overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <Skeleton className="w-full md:w-[40%] aspect-[16/10] md:min-h-[240px]" />
                  <div className="flex-1 bg-inverted p-6">
                    <Skeleton className="h-4 w-20 mb-3 bg-text-inverted/10" />
                    <Skeleton className="h-6 w-3/4 mb-3 bg-text-inverted/10" />
                    <Skeleton className="h-4 w-full mb-2 bg-text-inverted/10" />
                    <Skeleton className="h-4 w-2/3 bg-text-inverted/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 border border-border bg-surface p-[var(--section-padding)] rounded-[var(--radius-card)]">
            <p className="text-[length:var(--text-body)] text-text-primary">글 목록을 불러오지 못했습니다.</p>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={fetchPosts}>
              다시 시도
            </Button>
          </div>
        ) : filteredPosts.length > 0 || (activeTab === "archived" && (bookmarkedArticles.length > 0 || loadingBookmarks)) ? (
          <div className="mt-6 space-y-6">
            {filteredPosts.map((post) => {
              const isPending = pendingPostId === post.id;
              const isPublished = post.status === "published";

              return (
                <article
                  key={post.id}
                  className="group cursor-pointer border border-border bg-background overflow-hidden transition-shadow hover:shadow-medium"
                  onClick={() => router.push(`/my-press/${post.slug}`)}
                >
                  <div className="flex flex-col md:flex-row md:min-h-[240px]">
                    <div className="w-full md:w-[40%] aspect-[16/10] md:aspect-auto relative overflow-hidden">
                      {post.thumbnail_url ? (
                        <img
                          src={post.thumbnail_url}
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="w-full h-full bg-surface flex items-center justify-center min-h-[180px]">
                          <span className="text-text-tertiary text-[length:var(--text-caption)]">No Image</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 bg-inverted p-6 flex flex-col justify-between">
                      <div>
                        <div className="mb-3 flex items-center gap-2">
                          <Badge variant={STATUS_VARIANT[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                          <span className="text-[length:var(--text-caption)] text-text-inverted/50">
                            {new Date(post.updated_at).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic text-text-inverted leading-tight">
                          {post.title}
                        </h2>
                        <p className="mt-3 text-[length:var(--text-small)] text-text-inverted/70 line-clamp-3">
                          {excerptFromMarkdown(post.markdown || "내용이 없습니다.")}
                        </p>
                      </div>

                      <div
                        className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-text-inverted/10"
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
                  </div>
                </article>
              );
            })}

            {activeTab === "archived" && bookmarkedArticles.length > 0 && (
              <>
                <div className="border-t border-border pt-6 mt-8">
                  <h2 className="text-[length:var(--text-h3)] font-serif font-semibold italic text-text-primary mb-4">
                    보관한 아티클
                  </h2>
                </div>
                {bookmarkedArticles.map((article) => (
                  <article
                    key={`bookmark-${article.id}`}
                    className="group cursor-pointer border border-border bg-background overflow-hidden transition-shadow hover:shadow-medium"
                    onClick={() => router.push(`/articles/${article.slug}`)}
                  >
                    <div className="flex flex-col md:flex-row md:min-h-[240px]">
                      <div className="w-full md:w-[40%] aspect-[16/10] md:aspect-auto relative overflow-hidden">
                        {article.thumbnail_url ? (
                          <img
                            src={article.thumbnail_url}
                            alt={article.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface flex items-center justify-center min-h-[180px]">
                            <span className="text-text-tertiary text-[length:var(--text-caption)]">No Image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 bg-inverted p-6 flex flex-col justify-between">
                        <div>
                          <div className="mb-3 flex items-center gap-2">
                            <Badge variant="default">보관</Badge>
                            {article.category && (
                              <span className="text-[length:var(--text-caption)] text-text-inverted/50">
                                {article.category}
                              </span>
                            )}
                            <span className="text-[length:var(--text-caption)] text-text-inverted/50">
                              {new Date(article.bookmarked_at).toLocaleDateString("ko-KR")}
                            </span>
                          </div>
                          <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic text-text-inverted leading-tight">
                            {article.title}
                          </h2>
                          {article.summary && (
                            <p className="mt-3 text-[length:var(--text-small)] text-text-inverted/70 line-clamp-3">
                              {article.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </>
            )}

            {activeTab === "archived" && loadingBookmarks && (
              <div className="space-y-6 mt-6">
                {[1, 2].map((i) => (
                  <div key={`bm-skel-${i}`} className="border border-border overflow-hidden">
                    <div className="flex flex-col md:flex-row">
                      <Skeleton className="w-full md:w-[40%] aspect-[16/10] md:min-h-[240px]" />
                      <div className="flex-1 bg-inverted p-6">
                        <Skeleton className="h-4 w-20 mb-3 bg-text-inverted/10" />
                        <Skeleton className="h-6 w-3/4 mb-3 bg-text-inverted/10" />
                        <Skeleton className="h-4 w-full mb-2 bg-text-inverted/10" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 border border-border bg-surface p-8 text-center">
            <p className="text-[length:var(--text-body)] text-text-primary">아직 글이 없습니다.</p>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              아티클을 둘러보고 소재를 모은 뒤 글쓰기를 시작해보세요.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => router.push("/articles")}>
                아티클 둘러보기
              </Button>
              <Button variant="primary" size="sm" onClick={() => void openCollectionPicker()}>
                글 쓰기 시작
              </Button>
            </div>
          </div>
        )}
      </PageContainer>

      <Footer />


      <Modal
        isOpen={showCollectionPicker}
        onClose={() => setShowCollectionPicker(false)}
        title="글 쓰기 — 컬렉션 선택"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[length:var(--text-small)] text-text-secondary">
            소재를 모아둔 컬렉션을 선택하면 AI가 분석하여 글쓰기를 도와줍니다.
          </p>

          {loadingCollections ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : collections.length > 0 ? (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {collections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setSelectedCollectionId(col.id)}
                  className={`w-full text-left px-4 py-3 border transition-colors ${
                    selectedCollectionId === col.id
                      ? "border-accent bg-surface"
                      : "border-border bg-background hover:bg-surface"
                  }`}
                >
                  <span className="text-[length:var(--text-body)] text-text-primary">
                    {col.title}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="border border-border bg-surface p-4 text-center">
              <p className="text-[length:var(--text-small)] text-text-secondary mb-3">
                아직 컬렉션이 없습니다. 아티클에서 소재를 스크랩하여 컬렉션을 만들어보세요.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowCollectionPicker(false);
                  router.push("/articles");
                }}
              >
                아티클 둘러보기
              </Button>
            </div>
          )}

          {writingError && (
            <p className="text-[length:var(--text-small)] text-error">{writingError}</p>
          )}

          {collections.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowCollectionPicker(false)}>
                취소
              </Button>
              <Button
                size="sm"
                disabled={!selectedCollectionId}
                isLoading={startingWriting}
                onClick={() => void handleStartWriting()}
              >
                글쓰기 시작
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
