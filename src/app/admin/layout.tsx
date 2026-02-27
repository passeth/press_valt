import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-surface fixed left-0 top-0 h-screen">
        <div className="p-[var(--section-padding)]">
          <Link href="/admin" className="block text-sm font-bold tracking-tight mb-8">
            Press Vault Admin
          </Link>

          <nav className="space-y-1">
            <Link
              href="/admin/articles"
              className="block px-4 py-2 text-sm rounded-sm hover:bg-border transition-colors text-text-secondary hover:text-text-primary"
            >
              아티클 관리
            </Link>
            <Link
              href="/admin/users"
              className="block px-4 py-2 text-sm rounded-sm hover:bg-border transition-colors text-text-secondary hover:text-text-primary"
            >
              사용자 관리
            </Link>
            <Link
              href="/admin/subscriptions"
              className="block px-4 py-2 text-sm rounded-sm hover:bg-border transition-colors text-text-secondary hover:text-text-primary"
            >
              구독 관리
            </Link>
            <Link
              href="/admin/payments"
              className="block px-4 py-2 text-sm rounded-sm hover:bg-border transition-colors text-text-secondary hover:text-text-primary"
            >
              결제 관리
            </Link>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-60 flex-1">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
