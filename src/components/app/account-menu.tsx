"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { Building2, CircleHelp, LogOut, User } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { NoAssociationYet } from "@/components/app/no-association";
import { useRemote } from "@/lib/data/remote-store";
import { useAppState } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HummingbirdLoader } from "@/components/app/hummingbird";
import { supportMailto } from "@/lib/support";

/** Role switch and sign out. Switching views never signs you out. */
export function ViewSwitcher({ className }: { className?: string }) {
  const { account, setView } = useAppState();
  const router = useRouter();
  const pathname = usePathname();
  if (!account || account.role === "resident") return null;
  // The page you are on is the truth, not the stored session. A board member
  // who lands on /board from a link still saw "Resident" lit before this.
  const view: "resident" | "board" = pathname.startsWith("/board") ? "board" : "resident";

  const go = (next: "resident" | "board") => {
    setView(next);
    router.push(next === "board" ? "/board" : "/resident");
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="View"
    >
      {(
        [
          { v: "resident" as const, label: "Resident", Icon: User },
          { v: "board" as const, label: "Board", Icon: Building2 },
        ]
      ).map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          title={label}
          onClick={() => go(v)}
          className={cn(
            // The word at every width: a person and a building are not
            // obvious glyphs for "my home" and "the board".
            "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-footnote font-medium transition-colors",
            view === v ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          <Icon className="hidden size-3.5 sm:block" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * The person's own menu: who they are, help, sign out. One panel, opened
 * from the avatar in the bar on narrow screens and from the card at the
 * foot of the rail at lg, so the same person is never drawn twice on one
 * screen (Monish, 2026-09-26). Portalled to the body: the bar's tray sits on
 * the photo, which clips anything hanging below it.
 */
export function AccountPopover({
  place,
  onClose,
}: {
  place: { top?: number; bottom?: number; left?: number; right?: number };
  onClose: () => void;
}) {
  const { account, community, signOut } = useAppState();
  const router = useRouter();
  if (!account) return null;
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        role="menu"
        className="fixed z-50 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-float"
        style={place}
      >
        <div className="border-b border-border px-3.5 py-3">
          <p className="truncate text-body font-medium text-fg">{account.name}</p>
          <p className="truncate text-footnote text-fg-muted">
            {ROLE_LABEL[account.role]} · {homeLabel(community, account.unit)}
          </p>
        </div>
        {/* Help is a mailbox, not a widget: one address, the association
            named in the subject so the reply already knows who is writing. */}
        <a
          role="menuitem"
          href={supportMailto(`Help with ${community.settings.displayName}`)}
          onClick={onClose}
          className="flex min-h-11 items-center gap-2.5 px-3.5 text-body text-fg hover:bg-surface-2"
        >
          <CircleHelp className="size-4 text-fg-muted" />
          Help
        </a>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onClose();
            signOut();
            router.push("/signin");
          }}
          className="flex min-h-11 w-full items-center gap-2.5 px-3.5 text-left text-body text-fg hover:bg-surface-2"
        >
          <LogOut className="size-4 text-fg-muted" />
          Sign out
        </button>
      </div>
    </>,
    document.body,
  );
}

export function AccountMenu({ compact }: { compact?: boolean }) {
  const { account, community } = useAppState();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; right: number } | null>(null);
  if (!account) return null;

  function toggle(button: HTMLButtonElement) {
    if (open) {
      setOpen(false);
      return;
    }
    const r = button.getBoundingClientRect();
    setPlace({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setOpen(true);
  }

  return (
    // At lg the rail's own card is this menu; the bar's avatar would draw
    // the same person a second time on the same screen.
    <div className="relative lg:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${account.name}, account menu`}
        onClick={(e) => toggle(e.currentTarget)}
        className="press flex items-center gap-2 rounded-lg p-0.5 hover:bg-surface-2"
      >
        <Avatar name={account.name} />
        {!compact ? (
          <span className="hidden leading-tight lg:block">
            <span className="block text-body font-medium text-fg">{account.name}</span>
            <span className="block text-footnote text-fg-muted">
              {ROLE_LABEL[account.role]} · {homeLabel(community, account.unit)}
            </span>
          </span>
        ) : null}
      </button>
      {open && place ? <AccountPopover place={place} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/**
 * Sends anyone without a session back to sign in.
 *
 * The redirect runs in an effect rather than during render. Navigating from
 * inside a render pass is a React anti-pattern and can bounce a user who has
 * only just signed in.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { account, ready } = useAppState();
  const auth = useAuth();
  const remote = useRemote();
  const router = useRouter();

  // A real session takes a moment to resolve into an association, and
  // redirecting during that window bounces somebody who is signed in straight
  // back to the front door.
  const settling = auth.loading || remote.status === "loading";
  const signedIn = Boolean(account) || remote.status === "empty";

  useEffect(() => {
    if (ready && !settling && !signedIn) router.replace("/signin");
  }, [ready, settling, signedIn, router]);

  // The bird holds the page while the session resolves, instead of a blank.
  if (!ready || settling) {
    return <HummingbirdLoader className="min-h-dvh" label="Finding your association" />;
  }

  // Signed in, belonging to nothing. Founding an association is the only
  // sensible next move, so say that rather than showing empty screens.
  if (!account && remote.status === "empty") {
    return <NoAssociationYet />;
  }

  if (!account) return null;
  return <>{children}</>;
}
