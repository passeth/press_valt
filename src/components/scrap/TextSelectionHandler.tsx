"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { FloatingScrapButton } from "./FloatingScrapButton";
import { ScrapModal } from "./ScrapModal";

interface TextSelectionHandlerProps {
  children: React.ReactNode;
  sourceRevisionId: string;
  className?: string;
}

interface SelectionState {
  text: string;
  prefix: string;
  suffix: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  buttonPosition: { x: number; y: number };
}

export function TextSelectionHandler({
  children,
  sourceRevisionId,
  className = "",
}: TextSelectionHandlerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleMouseUp = useCallback(() => {
    // Scrap requires a valid Supabase revision ID
    if (!sourceRevisionId) return;

    // Small delay to let browser finish selection
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelection(null);
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length < 5) {
        setSelection(null);
        return;
      }

      const range = sel.getRangeAt(0);

      // Ensure selection is within our container
      if (
        !containerRef.current ||
        !containerRef.current.contains(range.commonAncestorContainer)
      ) {
        setSelection(null);
        return;
      }

      // Find the closest block element with data-block-id
      const startNode =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as HTMLElement)
          : range.startContainer.parentElement;

      const blockElement = startNode?.closest("[data-block-id]");
      const blockId = blockElement?.getAttribute("data-block-id") || "unknown";

      // Get surrounding context for the TextQuoteSelector
      const fullText = blockElement?.textContent || "";
      const textBefore = fullText.substring(
        0,
        Math.max(0, fullText.indexOf(text))
      );
      const textAfter = fullText.substring(
        fullText.indexOf(text) + text.length
      );
      const prefix = textBefore.slice(-30);
      const suffix = textAfter.slice(0, 30);

      // Get button position relative to the container
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current!.getBoundingClientRect();

      // Position: horizontally centered on the selection end,
      // vertically right below the selection bottom — relative to container
      setSelection({
        text,
        prefix,
        suffix,
        blockId,
        startOffset: range.startOffset,
        endOffset: range.endOffset,
        buttonPosition: {
          x: rect.left + rect.width / 2 - containerRect.left,
          y: rect.bottom - containerRect.top + 6,
        },
      });
    }, 10);
  }, [sourceRevisionId]);

  // Clear selection on click outside (but not when modal is open)
  const hasSelection = selection !== null;
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (modalOpen) return;
      const target = e.target as HTMLElement;
      if (hasSelection && !target.closest("[data-scrap-btn]")) {
        setSelection(null);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [hasSelection, modalOpen]);

  return (
    <>
      <div
        ref={containerRef}
        className={`article-content relative ${className}`}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
      >
        {children}

        {/* Floating scrap button — inside container for correct absolute positioning */}
        {sourceRevisionId && selection && !modalOpen && (
          <div data-scrap-btn>
            <FloatingScrapButton
              position={selection.buttonPosition}
              onClick={() => setModalOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Scrap modal */}
      {selection && (
        <ScrapModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
          selectedText={selection.text}
          prefix={selection.prefix}
          suffix={selection.suffix}
          sourceRevisionId={sourceRevisionId}
          sourceBlockId={selection.blockId}
          startOffset={selection.startOffset}
          endOffset={selection.endOffset}
          onSuccess={() => {
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
        />
      )}
    </>
  );
}
