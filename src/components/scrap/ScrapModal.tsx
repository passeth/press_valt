"use client";

import { useState } from "react";
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
