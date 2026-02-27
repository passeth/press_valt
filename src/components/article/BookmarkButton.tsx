"use client";

import { useState, useEffect, useCallback } from "react";

interface BookmarkButtonProps {
  slug: string;
  className?: string;
  size?: "sm" | "md";
}

export function BookmarkButton({ slug, className = "", size = "md" }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkBookmark = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/${slug}/bookmark`);
      if (res.ok) {
        const data = await res.json();
        setBookmarked(data.bookmarked);
      }
    } catch {
      // silently fail
    } finally {
      setChecking(false);
    }
  }, [slug]);

  useEffect(() => {
    checkBookmark();
  }, [checkBookmark]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      if (bookmarked) {
        const res = await fetch(`/api/articles/${slug}/bookmark`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) setBookmarked(false);
      } else {
        const res = await fetch(`/api/articles/${slug}/bookmark`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok || res.status === 409) setBookmarked(true);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const padding = size === "sm" ? "p-1.5" : "p-2";

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`${padding} rounded-[var(--radius-button)] transition-all hover:bg-surface-hover ${
        loading ? "opacity-50" : ""
      } ${className}`}
      title={bookmarked ? "북마크 해제" : "북마크"}
      aria-label={bookmarked ? "북마크 해제" : "북마크"}
    >
      {bookmarked ? (
        <svg className={`${iconSize} text-accent fill-current`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ) : (
        <svg className={`${iconSize} text-text-secondary`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
