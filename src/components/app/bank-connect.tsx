"use client";

import { useState } from "react";
import { Building2, Check, Landmark, Lock } from "lucide-react";
import { Button, Callout } from "@/components/ui/primitives";
import { supportedInstitutions } from "@/lib/data";
import { isHoasisError } from "@/lib/core/errors";
import { connectLinkedAccount, connectManualAccount } from "@/lib/payments/bank-accounts";
import type { AccountKind, BankAccount } from "@/lib/types";
import { cn, todayIsoDate } from "@/lib/utils";

/**
 * Connecting a bank account the association owns.
 *
 * Two routes, because the two halves of the market bank differently: a larger
 * association is usually at an institution we can hand off to, and a smaller
 * one is often at a local credit union where the treasurer simply has the
 * paperwork in a drawer.
 *
 * Neither route keeps an account number. The handoff never sees one, and the
 * manual route validates it, takes the last four, and discards the rest inside
 * `connectManualAccount`. Nothing that could move money out is stored.
 *
 * Shared by onboarding and the Money screen so there is one implementation of
 * a form that handles bank credentials, not two that can drift apart.
 */

const inputClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none transition-colors placeholder:text-fg-subtle focus:border-brand";

type Route = "link" | "manual";

export function BankConnect({
  kind = "operating",
  onConnect,
}: {
  kind?: AccountKind;
  onConnect: (account: BankAccount) => void;
}) {
  const [route, setRoute] = useState<Route>("link");
  const [manual, setManual] = useState({ institution: "", routingNumber: "", accountNumber: "" });
  const [error, setError] = useState<string | null>(null);

  function connectLinked(id: string) {
    const institution = supportedInstitutions.find((i) => i.id === id);
    if (!institution) return;
    const preferred =
      institution.accounts.find((a) => (kind === "reserve" ? a.type === "savings" : a.type === "checking")) ??
      institution.accounts[0];
    onConnect(
      connectLinkedAccount(
        { institution: institution.name, mask: preferred.mask, kind },
        todayIsoDate(),
      ),
    );
  }

  function connectTyped() {
    try {
      setError(null);
      onConnect(connectManualAccount({ ...manual, kind }, todayIsoDate()));
    } catch (caught) {
      setError(isHoasisError(caught) ? caught.message : "Could not connect that account");
    }
  }

  const ready =
    manual.institution.trim() && manual.routingNumber.trim() && manual.accountNumber.trim();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            { id: "link", label: "Find your bank", icon: Building2 },
            { id: "manual", label: "Enter details", icon: Landmark },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setRoute(id)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-[15px] font-medium transition-colors",
              route === id
                ? "border-navy-700 bg-brand-soft text-brand-soft-fg dark:border-navy-300"
                : "border-border text-fg-muted hover:bg-surface-2",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {route === "link" ? (
        <div className="flex flex-col gap-2">
          {supportedInstitutions.map((institution) => (
            <button
              key={institution.id}
              type="button"
              onClick={() => connectLinked(institution.id)}
              className="flex items-center gap-3 rounded-lg border border-border px-3.5 py-3 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
                <Building2 className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-fg">{institution.name}</span>
                <span className="block text-[13px] text-fg-subtle">
                  {institution.accounts.length === 1
                    ? "1 account"
                    : `${institution.accounts.length} accounts`}
                </span>
              </span>
              <Check className="size-4 text-fg-subtle opacity-0" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRoute("manual")}
            className="mt-1 self-start text-[13px] font-medium text-accent hover:underline"
          >
            My bank is not listed
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-fg">
              Bank or credit union
            </span>
            <input
              value={manual.institution}
              onChange={(e) => setManual({ ...manual, institution: e.target.value })}
              placeholder="Sound Community Credit Union"
              className={inputClass}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">Routing number</span>
              <input
                inputMode="numeric"
                value={manual.routingNumber}
                onChange={(e) => setManual({ ...manual, routingNumber: e.target.value })}
                placeholder="325070760"
                className={cn(inputClass, "font-mono")}
              />
              <span className="mt-1 block text-[13px] text-fg-subtle">
                Nine digits, bottom left of a check.
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">Account number</span>
              <input
                inputMode="numeric"
                value={manual.accountNumber}
                onChange={(e) => setManual({ ...manual, accountNumber: e.target.value })}
                placeholder="000123456789"
                className={cn(inputClass, "font-mono")}
              />
            </label>
          </div>

          {error ? <Callout tone="danger" title={error} /> : null}

          <Button
            variant="primary"
            size="md"
            className="self-start"
            onClick={connectTyped}
            disabled={!ready}
          >
            Connect account
          </Button>

          <p className="flex items-start gap-2 text-[13px] leading-snug text-fg-subtle">
            <Lock className="mt-px size-3.5 shrink-0" />
            We keep the bank, the last four digits, and nothing else. The full account number is
            checked and discarded, so it is never stored and never shown again.
          </p>
        </div>
      )}
    </div>
  );
}
