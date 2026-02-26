"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

interface Collection {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch("/api/collections");
      if (res.ok) {
        const data = await res.json();
        setCollections(data.collections);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setCollections((prev) => [data.collection, ...prev]);
        setNewTitle("");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      <PageContainer>
        {/* Header */}
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

        {/* Create new collection */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-border">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="새 컬렉션 이름..."
            className="flex-1 px-4 py-2 border border-border text-[length:var(--text-body)] text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent transition-colors"
          />
          <Button
            size="sm"
            onClick={handleCreate}
            isLoading={creating}
            disabled={!newTitle.trim()}
          >
            생성
          </Button>
        </div>

        {/* Collection list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : collections.length > 0 ? (
          <div className="space-y-3">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                href={`/collections/${collection.id}`}
                className="block border border-border p-5 hover:bg-surface transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[length:var(--text-body)] font-medium group-hover:text-accent transition-colors">
                      {collection.title}
                    </h3>
                    {collection.description && (
                      <p className="text-[length:var(--text-small)] text-text-secondary mt-1 line-clamp-1">
                        {collection.description}
                      </p>
                    )}
                  </div>
                  <p className="text-[length:var(--text-caption)] text-text-tertiary shrink-0 ml-4">
                    {new Date(collection.updated_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-text-secondary text-[length:var(--text-body)] mb-2">
              아직 컬렉션이 없습니다.
            </p>
            <p className="text-text-tertiary text-[length:var(--text-small)]">
              위에서 새 컬렉션을 만들거나, 아티클에서 텍스트를 스크랩해보세요.
            </p>
          </div>
        )}
      </PageContainer>

      <Footer />
    </div>
  );
}
