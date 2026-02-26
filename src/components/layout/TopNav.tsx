"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function TopNav() {
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

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
      <nav className="mx-auto flex max-w-[var(--width-content)] items-center justify-between px-16 h-[60px]">
        {/* Left — article link */}
        <Link
          href="/articles"
          className="text-[length:var(--text-small)] font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          아티클
        </Link>

        {/* Center — logo */}
        <Link
          href="/"
          className="absolute left-1/2 -translate-x-1/2 font-serif font-bold text-[length:var(--text-logo)] tracking-[4px]"
        >
          PRESS VAULT
        </Link>

        {/* Right — auth */}
        <div className="flex items-center gap-6">
          {loading ? (
            <span className="w-16 h-4 bg-surface animate-pulse" />
          ) : user ? (
            <>
              <Link
                href="/dashboard"
                className="text-[length:var(--text-small)] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                대시보드
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
