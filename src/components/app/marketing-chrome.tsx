"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/library", label: "Library" },
  { href: "/about", label: "About" },
];

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href="/"
          aria-label="HOAsis home"
          className="transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.99]"
        >
          <Wordmark size={40} />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[15px] font-medium transition-colors",
                  active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/signin"
            className="hidden h-9 items-center rounded-lg px-3 text-[15px] font-medium text-fg-muted hover:text-fg sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href="/start"
            className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav className="border-t border-border px-5 py-2 md:hidden" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-[15px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8">
        <div>
          <Wordmark size={34} />
          <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-fg-muted">
            Community management for self-managed associations. Books that reconcile, an app
            residents use, and compliance handled.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          {[...LINKS, { href: "/signin", label: "Sign in" }].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] text-fg-muted hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto w-full max-w-6xl px-5 pb-8 text-[13px] text-fg-subtle">
        Prototype. Figures shown are fixture data for a fictional Washington association. The
        library is general information, not legal advice. Photography from Unsplash.
      </p>
    </footer>
  );
}

/**
 * Fades a section in the first time it scrolls into view.
 *
 * It used to animate on mount, which meant every section below the fold had
 * already finished before the reader got there. The whole page arrived at once
 * and then sat still. An observer is the difference between a page that
 * animates and a page that responds.
 *
 * The ref callback attaches the observer, so nothing sets state from inside an
 * effect body. It disconnects after the first crossing, because a section that
 * re-animates every time it scrolls past is a novelty the second time and an
 * irritation the fifth.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const attach = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof IntersectionObserver === "undefined") return;
    // Already in view on load, which is everything above the fold. Show it
    // without waiting for a scroll that may never come.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      // Fires a little before the element reaches the bottom edge, so it is
      // settling as it arrives rather than starting once it is already there.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
  }, []);

  return (
    <div
      ref={attach}
      className={cn("reveal", className)}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
