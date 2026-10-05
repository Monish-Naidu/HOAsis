"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Clock, DoorOpen, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAppState } from "@/lib/app-state";
import { loadJoinStatus, useJoinStatus } from "@/lib/join-status";
import { loadRemote } from "@/lib/data/remote-store";
import { pendingDraftStore } from "@/lib/pending-draft";
import { cn, formatDate } from "@/lib/utils";
import { IconTile } from "@/components/ui/primitives";

/**
 * Signed in, belonging to nothing.
 *
 * The one fork for everybody who has an account and no association: the
 * wrong email at sign up, a declined request, a link copied for somebody
 * else, a founder who has not started yet. Every sign in and confirmation
 * link that finds no membership lands here, never in the founder's setup.
 * It always says who is signed in and always has a way out, because the
 * commonest cause is signing up with an address the board does not have.
 *
 * Three states. Waiting on a board: say so, name the board, offer a
 * refresh. Declined: say that plainly and offer the code again. Neither:
 * a join code first, because most people arrive with one, then setting up
 * a new association.
 */
export function NoAssociationYet() {
  const auth = useAuth();
  const { signOut } = useAppState();
  const requests = useJoinStatus(auth.user?.id ?? null);
  const pending = requests?.find((r) => r.status === "pending") ?? null;
  const declined = requests?.find((r) => r.status === "declined") ?? null;
  const email = auth.user?.email ?? "";
  // Only theirs: the answers are offered back to the address that gave them.
  const held = useSyncExternalStore(
    (fn) => pendingDraftStore.subscribe(fn),
    () => pendingDraftStore.getSnapshot(),
    () => null,
  );
  const unfinished =
    held && email && held.email.trim().toLowerCase() === email.trim().toLowerCase()
      ? held.draft.name.trim() || "your association"
      : null;

  const shell = "mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center";
  const signedInAs = email ? (
    <p className="mt-6 text-footnote text-fg-muted">
      Signed in as <span className="font-medium text-fg">{email}</span>
    </p>
  ) : null;
  const signOutButton = (
    <button
      type="button"
      onClick={() => signOut()}
      className="mt-1 self-center text-footnote font-medium text-accent hover:underline"
    >
      Sign out
    </button>
  );
  const secondary =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border-2 px-6 text-body font-semibold text-fg transition-colors hover:bg-surface-2";

  if (pending) {
    return (
      <div className={shell}>
        <IconTile icon={Clock} tint="amber" size="lg" className="mx-auto mb-4 float" />
        <h1 className="text-title2 font-semibold tracking-[-0.02em] text-fg">
          Waiting on the board of {pending.name}
        </h1>
        <p className="mt-2 text-body leading-relaxed text-fg-muted">
          Your account is ready. The board checks that {pending.unitLabel || "your home"} is yours and
          lets you in. We will email {email || "you"} when they do. Asked{" "}
          {formatDate(pending.createdAt.slice(0, 10), "medium")}.
        </p>
        <button
          type="button"
          onClick={() => {
            // A full reload, not a refresh: there is no active association
            // to refresh yet, and the point is to find out whether there is one now.
            loadJoinStatus(auth.user?.id ?? null, true);
            void loadRemote(auth.user?.id ?? null);
          }}
          className={cn(secondary, "mt-6 self-center px-5")}
        >
          <RefreshCw className="size-4" />
          Check again
        </button>
        <p className="mt-4 text-footnote text-fg-muted">
          Wrong association?{" "}
          <Link href="/join" className="font-medium text-accent hover:underline">
            Join another with a code
          </Link>
        </p>
        <p className="mt-1 text-footnote text-fg-subtle">
          Waiting more than a few days? Tell a board member you asked.
        </p>
        {signedInAs}
        {signOutButton}
      </div>
    );
  }

  if (declined) {
    return (
      <div className={shell}>
        <h1 className="text-title2 font-semibold tracking-[-0.02em] text-fg">
          The board of {declined.name} did not add your home
        </h1>
        <p className="mt-2 text-body leading-relaxed text-fg-muted">
          If that is a mistake, talk to a board member, then ask again.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link href="/join" className={secondary}>
            <DoorOpen className="size-4" />
            Ask again with the join code
          </Link>
        </div>
        {signedInAs}
        {signOutButton}
      </div>
    );
  }

  // A founder who answered every setup question and then went to confirm
  // their email comes back here with the association still to be created.
  // Their answers are held on this device; lead with them.
  if (unfinished) {
    return (
      <div className={shell}>
        <h1 className="text-title2 font-semibold tracking-[-0.02em] text-fg">
          Finish setting up {unfinished}
        </h1>
        <p className="mt-2 text-body leading-relaxed text-fg-muted">
          Your email is confirmed and your answers are saved on this device. One more press creates
          the association.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            href="/start"
            className="press shimmer inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 text-body font-semibold text-primary-fg shadow-raised hover:shadow-glow"
          >
            Pick up where you left off
          </Link>
          <Link href="/join" className={secondary}>
            <DoorOpen className="size-4" />
            Join with a code instead
          </Link>
        </div>
        {signedInAs}
        {signOutButton}
      </div>
    );
  }

  return (
    <div className={shell}>
      <h1 className="text-title2 font-semibold tracking-[-0.02em] text-fg">
        Let&apos;s find your association
      </h1>
      <p className="mt-2 text-body leading-relaxed text-fg-muted">
        Join yours with the code from your board, or set up a new one.
      </p>
      <div className="mt-6 flex flex-col items-center gap-3">
        <Link
          href="/join"
          className="press shimmer inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-gradient px-6 text-body font-semibold text-primary-fg shadow-raised hover:shadow-glow"
        >
          <DoorOpen className="size-4" />
          Join with a code
        </Link>
        <Link href="/start" className={secondary}>
          Set up a new association
        </Link>
      </div>
      {email ? (
        <p className="mt-6 text-footnote leading-snug text-fg-subtle">
          Your board said they added you? They may have used a different email. Ask them to change it
          to {email}.
        </p>
      ) : null}
      {signedInAs}
      {signOutButton}
    </div>
  );
}
