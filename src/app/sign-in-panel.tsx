"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Info, User } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

interface Seat {
  id: string;
  name: string;
  unit: string;
  role: string;
  isAdmin: boolean;
}

export function SignInPanel({ seats }: { seats: Seat[] }) {
  const router = useRouter();
  const { signIn, accounts } = useAppState();
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");

  function enter(accountId: string) {
    signIn(accountId);
    const account = accounts.find((a) => a.id === accountId);
    router.push(account && account.role !== "resident" ? "/admin" : "/resident");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const match = accounts.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
    );
    enter(match?.id ?? seats.find((s) => !s.isAdmin)!.id);
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
                "py-3 text-[13px] font-medium transition-colors",
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
            <>
              <Field label="Full name" value={name} onChange={setName} placeholder="Jane Doe" />
              <Field label="Unit number" value={unit} onChange={setUnit} placeholder="42" />
            </>
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
          <Button variant="primary" size="lg" className="w-full" type="submit">
            {mode === "sign-in" ? "Sign in" : "Create account"}
            <ArrowRight className="size-4" />
          </Button>
          {mode === "sign-in" ? (
            <p className="text-center text-[12px] text-fg-muted">
              <button type="button" className="hover:text-fg">
                Forgot your password?
              </button>
            </p>
          ) : (
            <p className="text-center text-[11px] leading-snug text-fg-subtle">
              New accounts are verified against the owner roster before they can see
              association records.
            </p>
          )}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-start gap-2 border-b border-border px-4 py-2.5">
          <Info className="mt-px size-3.5 shrink-0 text-fg-subtle" />
          <p className="text-[11px] leading-snug text-fg-muted">
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
              <span className="block truncate text-[13px] font-medium text-fg">{s.name}</span>
              <span className="block text-[11px] text-fg-muted">
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
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-fg outline-none placeholder:text-fg-subtle focus:border-border-2"
      />
    </label>
  );
}
