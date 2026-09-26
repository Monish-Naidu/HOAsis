"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileText,
  Landmark,
  ListChecks,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Receipt,
  Search,
  ShieldAlert,
  Truck,
  Vote,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { IconTile, type TintName } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { BOARD_ROUTES } from "@/lib/board-routes";
import { moduleOn } from "@/lib/modules";
import {
  boardIndex,
  boardPages,
  boardShortcuts,
  groupHits,
  KIND_ROUTE,
  prepareIndex,
  recentStore,
  residentIndex,
  residentPages,
  residentShortcuts,
  searchIndex,
  segments,
  useRecentSearches,
  type Range,
  type SearchHit,
  type SearchKind,
} from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * One search field for the whole association, opened with ⌘K or the button
 * in the top bar.
 *
 * Nothing on the page changes while it is closed, which is the point: history
 * is reachable from anywhere without a filter bar on every tab. The palette
 * is mounted once per shell and the buttons only ask it to open, so two
 * headers (website and phone) never register the shortcut twice.
 */

const ICON: Record<SearchKind, LucideIcon> = {
  household: Building2,
  transaction: Landmark,
  document: FileText,
  thread: MessagesSquare,
  meeting: CalendarDays,
  ballot: Vote,
  request: ClipboardCheck,
  notice: ShieldAlert,
  vendor: Truck,
  announcement: Megaphone,
  post: MessageSquareText,
  action: ListChecks,
  charge: Receipt,
  page: ArrowRight,
  shortcut: Zap,
};

/* A tiny store, so any button can open the one palette. */
let openState = false;
const listeners = new Set<() => void>();
function setOpen(next: boolean) {
  openState = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function openSearch() {
  setOpen(true);
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** The button in a top bar. Compact is the icon alone, for a phone header. */
export function SearchButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  // The server cannot know the platform; the key cap resolves on the client.
  const mac = useSyncExternalStore(
    () => () => {},
    () => isMac(),
    () => true,
  );
  if (compact) {
    return (
      <button
        type="button"
        onClick={openSearch}
        aria-label="Search"
        className={cn(
          "press inline-flex size-10 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-2 hover:text-fg lg:size-9",
          className,
        )}
      >
        <Search className="size-4" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label="Search"
      className={cn(
        "press inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-footnote text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg",
        className,
      )}
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="hidden rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-caption font-medium text-fg-subtle sm:inline">
        {mac ? "⌘" : "Ctrl"} K
      </kbd>
    </button>
  );
}

export function SearchPalette() {
  const open = useSyncExternalStore(subscribe, () => openState, () => false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!openState);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;
  return <Palette onClose={() => setOpen(false)} />;
}


/** One row in the list: a hit from the index, a shortcut, or a recent choice. */
interface Row {
  key: string;
  kind: SearchKind;
  section: string;
  title: string;
  subtitle: string;
  href: string;
  tint: TintName;
  icon?: LucideIcon;
  titleRanges: Range[];
  subtitleRanges: Range[];
  /** The hit behind it, when it came from the index; remembered on open. */
  hit?: SearchHit;
}

/** The text with the matched pieces marked. */
function Highlight({ text, ranges }: { text: string; ranges: Range[] }) {
  if (ranges.length === 0) return <>{text}</>;
  return (
    <>
      {segments(text, ranges).map((s, i) =>
        s.hit ? (
          <mark key={i} className="rounded-sm bg-tint-amber-soft text-fg">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const { community, sees } = useAppState();
  const owner = useCurrentOwner();
  const pathname = usePathname();
  const router = useRouter();
  const board = pathname.startsWith("/board");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recent = useRecentSearches();

  // The board sees a kind only when its tab is open to this seat: same
  // capability and module gate the rail applies, looked up on the route
  // table. Pages go through `routeOffered` themselves. Folded once here, so
  // a keystroke is one pass over the index and no string normalisation.
  const index = useMemo(() => {
    if (!board) return prepareIndex([...residentPages(community), ...residentIndex(community, owner)]);
    const allowed = (kind: SearchKind) => {
      if (kind === "page" || kind === "shortcut" || kind === "charge") return true;
      const href = KIND_ROUTE[kind];
      const route = BOARD_ROUTES.filter((r) => href.startsWith(r.href)).sort(
        (a, b) => b.href.length - a.href.length,
      )[0];
      if (!route) return true;
      return moduleOn(route.module) && (!route.need || route.need.some((c) => sees(c)));
    };
    return prepareIndex([...boardPages(community, sees), ...boardIndex(community).filter((h) => allowed(h.kind))]);
  }, [board, community, owner, sees]);

  const trimmed = query.trim();
  const rows = useMemo<Row[]>(() => {
    if (trimmed === "") {
      // Recent, for this side of the product only: a board member's last
      // five households are not a resident's business.
      const prefix = board ? "/board" : "/resident";
      return recent
        .filter((e) => e.href.startsWith(prefix))
        .map((e) => ({
          key: `recent-${e.id}`,
          kind: e.kind,
          section: "Recent",
          title: e.title,
          subtitle: e.subtitle,
          href: e.href,
          tint: e.tint,
          titleRanges: [],
          subtitleRanges: [],
        }));
    }
    const shortcuts = board
      ? boardShortcuts(trimmed, community, sees)
      : residentShortcuts(trimmed, community, owner);
    const found = searchIndex(index, trimmed);
    return [
      ...shortcuts.map<Row>((h) => ({
        key: h.id,
        kind: h.kind,
        section: h.section,
        title: h.title,
        subtitle: h.subtitle,
        href: h.href,
        tint: h.tint,
        icon: h.icon,
        titleRanges: [],
        subtitleRanges: [],
        hit: h,
      })),
      ...found.map<Row>((s) => ({
        key: s.item.id,
        kind: s.item.kind,
        section: s.item.section,
        title: s.item.title,
        subtitle: s.item.subtitle,
        href: s.item.href,
        tint: s.item.tint,
        icon: s.item.icon,
        titleRanges: s.titleRanges,
        subtitleRanges: s.subtitleRanges,
        hit: s.item,
      })),
    ];
  }, [trimmed, board, community, sees, owner, index, recent]);

  const groups = useMemo(() => groupHits(rows, trimmed === "" ? 5 : 6), [rows, trimmed]);
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  const active = flat[Math.min(cursor, Math.max(flat.length - 1, 0))];

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, flat.length]);

  function go(row: Row) {
    if (row.hit) recentStore().remember(row.hit);
    onClose();
    router.push(row.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Home" && flat.length > 0) {
      e.preventDefault();
      setCursor(0);
    } else if (e.key === "End" && flat.length > 0) {
      e.preventDefault();
      setCursor(flat.length - 1);
    } else if (e.key === "Enter" && active) {
      e.preventDefault();
      go(active);
    }
  }

  const activeId = active ? `search-opt-${active.key}` : undefined;
  const canSearch = board
    ? "Names, homes, addresses, emails, phone numbers, requests, transactions and amounts, vendors, documents, meetings, ballots, announcements, messages, and any page by name."
    : "Documents, forms, meetings, ballots, your requests and notices, your charges and payments, announcements, and any page by name.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-navy-950/40 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onKeyDown={onKey}
        className="pop-in w-full max-w-[640px] overflow-hidden rounded-card border border-border bg-surface shadow-float"
      >
        <div data-bare-focus className="flex h-14 items-center gap-3 border-b border-border pl-4 pr-2">
          <Search className="size-4 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder={
              board
                ? "Search households, transactions, documents, meetings, pages…"
                : "Search documents, meetings, ballots, requests, pages…"
            }
            aria-label="Search"
            aria-controls="search-results"
            aria-activedescendant={activeId}
            autoComplete="off"
            spellCheck={false}
            className="h-full min-w-0 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle"
          />
          {/* A way out without a keyboard; tapping the backdrop is not obvious. */}
          <button
            type="button"
            onClick={onClose}
            className="press min-h-10 shrink-0 rounded-lg px-3 text-footnote font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            Close
          </button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto">
          {flat.length === 0 ? (
            trimmed === "" ? (
              <div className="px-4 py-5">
                <p className="text-footnote text-fg-muted">
                  Type a name, a unit, an amount, a subject, a vendor, a month, or a page. What you
                  open shows up here next time.
                </p>
                <p className="mt-2 text-caption text-fg-subtle">{canSearch}</p>
              </div>
            ) : (
              <div className="px-4 py-5">
                <p className="text-footnote text-fg-muted">Nothing matches &ldquo;{trimmed}&rdquo;.</p>
                <p className="mt-2 text-caption text-fg-subtle">
                  Try fewer words, a different spelling, or part of a name. You can search: {canSearch}
                </p>
              </div>
            )
          ) : (
            groups.map((group) => (
              <div key={group.section} className="py-1">
                <div className="flex items-center justify-between px-4 pb-1 pt-2">
                  <p className="text-caption font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                    {group.section}
                  </p>
                  {group.section === "Recent" ? (
                    <button
                      type="button"
                      onClick={() => {
                        recentStore().clear();
                        // The button goes with the list; keep the keys working.
                        inputRef.current?.focus();
                      }}
                      className="press rounded-md px-2 py-1 text-caption font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <ul>
                  {group.hits.map((row) => {
                    const on = row === active;
                    const Icon = group.section === "Recent" ? Clock : (row.icon ?? ICON[row.kind]);
                    return (
                      <li key={row.key} id={`search-opt-${row.key}`} role="option" aria-selected={on}>
                        <button
                          type="button"
                          tabIndex={-1}
                          data-active={on}
                          onMouseEnter={() => setCursor(flat.indexOf(row))}
                          onClick={() => go(row)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                            on ? "bg-surface-2" : "",
                          )}
                        >
                          <IconTile icon={Icon} tint={row.tint} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium text-fg">
                              {row.kind === "page" && group.section !== "Recent" ? "Go to " : ""}
                              <Highlight text={row.title} ranges={row.titleRanges} />
                            </span>
                            <span className="block truncate text-footnote text-fg-muted">
                              <Highlight text={row.subtitle} ranges={row.subtitleRanges} />
                            </span>
                          </span>
                          {on ? (
                            <span className="hidden shrink-0 text-caption text-fg-subtle sm:inline">↵</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <p className="flex items-center gap-4 border-t border-border px-4 py-2 text-caption text-fg-subtle">
          <span>↑↓ to move</span>
          <span>↵ to open</span>
          <span>esc to close</span>
          {trimmed !== "" && flat.length > 0 ? (
            <span className="ml-auto tnum">
              {rows.length} {rows.length === 1 ? "result" : "results"}
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
