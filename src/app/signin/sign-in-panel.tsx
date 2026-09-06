"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Building2, Info, User } from "lucide-react";
import { Button, ButtonLink, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { ROLE_LABEL } from "@/lib/types";
import { cn } from "@/lib/utils";
import { requestPasswordReset, signInWithPassword, signUp } from "@/lib/auth";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";

/**
 * Where somebody goes once they are signed in.
 *
 * Mirrors the rule in the auth callback, because arriving through a
 * confirmation email and arriving through this form should not put the same
 * person in two different places.
 */
async function destinationAfterSignIn(): Promise<string> {
  try {
    const { data } = await supabaseBrowser().rpc("my_associations");
    const rows = (data ?? []) as { role: string }[];
    if (!rows.length) return "/start";
    return rows.some((m) => m.role !== "resident") ? "/board" : "/resident";
  } catch {
    // If the lookup fails, the resident side is the safe landing: it shows
    // less rather than more, and the header still offers the switch.
    return "/resident";
  }
}

export function SignInPanel() {
  const router = useRouter();
  const { signIn, accounts, communities, community, setCommunity } = useAppState();

  // Seats come from whichever association is selected, so the front door
  // always offers the right people.
  const seats = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    unit: a.unit,
    role: ROLE_LABEL[a.role],
    isAdmin: a.role !== "resident",
  }));
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
   * for anyone evaluating it, and is honest about which it is doing because
   * the seat list below is visible either way.
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
    router.push(await destinationAfterSignIn());
  }

  return (
    <div className="space-y-4">
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
              If your board has already added your household, signing up with the email they
              used puts you straight into your association.
            </p>
          )}
        </form>
      </Card>

      {hasSupabase ? (
        <Card className="p-4">
          <p className="text-[13px] font-semibold text-fg">Just looking?</p>
          <p className="mt-1 text-[13px] leading-snug text-fg-muted">
            Set up a community and look around before making an account. It is built in this
            browser only, and nothing about it is saved anywhere else.
          </p>
          <ButtonLink href="/start" variant="secondary" size="sm" className="mt-3 w-full">
            Look around first
          </ButtonLink>
        </Card>
      ) : null}

      {communities.length > 1 ? (
        <div className="flex gap-1.5" role="radiogroup" aria-label="Association">
          {communities.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === community.id}
              onClick={() => setCommunity(option.id)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                option.id === community.id
                  ? "border-navy-700 bg-brand-soft text-brand-soft-fg dark:border-navy-300"
                  : "border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-start gap-2 border-b border-border px-4 py-2.5">
          <Info className="mt-px size-3.5 shrink-0 text-fg-subtle" />
          <p className="text-[13px] leading-snug text-fg-muted">
            Prototype. No real accounts exist, so pick a seat and the app signs you in as
            that person.
          </p>
        </div>
        {seats.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => enter(s.id)}
            className={cn(
              "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2",
              i > 0 && "border-t border-border",
            )}
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                s.isAdmin
                  ? "bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950"
                  : "bg-surface-3 text-fg-muted",
              )}
            >
              {s.isAdmin ? <Building2 className="size-4" /> : <User className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium text-fg">{s.name}</span>
              <span className="block text-[13px] text-fg-muted">
                {s.role} · Unit {s.unit}
              </span>
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-fg-subtle" />
          </button>
        ))}
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
        className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-border-2"
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
