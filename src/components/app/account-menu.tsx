"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, LogOut, User } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { NoAssociationYet } from "@/components/app/no-association";
import { useRemote } from "@/lib/data/remote-store";
import { useAppState } from "@/lib/app-state";
import { homeLabel } from "@/lib/wording";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HummingbirdLoader } from "@/components/app/hummingbird";

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

export function AccountMenu({ compact }: { compact?: boolean }) {
  const { account, community, signOut } = useAppState();
  const router = useRouter();
  if (!account) return null;

  return (
    <div className="flex items-center gap-2">
      <Avatar name={account.name} />
      {!compact ? (
        <div className="hidden leading-tight lg:block">
          <p className="text-body font-medium text-fg">{account.name}</p>
          <p className="text-footnote text-fg-muted">
            {ROLE_LABEL[account.role]} · {homeLabel(community, account.unit)}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => {
          signOut();
          router.push("/signin");
        }}
        className="press flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-footnote font-medium text-fg-muted hover:bg-surface-2 hover:text-fg lg:min-h-9"
      >
        <LogOut className="size-4" />
        <span aria-hidden className="hidden xl:inline">Sign out</span>
      </button>
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
