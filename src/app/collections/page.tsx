"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
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

type ViewTab = "date" | "note";
type SortOrder = "newest" | "oldest";

const VIEW_TABS: Array<{ id: ViewTab; label: string }> = [
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
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchScraps = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/scraps/enriched");

        if (!res.ok) {
          if (res.status === 401) {
            setAuthRequired(true);
            return;
          }
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? "스크랩을 불러오지 못했습니다.");
          return;
        }

        setAuthRequired(false);
        const data = (await res.json()) as { scraps?: EnrichedScrap[] };
        setScraps(data.scraps ?? []);
      } catch {
        setError("스크랩을 불러오는 중 문제가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    void fetchScraps();
  }, []);

  const grouped = useMemo(() => {
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

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        <div className="mb-8">
          <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic">
            문장스크랩
          </h1>
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
                  placeholder="스크랩, 노트, 메모를 검색하세요."
                  className="w-full border border-border bg-background pl-10 pr-4 py-2 text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="mb-6 border border-border bg-surface p-4">
                <p className="text-[length:var(--text-small)] text-text-secondary">{error}</p>
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
