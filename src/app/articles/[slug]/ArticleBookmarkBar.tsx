"use client";

import { BookmarkButton } from "@/components/article/BookmarkButton";

export function ArticleBookmarkBar({ slug }: { slug: string }) {
  return <BookmarkButton slug={slug} size="md" />;
}
