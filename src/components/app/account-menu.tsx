"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Building2, LogOut, User } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Role switch and sign out. Switching views never signs you out. */
export function ViewSwitcher({ className }: { className?: string }) {
  const { account, view, setView } = useAppState();
  const router = useRouter();
  if (!account || account.role === "resident") return null;

  const go = (next: "resident" | "admin") => {
    setView(next);
    router.push(next === "admin" ? "/admin" : "/resident");
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
          { v: "admin" as const, label: "Admin", Icon: Building2 },
        ]
      ).map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={view === v}
          onClick={() => go(v)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors",
            view === v ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          <Icon className="size-3.5" />
          {label}
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
          <p className="text-[13px] font-medium text-fg">{account.name}</p>
          <p className="text-[11px] text-fg-muted">
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
          router.push("/");
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
  const router = useRouter();

  useEffect(() => {
    if (ready && !account) router.replace("/");
  }, [ready, account, router]);

  if (!ready || !account) return null;
  return <>{children}</>;
}
