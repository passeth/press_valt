"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ScrapItem {
  id: string;
  exact_quote: string;
  user_note: string | null;
  created_at: string;
}

interface ScrapSidebarProps {
  articleId?: string;
}

export function ScrapSidebar({ articleId }: ScrapSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [scraps, setScraps] = useState<ScrapItem[]>([]);

  const canUseSupabase =
    typeof window !== "undefined" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const fetchScraps = useCallback(async () => {
    if (!articleId) {
      setScraps([]);
      return;
    }

    const res = await fetch(
      `/api/scraps?article_id=${encodeURIComponent(articleId)}`,
      {
        method: "GET",
      }
    );

    if (!res.ok) {
      setScraps([]);
      return;
    }

    const data = (await res.json()) as { scraps?: ScrapItem[] };
    setScraps(data.scraps ?? []);
  }, [articleId]);

  useEffect(() => {
    if (!canUseSupabase || !articleId) return;

    const initialize = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);
      await fetchScraps();
    };

    void initialize();
  }, [articleId, canUseSupabase, fetchScraps]);

  const handleScrapClick = useCallback((quote: string) => {
    const articleRoot = document.querySelector(".article-content");
    if (!articleRoot) return;

    const walker = document.createTreeWalker(articleRoot, NodeFilter.SHOW_TEXT);
    let matchedNode: Text | null = null;

    while (walker.nextNode()) {
      const currentNode = walker.currentNode as Text;
      if ((currentNode.textContent || "").includes(quote)) {
        matchedNode = currentNode;
        break;
      }
    }

    if (!matchedNode?.parentElement) return;

    const highlightElement = matchedNode.parentElement.closest("[data-block-id]") || matchedNode.parentElement;

    highlightElement.scrollIntoView({ behavior: "smooth", block: "center" });
    highlightElement.classList.add("bg-surface", "ring-1", "ring-accent", "transition-colors");

    window.setTimeout(() => {
      highlightElement.classList.remove("bg-surface", "ring-1", "ring-accent", "transition-colors");
    }, 1800);
  }, []);

  const scrapCountText = useMemo(() => `📋 내 스크랩 (${scraps.length})`, [scraps.length]);

  const shouldRender = canUseSupabase && Boolean(articleId) && isAuthenticated;

  if (!shouldRender) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 border border-border border-r-0 bg-background text-text-primary px-3 py-2 rounded-l text-[length:var(--text-small)] hover:bg-surface transition-colors"
      >
        {scrapCountText}
      </button>

      <aside
        className={`fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-border bg-background transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="내 스크랩 사이드바"
      >
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[length:var(--text-h3)] text-text-primary">내 스크랩</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[length:var(--text-small)] text-text-secondary hover:text-text-primary transition-colors"
            >
              닫기
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {scraps.length === 0 ? (
              <p className="text-[length:var(--text-body)] text-text-secondary leading-relaxed">
                아직 스크랩이 없습니다. 텍스트를 드래그하여 소재를 추가해보세요.
              </p>
            ) : (
              scraps.map((scrap) => (
                <button
                  key={scrap.id}
                  type="button"
                  onClick={() => handleScrapClick(scrap.exact_quote)}
                  className="w-full text-left border border-border bg-surface hover:bg-background transition-colors p-3 space-y-2"
                >
                  <p className="text-[length:var(--text-body)] text-text-primary truncate">
                    &ldquo;{scrap.exact_quote}&rdquo;
                  </p>
                  {scrap.user_note ? (
                    <p className="text-[length:var(--text-small)] text-text-secondary leading-relaxed">
                      {scrap.user_note}
                    </p>
                  ) : (
                    <p className="text-[length:var(--text-small)] text-text-tertiary">메모 없음</p>
                  )}
                  <p className="text-[length:var(--text-caption)] text-text-tertiary">
                    {new Date(scrap.created_at).toLocaleString("ko-KR")}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
