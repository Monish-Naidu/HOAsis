"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LogOut } from "lucide-react";
import { ResidentTitle } from "@/components/app/resident-title";
import { Card, IconTile } from "@/components/ui/primitives";
import { visibleResidentTabs } from "@/components/app/resident-nav";
import { useAppState } from "@/lib/app-state";

/**
 * Everything the phone's tab bar has no room for, as a list with a line
 * under each name, so no section is reachable only from the website. The
 * rows are the sidebar's, in the sidebar's order, with the same tiles.
 */
export default function ResidentMore() {
  const { settings, signOut } = useAppState();
  const router = useRouter();
  const rows = visibleResidentTabs(settings).filter((t) => t.webOnly);

  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="More" />

      <Card className="divide-y divide-border">
        {rows.map(({ href, label, webLabel, icon, tint, blurb }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <IconTile icon={icon} tint={tint} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold text-fg">{webLabel ?? label}</span>
              {blurb ? <span className="block text-footnote text-fg-muted">{blurb}</span> : null}
            </span>
            <ChevronRight className="size-4 shrink-0 text-fg-subtle" />
          </Link>
        ))}
      </Card>

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
