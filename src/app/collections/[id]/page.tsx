"use client";

import { useEffect, useState, use } from "react";
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
  status: string;
  created_at: string;
  updated_at: string;
}

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCollection();
  }, [id]);

  const fetchCollection = async () => {
    try {
      const res = await fetch(`/api/collections/${id}`);
      if (!res.ok) {
        if (res.status === 404) setError("컬렉션을 찾을 수 없습니다.");
        else if (res.status === 401) router.push("/login");
        else setError("오류가 발생했습니다.");
        return;
      }
      const data = await res.json();
      setCollection(data.collection);
      setItems(data.items ?? []);
    } catch {
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const res = await fetch(`/api/collections/${id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId }),
    });

    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  const handleStartWriting = async () => {
    // Create a writing session for this collection
    const res = await fetch("/api/writing/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collection_id: id,
        model_provider: "anthropic",
        model_name: "claude-sonnet-4-20250514",
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/write/${data.session.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer>
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-4 w-96 mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </PageContainer>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <TopNav />
        <PageContainer>
          <div className="py-20 text-center">
            <p className="text-text-secondary">{error}</p>
            <Link
              href="/collections"
              className="inline-block mt-4 text-accent hover:text-accent-hover transition-colors text-[length:var(--text-small)]"
            >
              ← 컬렉션 목록으로
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
        {/* Back link */}
        <Link
          href="/collections"
          className="inline-block text-[length:var(--text-caption)] text-text-tertiary hover:text-text-primary transition-colors mb-6"
        >
          ← 컬렉션 목록
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[length:var(--text-h1)] font-serif font-semibold italic mb-2">
              {collection?.title}
            </h1>
            {collection?.description && (
              <p className="text-[length:var(--text-small)] text-text-secondary">
                {collection.description}
              </p>
            )}
          </div>
          <Button onClick={handleStartWriting} disabled={items.length === 0}>
            글 쓰기 시작
          </Button>
        </div>

        {/* Items */}
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="border border-border p-5 group hover:bg-surface transition-colors"
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
                        <p className="text-[length:var(--text-small)] text-text-primary italic leading-relaxed line-clamp-3">
                          &ldquo;{item.scrap.exact_quote}&rdquo;
                        </p>
                        {item.scrap.user_note && (
                          <p className="text-[length:var(--text-caption)] text-text-secondary mt-2">
                            📝 {item.scrap.user_note}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-text-tertiary text-[length:var(--text-small)]">
                        스크랩 데이터를 불러올 수 없습니다.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-[length:var(--text-caption)] text-text-tertiary hover:text-error transition-all shrink-0"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center border border-border">
            <p className="text-text-secondary text-[length:var(--text-body)] mb-2">
              이 컬렉션에 아직 소재가 없습니다.
            </p>
            <p className="text-text-tertiary text-[length:var(--text-small)]">
              아티클에서 텍스트를 드래그하여 소재를 추가해보세요.
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
