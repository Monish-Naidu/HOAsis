"use client";

import { sameOriginPath } from "@/app/auth/callback/next-path";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, User } from "lucide-react";
import { Button, ButtonLink, Card, IconTile } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { requestPasswordReset, signInWithPassword, signUp } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import { retryRemote, useRemote } from "@/lib/data/remote-store";
import { readableLinkError } from "@/lib/email/link-error";

/**
 * Real seats on the real database for trying the product, read at build
 * time from NEXT_PUBLIC_TEST_LOGINS (a JSON list of label, who, email,
 * password). Empty when the variable is unset, so the card does not exist.
 * Monish chose to ship these on the live site for now (2026-09-26).
 */
const TEST_LOGINS: { label: string; who: string; email: string; password: string }[] = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_TEST_LOGINS;
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((l) => l && typeof l.email === "string" && typeof l.password === "string")
      : [];
  } catch {
    return [];
  }
})();

/**
 * Where somebody goes once they are signed in.
 *
 * Mirrors the rule in the auth callback, because arriving through a
 * confirmation email and arriving through this form should not put the same
 * person in two different places.
 */
async function destinationAfterSignIn(next: string | null): Promise<string> {
  // An explicit destination wins, but only a path on this site.
  const safe = sameOriginPath(next, window.location.origin);
  if (safe) return safe;
  try {
    const { data } = await supabaseBrowser().rpc("my_associations");
    const rows = (data ?? []) as { role: string }[];
    if (!rows.length) {
      // No association yet: waiting on a board, declined, wrong email or a
      // founder who has not started. The resident side holds the fork that
      // offers each the right door; /start is its second choice.
      return "/resident";
    }
    return rows.some((m) => m.role !== "resident") ? "/board" : "/resident";
  } catch {
    // If the lookup fails, the resident side is the safe landing: it shows
    // less rather than more, and the header still offers the switch.
    return "/resident";
  }
}

export function SignInPanel() {
  const router = useRouter();
  const { signIn, signOut, account, accounts, communities, community, setCommunity } =
    useAppState();
  const remote = useRemote();
  // Already in. A bookmark or the switcher used to land a signed in member on
  // this form as if they were a stranger; say who they are and offer the door.
  const signedIn = hasSupabase && remote.status === "ready" && remote.community !== null;

  // Seats come from whichever association is selected, so the front door
  // always offers the right people.
  const seats = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    unit: a.unit,
    role: ROLE_LABEL[a.role],
    isAdmin: a.role !== "resident",
  }));
  // Board seats, then two residents: enough to see both sides without a
  // fourteen-row list under the form.
  const sampleSeats = [
    ...seats.filter((s) => s.isAdmin),
    ...seats.filter((s) => !s.isAdmin).slice(0, 2),
  ];
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const [notice, setNotice] = useState<{ tone: "danger" | "ok"; text: string } | null>(
    params.get("error")
      ? { tone: "danger", text: readableLinkError(params.get("error")!, params.get("next")) }
      : null,
  );

  function enter(accountId: string) {
    signIn(accountId);
    const account = accounts.find((a) => a.id === accountId);
    router.push(account && account.role !== "resident" ? "/board" : "/resident");
  }

  /**
   * The real front door, when a project is configured.
   *
   * Without one this form has nothing to talk to, so it falls back to picking
   * the demo seat whose email was typed. That keeps the prototype clickable
   * for anyone evaluating it. The seat list only renders in that case.
   */
  /** A test seat: signs in straight away and lands where that person belongs. */
  async function enterTestLogin(login: { email: string; password: string }) {
    setMode("sign-in");
    setEmail(login.email);
    setPassword(login.password);
    setNotice(null);
    setBusy(true);
    const result = await signInWithPassword(login.email, login.password);
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "danger", text: result.message ?? "That test login did not work." });
      return;
    }
    await reloadAfterFailedLoad();
    router.push(await destinationAfterSignIn(params.get("next")));
  }

  /**
   * Somebody whose association failed to load and who signs in again as the
   * same person: auth sees nobody new and announces nothing, so the failed
   * load stood until a hard reload. Ask for it again before moving on.
   * retryRemote reads the store as it is now and does nothing unless the
   * last load failed, so this is safe after any sign in.
   */
  async function reloadAfterFailedLoad() {
    await retryRemote();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);

    if (!hasSupabase) {
      const match = accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      enter(match?.id ?? seats.find((s) => !s.isAdmin)!.id);
      return;
    }

    setBusy(true);
    const result =
      mode === "sign-in"
        ? await signInWithPassword(email, password)
        : await signUp(email, password, name);
    setBusy(false);

    if (!result.ok) {
      setNotice({ tone: "danger", text: result.message ?? "That did not work. Try again." });
      return;
    }
    if (result.message) {
      setNotice({ tone: "ok", text: result.message });
      return;
    }

    await reloadAfterFailedLoad();
    // The same question the confirmation link asks: what do they already
    // belong to? Sending every board member to the resident side and making
    // them find the switch was a small daily insult.
    router.push(await destinationAfterSignIn(params.get("next")));
  }

  return (
    <div className="space-y-4">
      {signedIn ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-body font-semibold text-fg">You are signed in</p>
            <p className="truncate text-footnote text-fg-muted">
              {account?.name ? `${account.name} · ` : ""}
              {remote.community?.settings.displayName}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign out
            </Button>
            <Button
              size="sm"
              onClick={async () => router.push(await destinationAfterSignIn(params.get("next")))}
            >
              Open my account
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border">
          {(["sign-in", "create"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "py-3 text-body font-medium transition-colors",
                mode === m
                  ? "-mb-px border-b-2 border-primary text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {m === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          {mode === "create" ? (
            <Field label="Full name" value={name} onChange={setName} placeholder="Jane Doe" autoComplete="name" />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            type="password"
            autoComplete={mode === "create" ? "new-password" : "current-password"}
          />
          {notice ? (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-footnote leading-snug",
                notice.tone === "danger" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
              )}
              role={notice.tone === "danger" ? "alert" : "status"}
            >
              {notice.text}
            </p>
          ) : null}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            type="submit"
            disabled={busy || !email.trim() || (hasSupabase && !password)}
          >
            {busy ? "One moment" : mode === "sign-in" ? "Sign in" : "Create account"}
            <ArrowRight className="size-4" />
          </Button>
          {mode === "sign-in" ? (
            <p className="text-center text-footnote text-fg-muted">
              <button
                type="button"
                className="hover:text-fg"
                disabled={busy}
                onClick={async () => {
                  if (!email.trim()) {
                    setNotice({
                      tone: "danger",
                      text: "Type your email first, then press Forgot your password again.",
                    });
                    return;
                  }
                  setBusy(true);
                  const result = await requestPasswordReset(email);
                  setBusy(false);
                  setNotice({
                    tone: result.ok ? "ok" : "danger",
                    text: result.message ?? "Check your email.",
                  });
                }}
              >
                Forgot your password?
              </button>
            </p>
          ) : (
            <p className="text-center text-footnote leading-snug text-fg-subtle">
              If your board already added your home, sign up with the email they used and it
              opens on its own. Have a join code?{" "}
              <Link href="/join" className="font-medium text-fg underline underline-offset-2">
                Join with the code
              </Link>
              . By creating an account you agree to the{" "}
              <Link href="/terms" className="font-medium text-fg underline underline-offset-2">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-fg underline underline-offset-2">
                Privacy policy
              </Link>
              .
            </p>
          )}
        </form>
      </Card>

      {/* The sample communities, and a seat in each.

          Willow Creek Estates is built into the browser, a year deep, and is the
          quickest way to see what the product does. Picking a seat signs
          you in as that person locally; the real project is untouched, and
          the header offers the real associations once somebody actually
          signs in. The same card is the whole front door when no project
          is configured. The front page's "See how it works" lands here
          by its id. */}
      {/* A real board seat for trying the product on this machine. Rendered
          only in development and only when the two NEXT_PUBLIC_TEST_LOGIN
          values are in .env.local (gitignored), so nothing about it reaches
          the deployed site or the repository. */}
      {TEST_LOGINS.length ? (
        <Card className="overflow-hidden">
          <div className="p-4">
            <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">
              Test logins
            </p>
            <p className="mt-1 text-body font-semibold text-fg">
              Real accounts on a real association.
            </p>
            <p className="mt-1 text-footnote leading-snug text-fg-muted">
              Pick one and you are in. Sign out from the card at the foot of the sidebar to try
              the next, and see what a treasurer, an officer and an owner each see.
            </p>
          </div>
          {TEST_LOGINS.map((l) => (
            <button
              key={l.email}
              type="button"
              disabled={busy}
              onClick={() => void enterTestLogin(l)}
              className="flex w-full items-center gap-3 border-t border-border px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-body font-medium text-fg">{l.label}</span>
                <span className="block truncate text-footnote text-fg-muted">{l.who}</span>
              </span>
              <span className="text-footnote font-medium text-accent">{busy ? "Signing in…" : "Sign in"}</span>
            </button>
          ))}
        </Card>
      ) : null}

      <Card id="sample" className="scroll-mt-6 overflow-hidden">
        <div className="p-4">
          <p className="text-caption font-semibold uppercase tracking-wide text-fg-subtle">Try the demo</p>
          <p className="mt-1 text-body font-semibold text-fg">
            A made-up association with sample data. Your own association is behind Sign in.
          </p>
          <p className="mt-1 text-footnote leading-snug text-fg-muted">
            {community.settings.displayName} is built into this browser with{" "}
            {community.association.unitCount} homes and a year of history. Pick a person to try it
            as. Nothing you do here is saved anywhere else.
          </p>
          {communities.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Sample community">
              {communities.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={option.id === community.id}
                  onClick={() => setCommunity(option.id)}
                  className={cn(
                    "press rounded-lg border px-3 py-1.5 text-footnote font-medium",
                    option.id === community.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {sampleSeats.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => enter(s.id)}
            className="flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <IconTile
              icon={s.isAdmin ? Building2 : User}
              tint={s.isAdmin ? "blue" : "neutral"}
              size="sm"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body font-medium text-fg">{s.name}</span>
              <span className="block text-footnote text-fg-muted">
                {s.role} · Unit {s.unit}
              </span>
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" />
          </button>
        ))}
        {hasSupabase ? (
          <div className="border-t border-border p-3">
            <ButtonLink href="/start" variant="ghost" size="sm" className="w-full">
              Or set up your own association
            </ButtonLink>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  // A password can be shown: typing blind with unsteady hands is where most
  // failed sign ins come from.
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block">
      <span className="mb-1 block text-footnote font-semibold text-fg-muted">
        {label}
      </span>
      <span className="relative block">
        <input
          type={isPassword && shown ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={cn(
            "h-11 w-full rounded-lg border border-border-2 bg-surface-2 px-3 text-body text-fg outline-none placeholder:text-fg-subtle focus:border-primary",
            isPassword && "pr-16",
          )}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-pressed={shown}
            className="press absolute inset-y-0.5 right-0.5 rounded-md px-3 text-footnote font-medium text-fg-muted hover:text-fg"
          >
            {shown ? "Hide" : "Show"}
          </button>
        ) : null}
      </span>
    </label>
  );
}
