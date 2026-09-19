"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";
import { cn } from "@/lib/utils";

/**
 * The nav from the deck of 2026-08-28: Home, Pricing, Resources.
 *
 * "Resources" is the library. The route keeps its name because links to it
 * exist; the label follows the design, because that is the word a board
 * member scans for.
 *
 * About is hidden for now on Monish's ask (2026-09-01). The page still
 * renders at /about for anyone holding the link; only the ways in are gone.
 */
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/library", label: "Resources" },
];

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/**
 * Whether the page has moved off the top.
 *
 * The design sets the nav straight on the hero with no bar of its own. A
 * sticky header still needs a ground once content scrolls under it, so this
 * is the one bit of browser state the header reads: transparent at the top,
 * solid after eight pixels. Read through `useSyncExternalStore` so the server
 * render and the first client render agree on "not scrolled".
 */
function useScrolled() {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 8,
    () => false,
  );
}

export function MarketingHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const scrolled = useScrolled();
  const solid = scrolled || open;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color] duration-300",
        solid ? "border-border bg-bg/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      {/* A fixed height, because the hero pulls itself up under this bar by
          exactly that much so the field runs to the top of the page. */}
      <div className="mx-auto flex h-[68px] w-full max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          href="/"
          aria-label="Your HOAsis home"
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
                  active ? "text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Over the hero photograph the muted ink vanished into the sky, so
              the two quiet controls sit on a frosted pill until the bar goes
              solid and can carry them itself. */}
          <div
            className={cn(
              "hidden items-center gap-1 rounded-full p-0.5 transition-[background-color,box-shadow] duration-300 sm:flex",
              !solid && "bg-surface/70 shadow-card backdrop-blur-md",
            )}
          >
            <ThemeToggle className="rounded-full" />
            <Link
              href="/signin"
              className="press inline-flex h-9 items-center rounded-full px-3 text-[15px] font-medium text-fg hover:bg-surface-2"
            >
              Log in
            </Link>
          </div>
          <Link
            href="/start"
            className="press shimmer inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-brand-gradient px-4 text-[15px] font-semibold text-primary-fg shadow-raised hover:shadow-glow"
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
            Moving your community forward. Everything your community needs to get
            things done quickly, all in one place.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          {[...LINKS, { href: "/signin", label: "Log in" }].map((link) => (
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
        Figures shown are demo data for a fictional Washington association. The library is
        general information, not legal advice. Photography from Unsplash.
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
  /** Milliseconds after the crossing. Siblings step by 60 to 90; more reads as waiting. */
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
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
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
