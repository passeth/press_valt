"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, PageContainer, TopNav } from "@/components/layout";
import { Badge, Button, Skeleton } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type PostStatus = "draft" | "published" | "archived" | "unlisted";

interface Post {
  id: string;
  slug: string;
  title: string;
  markdown: string;
  rendered_html: string | null;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PostSource {
  id: string;
  scrap_id: string;
  usage: string;
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

const USAGE_LABEL: Record<string, string> = {
  quote: "직접 인용",
  paraphrase: "재서술",
  insight: "인사이트",
  context: "맥락 참고",
};

export default function MyPressPostPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const [post, setPost] = useState<Post | null>(null);
  const [sources, setSources] = useState<PostSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pendingAction, setPendingAction] = useState<"status" | "delete" | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadPost = useCallback(async () => {
    if (!slug) {
      return;
    }

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const postsResponse = await fetch("/api/posts", { cache: "no-store" });

      if (postsResponse.status === 401) {
        router.replace("/login");
        return;
      }

      const postsPayload = (await postsResponse.json()) as { posts?: Post[]; error?: string };

      if (!postsResponse.ok) {
        throw new Error(postsPayload.error ?? "게시글 목록을 불러오지 못했습니다.");
      }

      const targetPost = (postsPayload.posts ?? []).find((item) => item.slug === slug);

      if (!targetPost) {
        setNotFound(true);
        return;
      }

      const detailResponse = await fetch(`/api/posts/${targetPost.id}`, { cache: "no-store" });

      if (detailResponse.status === 401) {
        router.replace("/login");
        return;
      }

      const detailPayload = (await detailResponse.json()) as {
        post?: Post;
        sources?: PostSource[];
        error?: string;
      };

      if (!detailResponse.ok || !detailPayload.post) {
        throw new Error(detailPayload.error ?? "게시글 상세를 불러오지 못했습니다.");
      }

      setPost(detailPayload.post);
      setSources(detailPayload.sources ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [router, slug]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);


  useEffect(() => {
    const fetchHandle = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("handle")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setHandle(data.handle);
    };
    fetchHandle();
  }, []);

  const copyShareLink = useCallback(() => {
    if (!handle || !slug) return;
    const url = `${window.location.origin}/press/${handle}/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [handle, slug]);
  const publishDate = useMemo(() => {
    if (!post) {
      return "";
    }

    const targetDate = post.published_at ?? post.created_at;
    return new Date(targetDate).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [post]);

  const togglePublish = useCallback(async () => {
    if (!post) {
      return;
    }

    setPendingAction("status");
    setError(null);

    const nextStatus = post.status === "published" ? "draft" : "published";

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
        throw new Error(payload.error ?? "게시 상태를 바꾸지 못했습니다.");
      }

      setPost(payload.post);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "상태 변경에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }, [post, router]);

  const deletePost = useCallback(async () => {
    if (!post) {
      return;
    }

    if (!window.confirm("정말 이 글을 삭제할까요? 삭제 후에는 복구할 수 없습니다.")) {
      return;
    }

    setPendingAction("delete");
    setError(null);

    try {
      const response = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "삭제하지 못했습니다.");
      }

      router.push("/my-press");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "삭제에 실패했습니다.");
    } finally {
      setPendingAction(null);
    }
  }, [post, router]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />

      <PageContainer maxWidth="article">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
          <Link
            href="/my-press"
            className="text-[length:var(--text-caption)] text-text-secondary transition-colors hover:text-text-primary"
          >
            ← 나의 프레스
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" disabled>
              편집 준비중
            </Button>
            {post?.status === "published" && handle && (
              <Button variant="secondary" size="sm" onClick={copyShareLink}>
                {copied ? "복사됨!" : "공유 링크"}
              </Button>
            )}
            <Button
              variant={post?.status === "published" ? "secondary" : "primary"}
              size="sm"
              isLoading={pendingAction === "status"}
              onClick={togglePublish}
              disabled={!post}
            >
              {post?.status === "published" ? "발행 취소" : "발행"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={pendingAction === "delete"}
              onClick={deletePost}
              disabled={!post}
            >
              삭제
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/5" />
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-56 w-full border border-border" />
          </div>
        ) : notFound ? (
          <section className="border border-border bg-surface p-8 text-center">
            <h1 className="text-[length:var(--text-h2)] font-serif font-semibold italic text-text-primary">
              글을 찾을 수 없습니다.
            </h1>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              삭제되었거나 접근할 수 없는 글입니다.
            </p>
            <Link
              href="/my-press"
              className="mt-4 inline-block text-[length:var(--text-small)] text-text-primary underline underline-offset-2"
            >
              목록으로 돌아가기
            </Link>
          </section>
        ) : error ? (
          <section className="border border-border bg-surface p-[var(--section-padding)] rounded-[var(--radius-card)]">
            <p className="text-[length:var(--text-body)] text-text-primary">글을 불러오지 못했습니다.</p>
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">{error}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={loadPost}>
              다시 시도
            </Button>
          </section>
        ) : post ? (
          <>
            <header className="mb-8">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_VARIANT[post.status]}>{STATUS_LABEL[post.status]}</Badge>
                <time className="text-[length:var(--text-caption)] text-text-secondary">{publishDate}</time>
              </div>
              <h1 className="text-[length:var(--text-display)] font-serif font-bold italic text-text-primary">
                {post.title}
              </h1>
            </header>

            <article className="border-t border-border pt-8">
              {post.rendered_html ? (
                <div className="prose" dangerouslySetInnerHTML={{ __html: post.rendered_html }} />
              ) : (
                <div className="prose whitespace-pre-wrap">{post.markdown}</div>
              )}
            </article>

            {sources.length > 0 && (
              <section className="mt-14 border-t border-border pt-8">
                <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic text-text-primary">
                  참고 스크랩
                </h2>
                <ul className="mt-4 space-y-2">
                  {sources.map((source) => (
                    <li key={source.id} className="border border-border bg-surface p-3">
                      <p className="text-[length:var(--text-small)] text-text-primary">
                        {USAGE_LABEL[source.usage] ?? source.usage}
                      </p>
                      <p className="mt-1 text-[length:var(--text-caption)] text-text-secondary">
                        스크랩 ID: {source.scrap_id}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : null}
      </PageContainer>

      <Footer />
    </div>
  );
}
