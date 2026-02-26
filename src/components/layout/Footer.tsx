import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border py-8 mt-auto">
      <div className="mx-auto max-w-[var(--width-content)] px-16 flex items-center justify-between">
        <p className="text-[length:var(--text-small)] text-text-tertiary">
          © 2026 Press Vault
        </p>
        <div className="flex items-center gap-6">
          <Link
            href="/about"
            className="text-[length:var(--text-small)] text-text-tertiary hover:text-text-primary transition-colors"
          >
            About
          </Link>
          <Link
            href="/terms"
            className="text-[length:var(--text-small)] text-text-tertiary hover:text-text-primary transition-colors"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-[length:var(--text-small)] text-text-tertiary hover:text-text-primary transition-colors"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
