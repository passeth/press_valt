import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border py-[var(--footer-padding-y)] mt-auto">
      <div className="mx-auto max-w-[var(--width-content)] px-[var(--page-padding-x)] flex items-center justify-between">
        <p className="text-[length:var(--text-small)] text-text-tertiary">
          © 2026 Press Vault
        </p>
        <div className="flex items-center gap-[var(--nav-gap)]">
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
