"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface Scrap {
  id: string;
  exact_quote: string;
  user_note: string | null;
  source_revision_id: string;
  source_block_id: string;
  created_at: string;
}

interface CollectionItem {
  id: string;
  collection_id: string;
  scrap_id: string;
  position: number;
  created_at: string;
  scrap: Scrap | null;
}

interface Collection {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

interface MaterialNote {
  id: string;
  content_markdown: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface CollectionDetailResponse {
  collection: Collection;
  items: CollectionItem[];
  notes: MaterialNote[];
}

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [notes, setNotes] = useState<MaterialNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [savingCollection, setSavingCollection] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [startingWriting, setStartingWriting] = useState(false);
  const [writingError, setWritingError] = useState("");

  const fetchCollection = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const res = await fetch(`/api/collections/${id}`);

      if (!res.ok) {
        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }

        if (res.status === 404) {
          setLoadError("컬렉션을 찾을 수 없습니다.");
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadError(data.error ?? "컬렉션을 불러오지 못했습니다.");
        return;
      }

      setAuthRequired(false);
      const data = (await res.json()) as CollectionDetailResponse;
      setCollection(data.collection);
      setItems(data.items ?? []);
      setNotes(data.notes ?? []);
      setDraftTitle(data.collection.title);
      setDraftDescription(data.collection.description ?? "");
    } catch {
      setLoadError("컬렉션을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCollection();
  }, [fetchCollection]);

  const handleRemoveItem = async (itemId: string) => {
    setRemovingItemId(itemId);
    setActionError("");

    const res = await fetch(`/api/collections/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });

    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setActionError(data.error ?? "스크랩 삭제에 실패했습니다.");
    }

    setRemovingItemId(null);
  };

  const handleSaveCollection = async () => {
    if (!collection || !draftTitle.trim()) return;

    setSavingCollection(true);
    setActionError("");

    try {
      const res = await fetch(`/api/collections/${collection.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle.trim(),
          description: draftDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setActionError(data.error ?? "컬렉션 수정에 실패했습니다.");
        return;
      }

      const data = (await res.json()) as { collection: Collection };
      setCollection(data.collection);
      setDraftTitle(data.collection.title);
      setDraftDescription(data.collection.description ?? "");
      setIsEditing(false);
    } catch {
      setActionError("컬렉션 수정 중 문제가 발생했습니다.");
    } finally {
      setSavingCollection(false);
    }
  };

  const handleStartWriting = async () => {
    if (!collection) return;

    setStartingWriting(true);
    setWritingError("");

    const res = await fetch("/api/writing/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_id: collection.id,
        model_provider: "anthropic",
        model_name: "claude-sonnet-4-20250514",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/write/${data.session.id}`);
      return;
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setWritingError(data.error ?? "글쓰기 세션 생성에 실패했습니다.");
    setStartingWriting(false);
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  const getScrapSourceLink = (scrap: Scrap) => {
    const revisionId = encodeURIComponent(scrap.source_revision_id);
    return `/articles?sourceRevisionId=${revisionId}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer>
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-5 w-80 mb-8" />
          <Skeleton className="h-12 w-full mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer>
          <div className="py-20 text-center border border-border bg-surface">
            <p className="text-[length:var(--text-body)] text-text-secondary">{loadError}</p>
            <Link
              href="/collections"
              className="inline-block mt-4 text-[length:var(--text-small)] text-accent hover:text-accent-hover transition-colors"
            >
              ← 컬렉션 목록으로
            </Link>
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer>
          <div className="py-20 text-center border border-border bg-surface">
            <p className="text-[length:var(--text-body)] text-text-primary mb-2">
              컬렉션을 보려면 로그인이 필요합니다.
            </p>
            <Link
              href={`/login?redirectTo=/collections/${id}`}
              className="text-[length:var(--text-small)] text-accent hover:text-accent-hover transition-colors"
            >
              로그인하러 가기
            </Link>
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        <Link
          href="/collections"
          className="inline-block text-[length:var(--text-caption)] text-text-tertiary hover:text-text-primary transition-colors mb-6"
        >
          ← 컬렉션 목록
        </Link>

        <div className="border border-border bg-surface p-5 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    placeholder="컬렉션 제목"
                    className="w-full border border-border bg-background px-4 py-2 text-[length:var(--text-h2)] text-text-primary focus:outline-none focus:border-accent transition-colors"
                  />
                  <textarea
                    value={draftDescription}
                    onChange={(event) => setDraftDescription(event.target.value)}
                    rows={3}
                    placeholder="컬렉션 설명"
                    className="w-full resize-none border border-border bg-background px-4 py-2 text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleSaveCollection()}
                      isLoading={savingCollection}
                      disabled={!draftTitle.trim()}
                    >
                      저장
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDraftTitle(collection?.title ?? "");
                        setDraftDescription(collection?.description ?? "");
                        setIsEditing(false);
                      }}
                      disabled={savingCollection}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic text-text-primary">
                      {collection?.title}
                    </h1>
                    <span className="border border-border bg-background px-2 py-1 text-[length:var(--text-caption)] text-text-secondary">
                      스크랩 {items.length}개
                    </span>
                  </div>
                  <p className="text-[length:var(--text-small)] text-text-secondary mb-2">
                    {collection?.description?.trim() || "컬렉션 설명이 아직 없습니다."}
                  </p>
                  <p className="text-[length:var(--text-caption)] text-text-tertiary">
                    최근 수정: {collection ? formatDate(collection.updated_at) : "-"}
                  </p>
                </>
              )}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  편집
                </Button>
                <Button
                  onClick={() => void handleStartWriting()}
                  isLoading={startingWriting}
                  disabled={items.length === 0 || startingWriting}
                >
                  글 쓰기 시작
                </Button>
              </div>
            )}
          </div>

          {writingError && (
            <p className="mt-3 text-[length:var(--text-small)] text-text-secondary">{writingError}</p>
          )}
        </div>

        {items.length > 0 ? (
          <div className="space-y-3 mb-10">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="border border-border bg-background p-5 transition-colors hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[length:var(--text-caption)] text-text-tertiary font-mono">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    {item.scrap ? (
                      <>
                        <p className="text-[length:var(--text-small)] text-text-primary italic leading-relaxed mb-3">
                          &ldquo;{item.scrap.exact_quote}&rdquo;
                        </p>
                        {item.scrap.user_note && (
                          <p className="text-[length:var(--text-caption)] text-text-secondary mb-2">
                            노트: {item.scrap.user_note}
                          </p>
                        )}
                        <Link
                          href={getScrapSourceLink(item.scrap)}
                          className="text-[length:var(--text-caption)] text-accent hover:text-accent-hover transition-colors"
                        >
                          원문 아티클 보기
                        </Link>
                      </>
                    ) : (
                      <p className="text-text-tertiary text-[length:var(--text-small)]">
                        스크랩 데이터를 불러올 수 없습니다.
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemoveItem(item.id)}
                    isLoading={removingItemId === item.id}
                    disabled={removingItemId === item.id}
                  >
                    제거
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-border bg-surface mb-10">
            <p className="text-[length:var(--text-body)] text-text-secondary mb-2">
              이 컬렉션에 아직 소재가 없습니다.
            </p>
            <p className="text-[length:var(--text-small)] text-text-tertiary">
              아티클에서 텍스트를 드래그하여 소재를 추가해보세요.
            </p>
            <Link
              href="/articles"
              className="inline-block mt-4 text-[length:var(--text-small)] text-accent hover:text-accent-hover transition-colors"
            >
              아티클 둘러보기 →
            </Link>
          </div>
        )}

        <section className="border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[length:var(--text-h3)] font-semibold text-text-primary">
              컬렉션 노트
            </h2>
            <span className="text-[length:var(--text-caption)] text-text-tertiary">
              API 응답 기준
            </span>
          </div>

          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="border border-border bg-background p-4">
                  <p className="text-[length:var(--text-small)] text-text-primary whitespace-pre-wrap">
                    {note.content_markdown}
                  </p>
                  <p className="mt-2 text-[length:var(--text-caption)] text-text-tertiary">
                    수정: {formatDate(note.updated_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[length:var(--text-small)] text-text-secondary">
              아직 등록된 노트가 없습니다.
            </p>
          )}
        </section>

        {actionError && (
          <div className="mt-4 border border-border bg-surface p-4">
            <p className="text-[length:var(--text-small)] text-text-secondary">{actionError}</p>
          </div>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
