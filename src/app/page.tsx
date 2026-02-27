import Link from "next/link";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-[var(--page-padding-x)]">
        <div className="max-w-[var(--hero-max-width)] text-center">
          <h1 className="text-[length:var(--text-display)] font-serif font-bold italic tracking-[-2px] leading-[1.05] mb-6">
            읽고, 모으고, 쓰는
            <br />
            지식 플랫폼
          </h1>
          <p className="text-[length:var(--text-body)] text-text-secondary leading-relaxed mb-10">
            아티클을 읽으며 마음에 드는 부분을 스크랩하고,
            <br />
            모은 소재를 기반으로 AI와 협업하여 나만의 글을 발행하세요.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/articles"
              className="inline-flex items-center justify-center bg-accent px-[var(--button-padding-x)] py-[var(--button-padding-y)] text-[length:var(--text-body)] font-medium text-text-inverted hover:bg-accent-hover transition-colors rounded-[var(--radius-button)]"
            >
              아티클 둘러보기
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center border border-border px-[var(--button-padding-x)] py-[var(--button-padding-y)] text-[length:var(--text-body)] font-medium text-text-primary hover:bg-surface transition-colors rounded-[var(--radius-button)]"
            >
              시작하기
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
