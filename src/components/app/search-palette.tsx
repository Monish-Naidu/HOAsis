"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Landmark,
  ListChecks,
  Megaphone,
  MessageSquareText,
  MessagesSquare,
  Search,
  ShieldAlert,
  Truck,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { IconTile } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { BOARD_ROUTES } from "@/lib/board-routes";
import { moduleOn } from "@/lib/modules";
import {
  boardIndex,
  groupHits,
  KIND_ROUTE,
  residentIndex,
  searchHits,
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

function Palette({ onClose }: { onClose: () => void }) {
  const { community, can } = useAppState();
  const owner = useCurrentOwner();
  const pathname = usePathname();
  const router = useRouter();
  const board = pathname.startsWith("/board");
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The board sees a kind only when its tab is open to this seat: same
  // capability and module gate the rail applies, looked up on the route table.
  const index = useMemo(() => {
    if (!board) return residentIndex(community, owner);
    const allowed = (kind: SearchKind) => {
      const href = KIND_ROUTE[kind];
      const route = BOARD_ROUTES.filter((r) => href.startsWith(r.href)).sort(
        (a, b) => b.href.length - a.href.length,
      )[0];
      if (!route) return true;
      return moduleOn(route.module) && (!route.need || route.need.some((c) => can(c)));
    };
    return boardIndex(community).filter((h) => allowed(h.kind));
  }, [board, community, owner, can]);

  const hits = useMemo(() => searchHits(index, query), [index, query]);
  const groups = useMemo(() => groupHits(hits), [hits]);
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);
  const active = flat[Math.min(cursor, Math.max(flat.length - 1, 0))];

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, flat.length]);

  function go(hit: SearchHit) {
    onClose();
    router.push(hit.href);
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
    } else if (e.key === "Enter" && active) {
      e.preventDefault();
      go(active);
    }
  }

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
                ? "Search households, transactions, documents, meetings, requests…"
                : "Search documents, meetings, ballots, requests…"
            }
            aria-label="Search"
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

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {query.trim() === "" ? (
            <p className="px-4 py-5 text-footnote text-fg-muted">
              Type a name, a unit, a subject, a vendor, or a year. Everything the association has
              recorded is here.
            </p>
          ) : flat.length === 0 ? (
            <p className="px-4 py-5 text-footnote text-fg-muted">
              Nothing matches &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.section} className="py-1">
                <p className="px-4 pb-1 pt-2 text-caption font-semibold uppercase tracking-[0.06em] text-fg-subtle">
                  {group.section}
                </p>
                <ul>
                  {group.hits.map((hit) => {
                    const on = hit === active;
                    const Icon = ICON[hit.kind];
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          data-active={on}
                          onMouseEnter={() => setCursor(flat.indexOf(hit))}
                          onClick={() => go(hit)}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left",
                            on ? "bg-surface-2" : "",
                          )}
                        >
                          <IconTile icon={Icon} tint={hit.tint} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium text-fg">
                              {hit.title}
                            </span>
                            <span className="block truncate text-footnote text-fg-muted">
                              {hit.subtitle}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        {flat.length > 0 ? (
          <p className="flex items-center gap-4 border-t border-border px-4 py-2 text-caption text-fg-subtle">
            <span>↑↓ to move</span>
            <span>↵ to open</span>
            <span className="ml-auto tnum">
              {hits.length} {hits.length === 1 ? "result" : "results"}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
