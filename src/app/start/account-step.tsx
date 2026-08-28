"use client";

import { useState } from "react";
import { Check, Mail } from "lucide-react";
import { Button, Callout } from "@/components/ui/primitives";
import { signUp } from "@/lib/auth";
import { savePendingDraft } from "@/lib/pending-draft";
import type { CommunityDraft } from "@/lib/data/new-community";

/**
 * The account, asked for at the end rather than the beginning.
 *
 * Asking up front loses people who have not decided yet. Never asking loses
 * their work, which is worse: the wizard used to build the whole association
 * in the browser and say nothing about it, so a board typed a roster of
 * eighty-eight households and ended up with something that existed in one
 * browser and nowhere else.
 *
 * So the work comes first and the account comes last, and the draft is held
 * while they confirm their email so nobody types a roster twice.
 */
export function AccountStep({
  draft,
  onExplore,
  onSignedIn,
}: {
  draft: CommunityDraft;
  /** Carry on without an account, which is a real choice and a labelled one. */
  onExplore: () => void;
  onSignedIn: () => void;
}) {
  const [email, setEmail] = useState(draft.founder.email);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const input =
    "h-11 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none transition-colors focus:border-brand";

  async function create() {
    setFailure(null);
    setBusy(true);
    const result = await signUp(email.trim(), password, draft.founder.name);
    setBusy(false);

    if (!result.ok) {
      setFailure(result.message ?? "That did not work.");
      return;
    }
    // Confirmation pending: hold the draft so it survives the round trip
    // through their email.
    if (result.message) {
      savePendingDraft(draft, email.trim());
      setSent(true);
      return;
    }
    onSignedIn();
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Mail className="size-6" />
        </span>
        <h2 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
          Check your email
        </h2>
        <p className="max-w-[52ch] text-[17px] leading-relaxed text-fg-muted">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-fg">{email.trim()}</span>. Open it and{" "}
          {draft.name || "your association"} will be created with everything you just
          entered.
        </p>
        <Callout tone="ok" title="Nothing is lost" icon={<Check className="size-4" />}>
          Your setup is saved on this device, including the{" "}
          {draft.households.length + 1} homes. You will not be asked to type it again.
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          Last thing: an account
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-[15px] leading-relaxed text-fg-muted">
          This is what makes {draft.name || "the association"} real rather than something
          that only exists in this browser. It is also how your board gets in.
        </p>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-semibold text-fg-muted">Your email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          disabled={busy || !email.trim() || password.length < 8}
          onClick={() => void create()}
        >
          {busy ? "One moment" : `Create ${draft.name || "the association"}`}
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
