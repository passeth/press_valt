"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

interface CollectionDetailResponse {
  items?: Array<{ id: string }>;
}

type FilterTab = "active" | "archived";

const FILTER_TABS: Array<{ id: FilterTab; label: string }> = [
  { id: "active", label: "활성" },
  { id: "archived", label: "보관됨" },
];

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [scrapCounts, setScrapCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [updatingCollectionId, setUpdatingCollectionId] = useState<string | null>(null);

  useEffect(() => {
    void fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/collections");
      if (!res.ok) {
        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "컬렉션을 불러오지 못했습니다.");
        return;
      }

      setAuthRequired(false);
      const data = (await res.json()) as { collections?: Collection[] };
      const fetchedCollections = data.collections ?? [];
      setCollections(fetchedCollections);

      if (fetchedCollections.length === 0) {
        setScrapCounts({});
        return;
      }

      const detailResponses = await Promise.all(
        fetchedCollections.map(async (collection) => {
          const detailRes = await fetch(`/api/collections/${collection.id}`);
          if (!detailRes.ok) {
            return { collectionId: collection.id, count: 0 };
          }

          const detailData = (await detailRes.json()) as CollectionDetailResponse;
          return {
            collectionId: collection.id,
            count: detailData.items?.length ?? 0,
          };
        })
      );

      const nextCounts: Record<string, number> = {};
      detailResponses.forEach(({ collectionId, count }) => {
        nextCounts[collectionId] = count;
      });
      setScrapCounts(nextCounts);
    } catch {
      setError("컬렉션을 불러오는 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    setError("");
    setCreating(true);

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "컬렉션 생성에 실패했습니다.");
        return;
      }

      const data = (await res.json()) as { collection: Collection };
      setCollections((prev) => [data.collection, ...prev]);
      setScrapCounts((prev) => ({ ...prev, [data.collection.id]: 0 }));
      setNewTitle("");
      setNewDescription("");
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (collectionId: string, status: "active" | "archived") => {
    setError("");
    setUpdatingCollectionId(collectionId);

    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          setAuthRequired(true);
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "컬렉션 상태를 변경하지 못했습니다.");
        return;
      }

      const data = (await res.json()) as { collection: Collection };
      setCollections((prev) =>
        prev.map((collection) =>
          collection.id === collectionId ? data.collection : collection
        )
      );
    } catch {
      setError("컬렉션 상태 변경 중 문제가 발생했습니다.");
    } finally {
      setUpdatingCollectionId(null);
    }
  };

  const filteredCollections = collections.filter(
    (collection) => collection.status === activeTab
  );

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
              컬렉션
            </h1>
            <p className="text-[length:var(--text-small)] text-text-secondary">
              스크랩한 소재를 주제별로 모아 관리하세요.
            </p>
          </div>
        </div>

        {authRequired ? (
          <div className="border border-border bg-surface p-8 text-center">
            <p className="text-[length:var(--text-body)] text-text-primary mb-2">
              컬렉션을 보려면 로그인이 필요합니다.
            </p>
            <Link
              href="/login?redirectTo=/collections"
              className="text-[length:var(--text-small)] text-accent hover:text-accent-hover transition-colors"
            >
              로그인하러 가기
            </Link>
          </div>
        ) : (
          <>
            <div className="border border-border bg-surface p-4 mb-8">
              <p className="text-[length:var(--text-small)] text-text-secondary mb-3">
                새 컬렉션 만들기
              </p>
              <div className="grid grid-cols-1 gap-3">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void handleCreate();
                    }
                  }}
                  placeholder="컬렉션 제목"
                  className="w-full border border-border bg-background px-4 py-2 text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                />
                <textarea
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="설명 (선택)"
                  rows={3}
                  className="w-full resize-none border border-border bg-background px-4 py-2 text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => void handleCreate()}
                    isLoading={creating}
                    disabled={!newTitle.trim()}
                  >
                    컬렉션 생성
                  </Button>
                </div>
              </div>
            </div>

            <Tabs
              tabs={FILTER_TABS}
              activeTab={activeTab}
              onChange={(nextTabId) => setActiveTab(nextTabId as FilterTab)}
            />

            {error && (
              <div className="mt-4 border border-border bg-surface p-4">
                <p className="text-[length:var(--text-small)] text-text-secondary">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="space-y-4 mt-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 w-full" />
                ))}
              </div>
            ) : filteredCollections.length > 0 ? (
              <div className="space-y-4 mt-6">
                {filteredCollections.map((collection) => {
                  const isArchived = collection.status === "archived";
                  const isUpdating = updatingCollectionId === collection.id;

                  return (
                    <div
                      key={collection.id}
                      className="border border-border bg-background p-5 transition-colors hover:bg-surface"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Link
                              href={`/collections/${collection.id}`}
                              className="text-[length:var(--text-h3)] font-semibold text-text-primary hover:text-accent transition-colors"
                            >
                              {collection.title}
                            </Link>
                            <span className="border border-border bg-surface px-2 py-1 text-[length:var(--text-caption)] text-text-secondary">
                              스크랩 {scrapCounts[collection.id] ?? 0}개
                            </span>
                          </div>

                          <p className="text-[length:var(--text-small)] text-text-secondary mb-3">
                            {collection.description?.trim() || "설명이 아직 없습니다."}
                          </p>

                          <p className="text-[length:var(--text-caption)] text-text-tertiary">
                            최근 수정: {formatDate(collection.updated_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              void handleArchive(
                                collection.id,
                                isArchived ? "active" : "archived"
                              )
                            }
                            isLoading={isUpdating}
                            disabled={isUpdating}
                          >
                            {isArchived ? "활성으로 복원" : "보관"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 border border-border bg-surface py-16 text-center">
                <p className="text-[length:var(--text-body)] text-text-primary mb-2">
                  {activeTab === "active"
                    ? "아직 활성 컬렉션이 없습니다."
                    : "보관된 컬렉션이 없습니다."}
                </p>
                <p className="text-[length:var(--text-small)] text-text-secondary mb-4">
                  먼저 아티클을 읽고 스크랩을 모아 컬렉션을 만들어보세요.
                </p>
                <Link
                  href="/articles"
                  className="text-[length:var(--text-small)] text-accent hover:text-accent-hover transition-colors"
                >
                  아티클 둘러보기
                </Link>
              </div>
            )}
          </>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
