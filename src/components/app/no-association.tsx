"use client";

import Link from "next/link";
import { Clock, DoorOpen, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { loadJoinStatus, useJoinStatus } from "@/lib/join-status";
import { loadRemote } from "@/lib/data/remote-store";
import { formatDate } from "@/lib/utils";
import { IconTile } from "@/components/ui/primitives";

/**
 * Signed in, belonging to nothing.
 *
 * Three people land here. Somebody who asked to join with a code and is
 * waiting on the board: say so, name the board, and offer a refresh. Somebody
 * whose request was declined: say that too, plainly. Everybody else is
 * founding an association or has a code to type, and gets both doors.
 */
export function NoAssociationYet() {
  const auth = useAuth();
  const requests = useJoinStatus(auth.user?.id ?? null);
  const pending = requests?.find((r) => r.status === "pending") ?? null;
  const declined = requests?.find((r) => r.status === "declined") ?? null;

  if (pending) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
        <IconTile icon={Clock} tint="amber" size="lg" className="mx-auto mb-4 float" />
        <h1 className="text-title2 font-semibold tracking-[-0.02em] text-fg">
          Waiting on the board of {pending.name}
        </h1>
        <p className="mt-2 text-body leading-relaxed text-fg-muted">
          Your account is ready. The board confirms your home
          {pending.unitLabel ? ` at ${pending.unitLabel}` : ""} and lets you in, and you will get
          an email when they do. Asked {formatDate(pending.createdAt.slice(0, 10), "medium")}.
        </p>
        <button
          type="button"
          onClick={() => {
            // A full reload, not a refresh: there is no active association
            // to refresh yet, and the point is to find out whether there is one now.
            loadJoinStatus(auth.user?.id ?? null, true);
            void loadRemote(auth.user?.id ?? null);
          }}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 self-center rounded-xl border border-border-2 px-5 text-body font-semibold text-fg transition-colors hover:bg-surface-2"
        >
          <RefreshCw className="size-4" />
          Check again
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <h1 className="text-title2 font-semibold tracking-[-0.02em] text-fg">
        You are not in an association yet
      </h1>
      <p className="mt-2 text-body leading-relaxed text-fg-muted">
        {declined
          ? `The board of ${declined.name} did not add your home. If that is a mistake, ask them directly.`
          : "Set one up, or join yours with the code from your board."}
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/start"
          className="press shimmer inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 text-body font-semibold text-primary-fg shadow-raised hover:shadow-glow"
        >
          Set up your association
        </Link>
        <Link
          href="/join"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-2 px-6 text-body font-semibold text-fg transition-colors hover:bg-surface-2"
        >
          <DoorOpen className="size-4" />
          I have a join code
        </Link>
      </div>
    </div>
  );
}
