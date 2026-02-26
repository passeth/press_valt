"use client";

import { TextSelectionHandler } from "@/components/scrap/TextSelectionHandler";

interface Block {
  id: string;
  block_id: string;
  block_type: string;
  plain_text: string | null;
  markdown_text: string | null;
  order_index: number;
}

interface ArticleContentProps {
  renderedHtml: string;
  revisionId: string;
  blocks: Block[];
}

export function ArticleContent({
  renderedHtml,
  revisionId,
}: ArticleContentProps) {
  return (
    <TextSelectionHandler sourceRevisionId={revisionId}>
      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
      />
    </TextSelectionHandler>
  );
}
