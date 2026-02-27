"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scrap {
  id: string;
  exact_quote: string;
  user_note: string | null;
  source_revision_id: string;
  source_block_id: string;
  created_at: string;
  article_title: string | null;
  article_slug: string | null;
  article_thumbnail_url: string | null;
}

interface CollectionItem {
  id: string;
  collection_id: string;
  scrap_id: string | null;
  article_id: string | null;
  position: number;
  note: string | null;
  highlight_color: "yellow" | "green" | "blue" | "pink" | "purple" | null;
  created_at: string;
  updated_at: string;
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

// ---------------------------------------------------------------------------
// Tabs & sort config
// ---------------------------------------------------------------------------

type ViewTab = "by-date" | "by-note";
type SortOrder = "newest" | "oldest";

const VIEW_TABS: Array<{ id: ViewTab; label: string }> = [
  { id: "by-date", label: "날짜별" },
  { id: "by-note", label: "노트별" },
];

const SORT_OPTIONS: Array<{ id: SortOrder; label: string }> = [
  { id: "newest", label: "최신순" },
  { id: "oldest", label: "오래된순" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(value: string) {
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateGroupKey(value: string) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const weekday = d.toLocaleDateString("ko-KR", { weekday: "long" });
  return `${year}. ${month}. ${day}. ${weekday}`;
}

function formatTimestamp(value: string) {
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hours}:${minutes}`;
}

function dateOnlyKey(value: string) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Scrap Card (local component)
// ---------------------------------------------------------------------------

function ScrapCard({
  item,
  onRemove,
  isRemoving,
}: {
  item: CollectionItem;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}) {
  const scrap = item.scrap;

  return (
    <div className="border border-border bg-background p-5 flex flex-col justify-between transition-colors hover:bg-surface group">

      <div className="flex-1 mb-4">
        {scrap ? (
          <p className="text-[length:var(--text-body)] text-text-primary leading-relaxed">
            {scrap.exact_quote}
          </p>
        ) : (
          <p className="text-[length:var(--text-small)] text-text-tertiary">
            스크랩 데이터를 불러올 수 없습니다.
          </p>
        )}


        {scrap?.user_note && (
          <p className="mt-3 text-[length:var(--text-caption)] text-text-secondary border-l-2 border-border pl-3">
            {scrap.user_note}
          </p>
        )}


        {item.note && (
          <p className="mt-2 text-[length:var(--text-caption)] text-text-secondary border-l-2 border-border pl-3">
            {item.note}
          </p>
        )}
      </div>


      <div>

        {scrap && (
          <p className="text-[length:var(--text-caption)] text-text-tertiary mb-3">
            {formatTimestamp(scrap.created_at)}
          </p>
        )}


        {scrap?.article_slug && (
          <Link
            href={`/articles/${scrap.article_slug}`}
            className="flex items-center gap-3 border-t border-border-light pt-3 transition-colors hover:opacity-80"
          >
            {scrap.article_thumbnail_url ? (
              <img
                src={scrap.article_thumbnail_url}
                alt=""
                className="w-10 h-10 object-cover shrink-0 bg-surface"
              />
            ) : (
              <div className="w-10 h-10 bg-surface shrink-0 flex items-center justify-center">
                <span className="text-[length:var(--text-badge)] text-text-tertiary">N/A</span>
              </div>
            )}
            <span className="text-[length:var(--text-caption)] text-text-secondary line-clamp-2 min-w-0">
              {scrap.article_title ?? "원문 아티클"}
            </span>
          </Link>
        )}


        {scrap && !scrap.article_slug && (
          <Link
            href={`/articles?sourceRevisionId=${encodeURIComponent(scrap.source_revision_id)}`}
            className="block text-[length:var(--text-caption)] text-accent hover:text-accent-hover transition-colors border-t border-border-light pt-3"
          >
            원문 아티클 보기
          </Link>
        )}


        <div className="mt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item.id)}
            isLoading={isRemoving}
            disabled={isRemoving}
          >
            제거
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search icon SVG (inline)
// ---------------------------------------------------------------------------

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-tertiary"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-secondary"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

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


  const [activeTab, setActiveTab] = useState<ViewTab>("by-date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

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

  // ---------------------------------------------------------------------------
  // Derived: filtered, sorted, grouped items
  // ---------------------------------------------------------------------------

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = items;

    if (query) {
      result = result.filter((item) => {
        const quote = item.scrap?.exact_quote?.toLowerCase() ?? "";
        const userNote = item.scrap?.user_note?.toLowerCase() ?? "";
        const itemNote = item.note?.toLowerCase() ?? "";
        return quote.includes(query) || userNote.includes(query) || itemNote.includes(query);
      });
    }


    const sorted = [...result].sort((a, b) => {
      const dateA = new Date(a.scrap?.created_at ?? a.created_at).getTime();
      const dateB = new Date(b.scrap?.created_at ?? b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return sorted;
  }, [items, searchQuery, sortOrder]);

  const dateGroupedItems = useMemo(() => {
    const groups: Array<{ dateKey: string; dateLabel: string; items: CollectionItem[] }> = [];
    const groupMap = new Map<string, CollectionItem[]>();
    const groupOrder: string[] = [];

    for (const item of filteredItems) {
      const key = dateOnlyKey(item.scrap?.created_at ?? item.created_at);
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
        groupOrder.push(key);
      }
      groupMap.get(key)!.push(item);
    }

    for (const key of groupOrder) {
      const groupItems = groupMap.get(key)!;
      const sampleDate = groupItems[0].scrap?.created_at ?? groupItems[0].created_at;
      groups.push({
        dateKey: key,
        dateLabel: formatDateGroupKey(sampleDate),
        items: groupItems,
      });
    }

    return groups;
  }, [filteredItems]);


  useEffect(() => {
    if (!sortDropdownOpen) return;
    const handler = () => setSortDropdownOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [sortDropdownOpen]);

  // ---------------------------------------------------------------------------
  // Render: loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer>
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-5 w-80 mb-8" />
          <Skeleton className="h-10 w-full mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-full" />
            ))}
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: error
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render: auth required
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Render: main
  // ---------------------------------------------------------------------------

  const currentSortLabel = SORT_OPTIONS.find((o) => o.id === sortOrder)?.label ?? "최신순";

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


        <div className="mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="border border-border bg-surface p-5 space-y-3">
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
                  <h1 className="text-[length:var(--text-h1)] font-sans font-bold text-text-primary mb-2">
                    {collection?.title}
                  </h1>
                  {collection?.description?.trim() && (
                    <p className="text-[length:var(--text-small)] text-text-secondary mb-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-[length:var(--text-caption)] text-text-tertiary">
                    <span>스크랩 {items.length}개</span>
                    <span>·</span>
                    <span>최근 수정: {collection ? formatDateShort(collection.updated_at) : "-"}</span>
                  </div>
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


        <Tabs
          tabs={VIEW_TABS}
          activeTab={activeTab}
          onChange={(nextId) => setActiveTab(nextId as ViewTab)}
        />


        <div className="flex flex-wrap items-center justify-between gap-4 mt-6 mb-8">

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSortDropdownOpen((prev) => !prev);
              }}
              className="flex items-center gap-2 border border-border bg-background px-4 py-2 text-[length:var(--text-body)] text-text-primary hover:bg-surface transition-colors"
            >
              {currentSortLabel}
              <ChevronDownIcon />
            </button>
            {sortDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 border border-border bg-background shadow-soft min-w-[120px]">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortOrder(opt.id);
                      setSortDropdownOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-[length:var(--text-body)] transition-colors hover:bg-surface ${
                      sortOrder === opt.id ? "text-text-primary font-medium" : "text-text-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>


          <div className="flex items-center gap-2 border border-border bg-background px-3 py-2 flex-1 max-w-md">
            <SearchIcon />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="스크랩, 노트, 메모를 검색해보세요."
              className="flex-1 bg-transparent text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none"
            />
          </div>
        </div>


        {activeTab === "by-date" ? (

          filteredItems.length > 0 ? (
            <div className="space-y-10 mb-10">
              {dateGroupedItems.map((group) => (
                <section key={group.dateKey}>

                  <h2 className="text-[length:var(--text-h2)] font-sans font-bold text-text-primary mb-5">
                    {group.dateLabel}
                  </h2>


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.items.map((item) => (
                      <ScrapCard
                        key={item.id}
                        item={item}
                        onRemove={(itemId) => void handleRemoveItem(itemId)}
                        isRemoving={removingItemId === item.id}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : items.length > 0 ? (

            <div className="py-16 text-center border border-border bg-surface mb-10">
              <p className="text-[length:var(--text-body)] text-text-secondary">
                검색 결과가 없습니다.
              </p>
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
                아티클 둘러보기
              </Link>
            </div>
          )
        ) : (

          <div className="mb-10">
            {notes.length > 0 ? (
              <div className="space-y-4">
                {notes.map((note) => (
                  <div key={note.id} className="border border-border bg-background p-5 transition-colors hover:bg-surface">
                    <p className="text-[length:var(--text-body)] text-text-primary whitespace-pre-wrap leading-relaxed">
                      {note.content_markdown}
                    </p>
                    <p className="mt-3 text-[length:var(--text-caption)] text-text-tertiary">
                      수정: {formatDateShort(note.updated_at)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center border border-border bg-surface">
                <p className="text-[length:var(--text-body)] text-text-secondary">
                  아직 등록된 노트가 없습니다.
                </p>
              </div>
            )}
          </div>
        )}


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
