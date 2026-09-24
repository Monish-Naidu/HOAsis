"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, DoorOpen, ShieldCheck } from "lucide-react";
import { Button, ButtonLink, Card, SuccessMark } from "@/components/ui/primitives";
import { useAppState, useCommunityById, useStorageReady } from "@/lib/app-state";
import { useAuth, signUp } from "@/lib/auth";
import { parseInvitation } from "@/lib/invitations";
import { hasSupabase } from "@/lib/supabase/env";
import { money } from "@/lib/utils";

/**
 * Three ways in, one screen.
 *
 * With a join code, typed or carried on a link, the person creates their
 * account here, inside the association, and the board sees the request with
 * the account already made. When the board says yes the account opens on
 * their home; there is no second sign up to find.
 *
 * With an invitation link (`?invite=CODE&email=`), the board has already
 * put the household on the register against that address. Creating the
 * account with the same email claims the seat the moment the address is
 * confirmed. Nothing on the link is secret; the confirmation email is the
 * proof.
 *
 * With a demo invitation (`?c=&o=&k=`), the household is in this browser's
 * fixtures and the link signs them straight in.
 */
export function JoinPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const { setCommunity, signIn } = useAppState();

  const search = new URLSearchParams(params.toString());
  const invitation = parseInvitation(search);
  const hasToken = search.has("c") || search.has("o") || search.has("k");
  const ready = useStorageReady();
  const community = useCommunityById(invitation?.communityId);
  const owner = community?.owners.find((o) => o.id === invitation?.ownerId);
  const account = community?.accounts.find((a) => a.ownerId === invitation?.ownerId);

  if (!hasToken) {
    const invited = search.has("invite");
    return (
      <JoinWithCode
        initialCode={(search.get("invite") ?? search.get("code") ?? "").toUpperCase().slice(0, 6)}
        invitedEmail={invited ? (search.get("email") ?? "") : ""}
        invited={invited}
      />
    );
  }

  if (invitation && !ready) {
    return <Card className="h-40 animate-pulse bg-surface-2" aria-label="Loading invitation" />;
  }

  if (!invitation || !community || !owner || !account) {
    return (
      <Card className="p-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          This invitation is not valid
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          The link may have been mistyped or the household may no longer be on the register. Ask
          your board to send it again, or join with the association&apos;s code.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink href="/join" variant="primary" size="lg">
            Join with a code
          </ButtonLink>
          <ButtonLink href="/signin" variant="secondary" size="lg">
            Sign in
          </ButtonLink>
        </div>
      </Card>
    );
  }

  function accept() {
    setCommunity(community!.id);
    signIn(account!.id);
    router.push("/resident");
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <p className="text-[13px] font-semibold text-fg-muted">You have been invited to</p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {community.settings.displayName}
        </h1>
        <p className="mt-1 text-[15px] text-fg-muted">{community.association.addressLine}</p>
      </div>

      <div className="space-y-3 px-6 py-5">
        <Row label="Household" value={owner.displayName} />
        <Row label="Unit" value={owner.unit} />
        <Row
          label="Dues"
          value={`${money(community.association.duesCents)} ${community.association.duesCadence}`}
        />

        <Button variant="primary" size="md" className="mt-2 w-full" onClick={accept}>
          Open my account
          <ArrowRight className="size-4" />
        </Button>

        <p className="flex items-start gap-2 pt-1 text-[13px] leading-snug text-fg-subtle">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          This link was issued for your unit. Your board sees your balance and your requests;
          neighbors do not.
        </p>
      </div>
    </Card>
  );
}

const field =
  "h-11 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-primary disabled:bg-surface-2 disabled:text-fg-muted";
const label = "mb-1 block text-[13px] font-semibold text-fg-muted";

/* ------------------------------------------------------------------ code */

type Found = { name: string; place: string };

/**
 * One promise per code, so React's `use` gets the same object on every
 * render. A fresh promise each render would suspend forever.
 */
const lookups = new Map<string, Promise<Found | null>>();

function JoinWithCode({
  initialCode,
  invitedEmail,
  invited,
}: {
  initialCode: string;
  invitedEmail: string;
  invited: boolean;
}) {
  const { lookupJoinCode } = useAppState();
  const [draft, setDraft] = useState(initialCode);
  // The code being looked at. Arriving with one on the link skips the first
  // step; typing one and pressing Continue sets it.
  const [code, setCode] = useState<string | null>(initialCode.length >= 4 ? initialCode : null);

  if (code) {
    if (!lookups.has(code)) lookups.set(code, lookupJoinCode(code));
    return (
      <Suspense fallback={<Card className="h-64 animate-pulse bg-surface-2" aria-label="Finding your association" />}>
        <JoinForm
          code={code}
          lookup={lookups.get(code)!}
          invitedEmail={invitedEmail}
          invited={invited}
          onRetry={() => {
            lookups.delete(code);
            setCode(null);
          }}
        />
      </Suspense>
    );
  }

  const canContinue = draft.trim().length >= 4;
  return (
    <Card
      as="form"
      className="overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        if (canContinue) setCode(draft.trim());
      }}
    >
      <div className="border-b border-border px-6 py-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted">
          <DoorOpen className="size-3.5" />
          Join your community
        </p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          Enter your join code
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
          Six characters, from your board or the welcome letter.
        </p>
      </div>
      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className={label}>Join code</span>
          <input
            value={draft}
            onChange={(e) =>
              setDraft(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
            }
            placeholder="A1B2C3"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={`${field} font-mono tracking-[0.2em]`}
            autoFocus
          />
        </label>
        <Button variant="primary" size="md" type="submit" className="w-full" disabled={!canContinue}>
          Continue
          <ArrowRight className="size-4" />
        </Button>
        <p className="text-center text-[13px] text-fg-subtle">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ form */

function JoinForm({
  code,
  lookup,
  invitedEmail,
  invited,
  onRetry,
}: {
  code: string;
  lookup: Promise<Found | null>;
  invitedEmail: string;
  invited: boolean;
  onRetry: () => void;
}) {
  const found = use(lookup);
  const auth = useAuth();
  const { requestToJoin } = useAppState();
  const signedIn = Boolean(auth.user);
  const signedInEmail = auth.user?.email ?? "";
  const signedInName =
    (auth.user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? "";

  const [name, setName] = useState(signedInName);
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"check-email" | "waiting" | null>(null);

  if (!found) {
    return (
      <Card className="p-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          No association has the code {code}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          Check the letter or ask your board. Codes are six letters and numbers.
        </p>
        <Button variant="secondary" size="md" className="mt-5" onClick={onRetry}>
          Try another code
        </Button>
      </Card>
    );
  }

  const needsAccount = hasSupabase && !signedIn;
  const effectiveEmail = signedIn ? signedInEmail : email;
  const ready =
    (signedIn || name.trim().length > 0) &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(effectiveEmail) &&
    (!needsAccount || password.length >= 8);

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (needsAccount) {
        const made = await signUp(email, password, name);
        if (!made.ok) {
          setError(made.message ?? "That did not work.");
          return;
        }
      }
      if (!invited) {
        const result = await requestToJoin({
          code,
          name: signedIn ? signedInName || name : name,
          email: effectiveEmail,
          unit,
          note,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      setDone(needsAccount ? "check-email" : "waiting");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Card className="p-6">
        <SuccessMark size={48} className="mb-3" />
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          {done === "check-email" ? "Check your email" : `Sent to the board of ${found.name}`}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          {done === "check-email"
            ? invited
              ? `One tap on the link we sent to ${effectiveEmail} confirms your address and opens your home at ${found.name}.`
              : `One tap on the link we sent to ${effectiveEmail} confirms your address. The board of ${found.name} then confirms your home, and you will get an email when they let you in.`
            : `The board confirms your home and lets you in. You will get an email when they do.`}
        </p>
        <ButtonLink
          href={done === "waiting" ? "/resident" : "/signin"}
          variant="secondary"
          size="lg"
          className="mt-5"
        >
          {done === "waiting" ? "Go to my account" : "Go to sign in"}
        </ButtonLink>
      </Card>
    );
  }

  const alreadyRegistered = error?.toLowerCase().includes("already an account");

  return (
    <Card
      as="form"
      className="overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="border-b border-border px-6 py-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted">
          <DoorOpen className="size-3.5" />
          {invited ? "You were invited to" : "Join"}
        </p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {found.name}
        </h1>
        {found.place ? <p className="mt-1 text-[15px] text-fg-muted">{found.place}</p> : null}
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          {invited
            ? signedIn
              ? "Your board added your home. Your account is signed in, so it opens on its own."
              : "Your board added your home. Create your account with this email and it opens on its own."
            : signedIn
              ? "Tell the board which home is yours. They confirm it and let you in."
              : "Create your account here. The board confirms your home and lets you in."}
        </p>
      </div>

      <div className="space-y-4 px-6 py-5">
        {signedIn ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-fg-muted">
            Signed in as <span className="font-medium text-fg">{signedInEmail}</span>
          </p>
        ) : (
          <>
            <label className="block">
              <span className={label}>Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Priya Ellison"
                className={field}
                autoFocus
              />
            </label>
            <label className="block">
              <span className={label}>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                disabled={invited && Boolean(invitedEmail)}
                className={field}
              />
              {invited && invitedEmail ? (
                <span className="mt-1 block text-[13px] leading-snug text-fg-subtle">
                  The address your board used. Sign up with it and your home is waiting.
                </span>
              ) : null}
            </label>
            {needsAccount ? (
              <label className="block">
                <span className={label}>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={field}
                />
              </label>
            ) : null}
          </>
        )}

        {!invited ? (
          <>
            <label className="block">
              <span className={label}>Your home</span>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Street address, or unit or lot number"
                className={field}
                autoFocus={signedIn}
              />
            </label>
            <label className="block">
              <span className={label}>Anything the board should know (optional)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="We closed on the 14th."
                className="w-full rounded-lg border border-border-2 bg-surface px-3 py-2 text-[15px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle focus:border-primary"
              />
            </label>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
            {alreadyRegistered ? (
              <>
                {" "}
                <Link
                  href={`/signin?next=${encodeURIComponent(`/join?${invited ? "invite" : "code"}=${code}`)}`}
                  className="underline"
                >
                  Sign in, then come back here.
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <Button variant="primary" size="md" type="submit" className="w-full" disabled={!ready || busy}>
          {busy
            ? "One moment"
            : invited
              ? signedIn
                ? "Open my home"
                : "Create my account"
              : needsAccount
                ? "Create my account and ask to join"
                : "Ask to join"}
          <ArrowRight className="size-4" />
        </Button>

        {!signedIn ? (
          <p className="text-center text-[13px] text-fg-subtle">
            Already have an account?{" "}
            <Link
              href={`/signin?next=${encodeURIComponent(`/join?${invited ? "invite" : "code"}=${code}`)}`}
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-fg-muted">{label}</span>
      <span className="text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}
