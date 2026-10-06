"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, LayoutDashboard, LogOut, Users } from "lucide-react";
import { ResidentTitle } from "@/components/app/resident-title";
import { Card, IconTile } from "@/components/ui/primitives";
import { residentMoreRows, visibleResidentTabs } from "@/components/app/resident-nav";
import { useAppState } from "@/lib/app-state";

/**
 * Everything the phone's tab bar has no room for, as a list with a line
 * under each name, so no section is reachable only from the website. The
 * rows are the sidebar's, in the sidebar's order and under its names, minus
 * the ones the bar already has. Pages under another row (Statement, Messages,
 * Voting) are that row's tabs, which draw on a phone too.
 */
export default function ResidentMore() {
  const { settings, signOut, account, setView, community, communities, setCommunity } = useAppState();
  const router = useRouter();
  const rows = residentMoreRows(visibleResidentTabs(settings));
  // On a phone the header has room for a name and three controls, so the two
  // switches the website keeps on the photo live here: back to the board for
  // an officer, and across to another association for somebody in two.
  // Without them a director who opened the resident side on a phone had no
  // way back but the address bar.
  const officer = Boolean(account) && account?.role !== "resident";
  const others = communities.filter((c) => c.id !== community.id);

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="More" />

      <Card className="divide-y divide-border">
        {rows.map(({ href, label, icon, tint, blurb }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <IconTile icon={icon} tint={tint} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-fg">{label}</span>
              {blurb ? <span className="block text-footnote text-fg-muted">{blurb}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
          </Link>
        ))}
      </Card>

      <Card>
        <Link
          href="/resident/messages#your-board"
          className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
        >
          <IconTile icon={Users} tint="neutral" size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-semibold text-fg">Your board</span>
            <span className="block text-footnote text-fg-muted">Who holds each office, and how to write to them</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
        </Link>
      </Card>

      {officer || others.length ? (
        <Card className="divide-y divide-border">
          {officer ? (
            <button
              type="button"
              onClick={() => {
                setView("board");
                router.push("/board");
              }}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <IconTile icon={LayoutDashboard} tint="neutral" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold text-fg">Board view</span>
                <span className="block text-footnote text-fg-muted">The board&apos;s side of {settings.displayName}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </button>
          ) : null}
          {others.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                // A real member switches in place. A demo seat is a different
                // person, so that one goes back to the door, as on the website.
                router.push(setCommunity(option.id) === "switched" ? "/resident" : "/signin");
              }}
              className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <IconTile icon={Building2} tint="neutral" size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-semibold text-fg">{option.label}</span>
                <span className="block truncate text-footnote text-fg-muted">
                  Switch association{option.place ? ` · ${option.place}` : ""}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
            </button>
          ))}
        </Card>
      ) : null}

      <button
        type="button"
        onClick={() => {
          signOut();
          router.push("/signin");
        }}
        className="press flex min-h-12 w-full items-center justify-center gap-2 rounded-card border border-border-2 bg-surface px-4 text-body font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="size-4" />
        Sign out
      </button>
    </div>
  );
}
