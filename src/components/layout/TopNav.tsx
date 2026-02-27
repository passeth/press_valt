"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/articles", label: "아티클", auth: false },
  { href: "/collections", label: "컬렉션", auth: true },
  { href: "/my-press", label: "나의 프레스", auth: true },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ? { id: user.id } : null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id } : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border rounded-b-[var(--radius-nav)]">
      <nav className="mx-auto flex max-w-[var(--width-content)] items-center justify-between px-[var(--page-padding-x)] h-[var(--nav-height)]">
        {/* Left — navigation links */}
        <div className="flex items-center gap-[var(--nav-gap)]">
          {NAV_LINKS.filter((link) => !link.auth || user).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-[length:var(--text-small)] font-medium transition-colors ${
                isActive(link.href)
                  ? "text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Center — logo */}
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 font-serif font-bold text-[length:var(--text-logo)] tracking-[4px]"
        >
          PRESS VAULT
        </Link>

        {/* Right — auth + dashboard */}
        <div className="flex items-center gap-[var(--nav-gap)]">
          {loading ? (
            <span className="w-16 h-4 bg-surface animate-pulse" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className={`text-[length:var(--text-small)] font-medium transition-colors ${
                  isActive("/dashboard")
                    ? "text-text-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                대시보드
              </Link>
              <Link
                href="/settings"
                className={`text-[length:var(--text-small)] transition-colors ${
                  isActive("/settings")
                    ? "text-text-primary"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                설정
              </Link>
              <button
                onClick={handleLogout}
                className="text-[length:var(--text-small)] text-text-tertiary hover:text-text-primary transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="text-[length:var(--text-small)] font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
