"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { createClient } from "@/lib/supabase/client";

interface ScrapModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText: string;
  prefix?: string;
  suffix?: string;
  sourceRevisionId: string;
  sourceBlockId: string;
  startOffset: number;
  endOffset: number;
  onSuccess?: () => void;
}

interface CollectionItem {
  id: string;
  title: string;
}

const NEW_COLLECTION_VALUE = "__new_collection__";

export function ScrapModal({
  isOpen,
  onClose,
  selectedText,
  prefix,
  suffix,
  sourceRevisionId,
  sourceBlockId,
  startOffset,
  endOffset,
  onSuccess,
}: ScrapModalProps) {
  const [note, setNote] = useState("");
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const fetchCollections = async () => {
      setLoadingCollections(true);

      try {
        const res = await fetch("/api/collections", { method: "GET" });

        if (!res.ok) {
          throw new Error("컬렉션 목록을 불러오지 못했습니다.");
        }

        const data = (await res.json()) as {
          collections?: CollectionItem[];
        };

        setCollections(data.collections ?? []);
      } catch {
        setCollections([]);
      } finally {
        setLoadingCollections(false);
      }
    };

    void fetchCollections();
  }, [isOpen]);

  const createCollection = async (title: string) => {
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "컬렉션 생성에 실패했습니다.");
    }

    const data = (await res.json()) as { collection?: CollectionItem };
    const createdCollection = data.collection;

    if (!createdCollection) {
      throw new Error("컬렉션 생성 결과를 확인할 수 없습니다.");
    }

    return createdCollection;
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("로그인이 필요합니다.");
        setSaving(false);
        return;
      }

      let collectionIdToUse =
        selectedCollectionId && selectedCollectionId !== NEW_COLLECTION_VALUE
          ? selectedCollectionId
          : undefined;

      if (selectedCollectionId === NEW_COLLECTION_VALUE) {
        const trimmedTitle = newCollectionTitle.trim();

        if (!trimmedTitle) {
          throw new Error("새 컬렉션 이름을 입력해주세요.");
        }

        const createdCollection = await createCollection(trimmedTitle);
        collectionIdToUse = createdCollection.id;
      }

      const res = await fetch("/api/scraps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_revision_id: sourceRevisionId,
          source_block_id: sourceBlockId,
          start_offset: startOffset,
          end_offset: endOffset,
          exact_quote: selectedText,
          prefix: prefix || null,
          suffix: suffix || null,
          user_note: note || null,
          collection_id: collectionIdToUse,
          selector: {
            type: "TextQuoteSelector" as const,
            exact: selectedText,
            prefix: prefix || undefined,
            suffix: suffix || undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "스크랩 저장에 실패했습니다.");
      }

      setNote("");
      setSelectedCollectionId("");
      setNewCollectionTitle("");
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNote("");
    setSelectedCollectionId("");
    setNewCollectionTitle("");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="소재로 추가">
      <div className="space-y-4">
        {/* Selected text preview */}
        <div className="border-l-3 border-accent pl-4 py-2 bg-surface">
          <p className="text-[length:var(--text-small)] text-text-primary leading-relaxed italic">
            &ldquo;{selectedText}&rdquo;
          </p>
        </div>

        {/* Note input */}
        <div>
          <label className="block text-[length:var(--text-small)] font-medium mb-2">
            메모 (선택)
          </label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="이 부분이 인상적인 이유, 활용 아이디어 등..."
            rows={3}
          />
        </div>

        <div>
          <label className="block text-[length:var(--text-small)] font-medium mb-2 text-text-primary">
            컬렉션 (선택)
          </label>
          <select
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
            className="w-full border border-border px-3 py-2 text-[length:var(--text-body)] bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
            disabled={loadingCollections || saving}
          >
            <option value="">컬렉션 선택 안 함</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
            <option value={NEW_COLLECTION_VALUE}>새 컬렉션 만들기</option>
          </select>
          {loadingCollections && (
            <p className="mt-2 text-[length:var(--text-small)] text-text-secondary">
              컬렉션을 불러오는 중입니다...
            </p>
          )}
        </div>

        {selectedCollectionId === NEW_COLLECTION_VALUE && (
          <div>
            <label className="block text-[length:var(--text-small)] font-medium mb-2 text-text-primary">
              새 컬렉션 이름
            </label>
            <input
              type="text"
              value={newCollectionTitle}
              onChange={(e) => setNewCollectionTitle(e.target.value)}
              placeholder="컬렉션 이름을 입력해주세요"
              className="w-full border border-border px-3 py-2 text-[length:var(--text-body)] bg-background text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
              disabled={saving}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-[length:var(--text-small)] text-error">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            취소
          </Button>
          <Button size="sm" isLoading={saving} onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}
