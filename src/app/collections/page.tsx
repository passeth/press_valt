"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";

interface EnrichedScrap {
  id: string;
  user_id: string;
  source_revision_id: string;
  source_block_id: string;
  start_offset: number;
  end_offset: number;
  exact_quote: string;
  prefix: string | null;
  suffix: string | null;
  user_note: string | null;
  selector: { type: string; exact: string; prefix?: string; suffix?: string };
  created_at: string;
  article_title: string | null;
  article_slug: string | null;
  article_thumbnail_url: string | null;
  article_category: string | null;
}

type ViewTab = "collection" | "date" | "note";
type SortOrder = "newest" | "oldest";

interface CollectionSummary {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CollectionDetailItem {
  scrap_id: string | null;
}

const VIEW_TABS: Array<{ id: ViewTab; label: string }> = [
  { id: "collection", label: "컬렉션별" },
  { id: "date", label: "날짜별" },
  { id: "note", label: "노트별" },
];

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = WEEKDAYS[d.getDay()];
  return `${year}. ${month}. ${day}. ${weekday}`;
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

export default function CollectionsPage() {
  const [scraps, setScraps] = useState<EnrichedScrap[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [collectionScrapIds, setCollectionScrapIds] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("collection");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [scrapsRes, collectionsRes] = await Promise.all([
          fetch("/api/scraps/enriched"),
          fetch("/api/collections"),
        ]);

        if (!scrapsRes.ok || !collectionsRes.ok) {
          if (scrapsRes.status === 401 || collectionsRes.status === 401) {
            setAuthRequired(true);
            return;
          }
          const data = (await scrapsRes.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "스크랩을 불러오지 못했습니다.");
          return;
        }

        setAuthRequired(false);
        const scrapsData = (await scrapsRes.json()) as { scraps?: EnrichedScrap[] };
        const collectionsData = (await collectionsRes.json()) as { collections?: CollectionSummary[] };
        setScraps(scrapsData.scraps ?? []);

        const activeCollections = (collectionsData.collections ?? []).filter(
          (collection) => collection.status === "active"
        );
        setCollections(activeCollections);

        if (activeCollections.length > 0) {
          const detailResults = await Promise.all(
            activeCollections.map(async (collection) => {
              const response = await fetch(`/api/collections/${collection.id}`);
              if (!response.ok) {
                return { id: collection.id, scrapIds: [] as string[] };
              }

              const detail = (await response.json()) as { items?: CollectionDetailItem[] };
              const scrapIds = (detail.items ?? [])
                .map((item) => item.scrap_id)
                .filter((scrapId): scrapId is string => scrapId !== null);

              return { id: collection.id, scrapIds };
            })
          );

          const nextCollectionScrapIds: Record<string, string[]> = {};
          for (const result of detailResults) {
            nextCollectionScrapIds[result.id] = result.scrapIds;
          }
          setCollectionScrapIds(nextCollectionScrapIds);
        } else {
          setCollectionScrapIds({});
        }
      } catch {
        setError("데이터를 불러오는 중 문제가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const grouped = useMemo(() => {
    if (activeTab === "collection") {
      return new Map<string, EnrichedScrap[]>();
    }

    const query = searchQuery.trim().toLowerCase();

    let filtered = scraps;
    if (query) {
      filtered = scraps.filter(
        (s) =>
          s.exact_quote.toLowerCase().includes(query) ||
          (s.user_note && s.user_note.toLowerCase().includes(query)) ||
          (s.article_title && s.article_title.toLowerCase().includes(query))
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });

    const groups = new Map<string, EnrichedScrap[]>();

    if (activeTab === "date") {
      for (const scrap of sorted) {
        const label = formatDateHeader(scrap.created_at);
        if (!groups.has(label)) {
          groups.set(label, []);
        }
        groups.get(label)!.push(scrap);
      }
    } else {
      for (const scrap of sorted) {
        const label = scrap.article_title ?? "출처 미상";
        if (!groups.has(label)) {
          groups.set(label, []);
        }
        groups.get(label)!.push(scrap);
      }
    }

    return groups;
  }, [scraps, searchQuery, sortOrder, activeTab]);

  const collectionCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const scrapById = new Map(scraps.map((scrap) => [scrap.id, scrap]));

    const sortedCollections = [...collections].sort((a, b) => {
      const diff = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortOrder === "newest" ? -diff : diff;
    });

    return sortedCollections
      .map((collection) => {
        const scrapIds = collectionScrapIds[collection.id] ?? [];
        const cardScraps = scrapIds
          .map((scrapId) => scrapById.get(scrapId))
          .filter((scrap): scrap is EnrichedScrap => scrap !== undefined);

        const matchesQuery =
          !query ||
          collection.title.toLowerCase().includes(query) ||
          (collection.description && collection.description.toLowerCase().includes(query)) ||
          cardScraps.some(
            (scrap) =>
              scrap.exact_quote.toLowerCase().includes(query) ||
              (scrap.user_note && scrap.user_note.toLowerCase().includes(query))
          );

        return {
          collection,
          scrapCount: cardScraps.length,
          matchesQuery,
        };
      })
      .filter((card) => card.matchesQuery);
  }, [collections, collectionScrapIds, scraps, searchQuery, sortOrder]);

  const handleCreateCollection = async () => {
    if (!newTitle.trim()) {
      return;
    }

    setCreating(true);
    setError("");

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "컬렉션 생성에 실패했습니다.");
        return;
      }

      const data = (await res.json()) as { collection: CollectionSummary };
      setCollections((prev) => [data.collection, ...prev]);
      setCollectionScrapIds((prev) => ({
        ...prev,
        [data.collection.id]: [],
      }));
      setNewTitle("");
      setShowCreate(false);
    } catch {
      setError("컬렉션 생성 중 문제가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic">
            문장스크랩
          </h1>
          <Button size="sm" onClick={() => setShowCreate((prev) => !prev)}>
            컬렉션 만들기
          </Button>
        </div>

        {authRequired ? (
          <div className="border border-border bg-surface p-8 text-center">
            <p className="text-[length:var(--text-body)] text-text-primary mb-2">
              스크랩을 보려면 로그인이 필요합니다.
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
            <Tabs
              tabs={VIEW_TABS}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as ViewTab)}
            />

            <div className="flex items-center justify-between gap-4 mt-6 mb-8">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="border border-border bg-background px-3 py-2 text-[length:var(--text-body)] text-text-primary focus:outline-none focus:border-accent transition-colors"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>

              <div className="relative flex-1 max-w-sm">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.3-4.3" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === "collection"
                      ? "컬렉션 또는 포함된 스크랩을 검색하세요."
                      : "스크랩, 노트, 메모를 검색하세요."
                  }
                  className="w-full border border-border bg-background pl-10 pr-4 py-2 text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="mb-6 border border-border bg-surface p-4">
                <p className="text-[length:var(--text-small)] text-text-secondary">{error}</p>
              </div>
            )}

            {showCreate && (
              <div className="border border-border bg-surface p-5 mb-6 flex items-center gap-3">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="새 컬렉션 이름"
                  className="flex-1 px-4 py-2 border border-border bg-background text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleCreateCollection();
                    }
                  }}
                />
                <Button onClick={() => void handleCreateCollection()} isLoading={creating} disabled={!newTitle.trim()}>
                  만들기
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowCreate(false);
                    setNewTitle("");
                  }}
                >
                  취소
                </Button>
              </div>
            )}

            {loading ? (
              <div className="space-y-8">
                <Skeleton className="h-8 w-64 mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-52 w-full" />
                  ))}
                </div>
              </div>
            ) : activeTab === "collection" ? (
              collectionCards.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collectionCards.map(({ collection, scrapCount }) => (
                    <Link
                      key={collection.id}
                      href={`/collections/${collection.id}`}
                      className="border border-border bg-background p-5 flex flex-col transition-colors hover:bg-surface rounded-[var(--radius-card)]"
                    >
                      <h2 className="text-[length:var(--text-body)] font-medium text-text-primary mb-1">
                        {collection.title}
                      </h2>
                      {collection.description && (
                        <p className="text-[length:var(--text-caption)] text-text-secondary line-clamp-2 mb-3">
                          {collection.description}
                        </p>
                      )}
                      <p className="text-[length:var(--text-caption)] text-text-tertiary mt-auto">
                        스크랩 {scrapCount}개 · {formatTimestamp(collection.updated_at)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="border border-border bg-surface py-16 text-center">
                  <p className="text-[length:var(--text-body)] text-text-primary mb-2">
                    아직 컬렉션이 없습니다.
                  </p>
                  <p className="text-[length:var(--text-small)] text-text-secondary mb-4">
                    컬렉션을 만들어 스크랩을 정리해보세요.
                  </p>
                  <Button onClick={() => setShowCreate(true)}>컬렉션 만들기</Button>
                </div>
              )
            ) : scraps.length === 0 ? (
              <div className="border border-border bg-surface py-16 text-center">
                <p className="text-[length:var(--text-body)] text-text-primary mb-2">
                  아직 스크랩이 없습니다.
                </p>
                <p className="text-[length:var(--text-small)] text-text-secondary mb-4">
                  아티클에서 텍스트를 드래그하여 스크랩해보세요.
                </p>
                <Link
                  href="/articles"
                  className="text-[length:var(--text-small)] text-accent hover:text-accent-hover transition-colors"
                >
                  아티클 둘러보기
                </Link>
              </div>
            ) : grouped.size === 0 ? (
              <div className="border border-border bg-surface py-16 text-center">
                <p className="text-[length:var(--text-body)] text-text-primary mb-2">
                  검색 결과가 없습니다.
                </p>
                <p className="text-[length:var(--text-small)] text-text-secondary">
                  다른 키워드로 검색해보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {Array.from(grouped.entries()).map(([label, groupScraps]) => (
                  <section key={label}>
                    <h2 className="text-[length:var(--text-h2)] font-serif font-semibold italic mb-6">
                      {label}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupScraps.map((scrap) => (
                        <div
                          key={scrap.id}
                          className="border border-border bg-background p-5 flex flex-col transition-colors hover:bg-surface"
                        >
                          <p className="text-[length:var(--text-small)] text-text-primary leading-relaxed line-clamp-6">
                            {scrap.exact_quote}
                          </p>

                          {scrap.user_note && (
                            <p className="text-[length:var(--text-caption)] text-text-secondary italic mt-2">
                              {scrap.user_note}
                            </p>
                          )}

                          <p className="text-[length:var(--text-caption)] text-text-tertiary mt-3">
                            {formatTimestamp(scrap.created_at)}
                          </p>

                          {(scrap.article_title || scrap.article_thumbnail_url) && (
                            <div className="mt-auto pt-3 border-t border-border-light">
                              {scrap.article_slug ? (
                                <Link
                                  href={`/articles/${scrap.article_slug}`}
                                  className="flex items-center gap-3 group/link"
                                >
                                  <div className="w-10 h-10 bg-surface shrink-0 overflow-hidden">
                                    {scrap.article_thumbnail_url ? (
                                      <img
                                        src={scrap.article_thumbnail_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full" />
                                    )}
                                  </div>
                                  <span className="text-[length:var(--text-caption)] text-text-primary line-clamp-2 group-hover/link:text-accent-hover transition-colors">
                                    {scrap.article_title}
                                  </span>
                                </Link>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-surface shrink-0 overflow-hidden">
                                    {scrap.article_thumbnail_url ? (
                                      <img
                                        src={scrap.article_thumbnail_url}
                                        alt=""
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full" />
                                    )}
                                  </div>
                                  <span className="text-[length:var(--text-caption)] text-text-primary line-clamp-2">
                                    {scrap.article_title ?? "출처 미상"}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
