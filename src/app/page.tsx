import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-[var(--width-content)] items-center justify-between px-6 py-4">
          <Link href="/articles" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Articles
          </Link>
          <Link href="/" className="text-xl font-bold tracking-tight">
            Press Vault
          </Link>
          <Link href="/login" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Login
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-[length:var(--text-display)] font-bold tracking-tight leading-tight mb-6">
            읽고, 모으고, 쓰는
            <br />
            지식 플랫폼
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed mb-10">
            아티클을 읽으며 마음에 드는 부분을 스크랩하고,
            <br />
            모은 소재를 기반으로 AI와 협업하여 나만의 글을 발행하세요.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/articles"
              className="inline-flex items-center justify-center rounded-sm bg-accent px-6 py-3 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
              아티클 둘러보기
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-sm border border-border px-6 py-3 text-sm font-medium text-text-primary hover:bg-surface transition-colors"
            >
              시작하기
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-[var(--width-content)] px-6 text-center text-sm text-text-tertiary">
          © 2026 Press Vault. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
