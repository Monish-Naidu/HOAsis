"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Button, Callout } from "@/components/ui/primitives";
import { signUp } from "@/lib/auth";
import { hasSupabase } from "@/lib/supabase/env";
import { unitCount, type CommunityDraft } from "@/lib/data/new-community";

/**
 * The account, asked for first, with the email confirmed last.
 *
 * It used to come at the end. A board typed a roster of eighty-eight
 * households, reached the last screen, and left rather than pick a password,
 * and nothing they had done existed anywhere but that one browser. Asking at
 * the end meant the lead only existed if they finished.
 *
 * So the account is created on the first screen, before any of the work, and
 * the work is never blocked on the confirmation email. Somebody who abandons
 * setup on step three still exists in Supabase with a name and an address.
 * Somebody who finishes has their draft held until the link in their inbox is
 * opened, and is offered it back the moment they return signed in.
 */

export type AccountStatus = "none" | "awaiting";

export function AccountStep({
  draft,
  patch,
  status,
  onExplore,
  onCreated,
  onContinue,
}: {
  draft: CommunityDraft;
  patch: (next: Partial<CommunityDraft>) => void;
  /** Whether an account was already created this session. */
  status: AccountStatus;
  /** Carry on without an account, which is a real choice and a labelled one. */
  onExplore: () => void;
  /** The account exists. `confirmationPending` when the email is still to come. */
  onCreated: (confirmationPending: boolean) => void;
  /** Move on, when the account was already made and they came back here. */
  onContinue: () => void;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const input =
    "h-11 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none transition-colors focus:border-brand";

  const name = draft.founder.name.trim();
  const email = draft.founder.email.trim();
  const ready = Boolean(name && email && password.length >= 8);

  async function create() {
    setFailure(null);
    if (!hasSupabase) {
      setFailure("Accounts are not available in this demo. Look around instead.");
      return;
    }
    setBusy(true);
    let result: Awaited<ReturnType<typeof signUp>>;
    try {
      result = await signUp(email, password, name);
    } catch (error) {
      result = {
        ok: false,
        message: error instanceof Error ? error.message : "That did not work.",
      };
    }
    setBusy(false);

    if (!result.ok) {
      setFailure(result.message ?? "That did not work.");
      return;
    }
    // A user and no session means the project confirms addresses by email.
    // That is noted and setup carries on; the link can wait.
    onCreated(Boolean(result.message));
  }

  if (status === "awaiting") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.028em] text-fg">
            Your account is ready
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-fg-muted">
            We sent a confirmation link to <span className="font-semibold text-fg">{email}</span>.
            Open it whenever you like. Setup carries on here in the meantime.
          </p>
        </div>
        <Button size="lg" onClick={onContinue}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
      </div>
    );
  }

  const alreadyHasAccount = failure ? /already/i.test(failure) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.028em] text-fg">
          Start with an account
        </h1>
        <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-fg-muted">
          So nothing you enter is lost. Confirming your email can wait until the end.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Your name</span>
          <input
            autoComplete="name"
            value={draft.founder.name}
            onChange={(e) => patch({ founder: { ...draft.founder, name: e.target.value } })}
            placeholder="Pat Founder"
            className={`mt-1.5 ${input}`}
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Your email</span>
          <input
            type="email"
            autoComplete="email"
            value={draft.founder.email}
            onChange={(e) => patch({ founder: { ...draft.founder, email: e.target.value } })}
            placeholder="you@example.com"
            className={`mt-1.5 ${input}`}
          />
        </label>
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Pick a password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least eight characters"
            className={`mt-1.5 ${input}`}
          />
        </label>
      </div>

      {failure ? (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger" role="status">
          {failure}
          {alreadyHasAccount ? (
            <>
              {" "}
              <Link href="/signin" className="font-semibold underline">
                Sign in instead
              </Link>
              .
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={busy || !ready} onClick={() => void create()}>
          {busy ? "One moment" : "Continue"}
          {busy ? null : <ArrowRight className="size-4" />}
        </Button>
        {/* A real choice, labelled. It used to be the only behaviour, and it
            was indistinguishable from having set the association up. */}
        <Button variant="ghost" size="lg" onClick={onExplore} disabled={busy}>
          Look around first
        </Button>
      </div>
      <p className="text-[13px] leading-relaxed text-fg-subtle">
        Looking around builds a copy in this browser only. It is not saved anywhere else,
        nobody else can sign in to it, and it is not the association. Come back signed in
        when you are ready and it takes three minutes.
      </p>
    </div>
  );
}

/**
 * Shown when setup is finished but the email is not yet confirmed.
 *
 * The draft is already held on the device by this point. The association is
 * created when they return through the link, from exactly what they typed.
 */
export function CheckEmailPanel({ draft, email }: { draft: CommunityDraft; email: string }) {
  return (
    <div className="animate-rise mx-auto w-full max-w-xl px-5 py-14">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
        <Mail className="size-6" />
      </span>
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] text-fg">
        Check your email
      </h1>
      <p className="mt-2 max-w-[52ch] text-[17px] leading-relaxed text-fg-muted">
        We sent a confirmation link to <span className="font-semibold text-fg">{email}</span>.
        Open it and {draft.name || "your association"} will be created with everything you
        just entered.
      </p>
      <Callout tone="ok" className="mt-6" title="Nothing is lost" icon={<Check className="size-4" />}>
        Your setup is saved on this device, including {pluralHomes(unitCount(draft))}. You will
        not be asked to type it again.
      </Callout>
    </div>
  );
}

function pluralHomes(n: number): string {
  return `${n} ${n === 1 ? "home" : "homes"}`;
}
