"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, User } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { useAuth } from "@/lib/auth";
import { useRemote } from "@/lib/data/remote-store";
import { useAppState } from "@/lib/app-state";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Role switch and sign out. Switching views never signs you out. */
export function ViewSwitcher({ className }: { className?: string }) {
  const { account, view, setView } = useAppState();
  const router = useRouter();
  if (!account || account.role === "resident") return null;

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
          onClick={() => go(v)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
            view === v ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          <Icon className="size-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function AccountMenu({ compact }: { compact?: boolean }) {
  const { account, signOut } = useAppState();
  const router = useRouter();
  if (!account) return null;

  return (
    <div className="flex items-center gap-2">
      <Avatar name={account.name} />
      {!compact ? (
        <div className="hidden leading-tight lg:block">
          <p className="text-[15px] font-medium text-fg">{account.name}</p>
          <p className="text-[13px] text-fg-muted">
            {ROLE_LABEL[account.role]} · Unit {account.unit}
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
        className="flex size-8 items-center justify-center rounded-lg text-fg-subtle hover:bg-surface-2 hover:text-fg"
      >
        <LogOut className="size-4" />
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

  if (!ready || settling) return null;

  // Signed in, belonging to nothing. Founding an association is the only
  // sensible next move, so say that rather than showing empty screens.
  if (!account && remote.status === "empty") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-fg">
          You are not in an association yet
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          Set one up, or ask your board to add your household and invite you with the email you
          signed up with.
        </p>
        <Link
          href="/start"
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-semibold text-brand-fg"
        >
          Set up your association
        </Link>
      </div>
    );
  }

  if (!account) return null;
  return <>{children}</>;
}
