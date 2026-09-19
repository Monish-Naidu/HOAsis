"use client";

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
import { fetchJoinStatus } from "@/lib/join-status";
import { useRemote } from "@/lib/data/remote-store";

/**
 * Where somebody goes once they are signed in.
 *
 * Mirrors the rule in the auth callback, because arriving through a
 * confirmation email and arriving through this form should not put the same
 * person in two different places.
 */
async function destinationAfterSignIn(next: string | null): Promise<string> {
  // An explicit destination wins, but only a path on this site.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  try {
    const { data } = await supabaseBrowser().rpc("my_associations");
    const rows = (data ?? []) as { role: string }[];
    if (!rows.length) {
      // Waiting on a board is its own state, shown on the resident side.
      const pending = (await fetchJoinStatus()).some((j) => j.status === "pending");
      return pending ? "/resident" : "/start";
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
    params.get("error") ? { tone: "danger", text: readableLinkError(params.get("error")!) } : null,
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
      setNotice({ tone: "danger", text: result.message ?? "That did not work." });
      return;
    }
    if (result.message) {
      setNotice({ tone: "ok", text: result.message });
      return;
    }

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
            <p className="text-[15px] font-semibold text-fg">You are signed in</p>
            <p className="truncate text-[13px] text-fg-muted">
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
              Continue
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
                "py-3 text-[15px] font-medium transition-colors",
                mode === m
                  ? "border-b-2 border-navy-900 text-fg dark:border-navy-100"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              {m === "sign-in" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3 p-5">
          {mode === "create" ? (
            <Field label="Full name" value={name} onChange={setName} placeholder="Jane Doe" />
          ) : null}
          <Field
            label="Email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            type="email"
          />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            type="password"
          />
          {notice ? (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-[13px] leading-snug",
                notice.tone === "danger" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
              )}
              role="status"
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
            <p className="text-center text-[13px] text-fg-muted">
              <button
                type="button"
                className="hover:text-fg"
                disabled={busy}
                onClick={async () => {
                  if (!email.trim()) {
                    setNotice({
                      tone: "danger",
                      text: "Type your email address first, then press this again.",
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
            <p className="text-center text-[13px] leading-snug text-fg-subtle">
              If your board already added your home, sign up with the email they used and it
              opens on its own. Have a join code?{" "}
              <Link href="/join" className="font-medium text-fg hover:underline">
                Join with the code
              </Link>
              .
            </p>
          )}
        </form>
      </Card>

      {/* The sample communities, and a seat in each.

          Mehr Meadows is built into the browser, a year deep, and is the
          quickest way to see what the product does. Picking a seat signs
          you in as that person locally; the real project is untouched, and
          the header offers the real associations once somebody actually
          signs in. The same card is the whole front door when no project
          is configured. */}
      <Card className="overflow-hidden">
        <div className="p-4">
          <p className="text-[15px] font-semibold text-fg">Just looking? Try a sample community</p>
          <p className="mt-1 text-[13px] leading-snug text-fg-muted">
            {community.settings.displayName} is built into this browser with{" "}
            {community.association.unitCount} homes and a year of history. Pick a seat and look
            around. Nothing you do here is saved anywhere else.
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
                    "press rounded-lg border px-3 py-1.5 text-[13px] font-medium",
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
              <span className="block truncate text-[15px] font-medium text-fg">{s.name}</span>
              <span className="block text-[13px] text-fg-muted">
                {s.role} · Unit {s.unit}
              </span>
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" />
          </button>
        ))}
        {hasSupabase ? (
          <div className="border-t border-border p-3">
            <ButtonLink href="/start" variant="ghost" size="sm" className="w-full">
              Or set up your own community
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-semibold text-fg-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-border bg-surface-2 px-3 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-border-2"
      />
    </label>
  );
}

/** Confirmation links fail in a few ordinary ways. Say which. */
function readableLinkError(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("expired")) {
    return "That confirmation link has expired. Sign in below, or create the account again to get a fresh one.";
  }
  if (text.includes("already") || text.includes("used")) {
    return "That link has already been used. Your email is confirmed, so just sign in.";
  }
  return "That link did not work. Sign in below and we will sort it out.";
}
