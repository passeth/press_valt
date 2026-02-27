"use client";

import { useMemo } from "react";
import { TextSelectionHandler } from "@/components/scrap/TextSelectionHandler";
import { ScrapSidebar } from "@/components/scrap/ScrapSidebar";
import { injectBlockIds } from "@/lib/content/injectBlockIds";

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
  articleId?: string;
  blocks: Block[];
}

export function ArticleContent({
  renderedHtml,
  revisionId,
  articleId,
  blocks,
}: ArticleContentProps) {
  const renderedHtmlWithBlockIds = useMemo(
    () => injectBlockIds(renderedHtml, blocks),
    [renderedHtml, blocks]
  );

  return (
    <>
      <TextSelectionHandler sourceRevisionId={revisionId}>
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: renderedHtmlWithBlockIds }}
        />
      </TextSelectionHandler>
      <ScrapSidebar articleId={articleId} />
    </>
  );
}
