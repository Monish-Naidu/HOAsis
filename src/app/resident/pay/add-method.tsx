"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Apple,
  Building2,
  Check,
  CreditCard,
  Landmark,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Callout, Card } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { supportedInstitutions } from "@/lib/data";
import { isHoasisError } from "@/lib/core/errors";
import {
  BRAND_LABEL,
  cvcLengthFor,
  detectBrand,
  formatCardNumber,
  linkBankAccount,
  tokenizeCard,
} from "@/lib/payments/instruments";
import { cn, today, todayIsoDate } from "@/lib/utils";

const REFERENCE = { year: today().getUTCFullYear(), month: today().getUTCMonth() + 1 };

type Rail = "ach" | "card" | "apple-pay";

const RAILS: { id: Rail; label: string; icon: typeof Landmark; hint: string }[] = [
  { id: "ach", label: "Bank", icon: Landmark, hint: "Cheapest" },
  { id: "card", label: "Card", icon: CreditCard, hint: "2.9% + 30¢" },
  { id: "apple-pay", label: "Apple Pay", icon: Apple, hint: "2.9% + 30¢" },
];

/**
 * Adds a payment instrument.
 *
 * Three rails, three very different security stories:
 *
 *   Bank   modelled on Plaid Link. The resident authenticates with the bank
 *          and we receive an institution, a mask, and a token. No routing or
 *          account number is ever typed into this app.
 *   Card   in production this is a Stripe Elements iframe and the number never
 *          touches our code. Here the field is ours, so the number is checked
 *          and discarded inside `tokenizeCard` and never reaches state.
 *   Apple  requires a registered merchant identifier and a payment processor.
 *          Availability is detected honestly rather than faked.
 */
export function AddMethod({ onDone }: { onDone: () => void }) {
  const [rail, setRail] = useState<Rail>("ach");

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-3 border-b border-border">
        {RAILS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setRail(id)}
            aria-pressed={rail === id}
            className={cn(
              "flex flex-col items-center gap-1 py-3 text-[12px] font-medium transition-colors",
              rail === id
                ? "border-b-2 border-navy-900 text-fg dark:border-navy-100"
                : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {rail === "ach" ? <LinkBank onDone={onDone} /> : null}
      {rail === "card" ? <AddCard onDone={onDone} /> : null}
      {rail === "apple-pay" ? <AddApplePay onDone={onDone} /> : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Bank                                                                        */
/* -------------------------------------------------------------------------- */

function LinkBank({ onDone }: { onDone: () => void }) {
  const { addInstrument } = useAppState();
  const owner = useCurrentOwner();
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  const institution = supportedInstitutions.find((i) => i.id === institutionId);

  if (!institution) {
    return (
      <div className="p-4">
        <p className="mb-3 text-[13px] text-fg-muted">Choose your bank to connect it.</p>
        <div className="space-y-1.5">
          {supportedInstitutions.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => setInstitutionId(i.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-fg-muted">
                <Building2 className="size-4" />
              </span>
              <span className="flex-1 text-[13px] font-medium text-fg">{i.name}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
          <ShieldCheck className="mt-px size-3 shrink-0" />
          You sign in with your bank, not with us. HOAsis receives an account mask and a token,
          never your account number and never your bank password.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="mb-3 text-[13px] font-medium text-fg">
        Which {institution.name} account?
      </p>
      <div className="space-y-1.5">
        {institution.accounts.map((account) => (
          <button
            key={account.mask}
            type="button"
            onClick={() => {
              if (!owner) return;
              addInstrument(
                linkBankAccount(
                  { institution: institution.name, accountType: account.type, mask: account.mask },
                  { ownerId: owner.id, today: todayIsoDate() },
                ),
              );
              onDone();
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          >
            <Landmark className="size-4 shrink-0 text-fg-muted" />
            <span className="flex-1 text-[13px] font-medium capitalize text-fg">
              {account.type} ••{account.mask}
            </span>
            <Badge tone="ok">Free to you</Badge>
          </button>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={() => setInstitutionId(null)}>
        Choose a different bank
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

const TEST_CARD = "4242 4242 4242 4242";

function AddCard({ onDone }: { onDone: () => void }) {
  const { addInstrument } = useAppState();
  const owner = useCurrentOwner();
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const digits = number.replace(/\D/g, "");
  const brand = detectBrand(digits);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!owner) return;
    const [monthPart, yearPart] = expiry.split("/");
    try {
      const instrument = tokenizeCard(
        {
          number,
          expMonth: Number(monthPart ?? 0),
          expYear: 2000 + Number(yearPart ?? 0),
          cvc,
          postalCode,
        },
        { ownerId: owner.id, today: todayIsoDate(), referenceDate: REFERENCE },
      );
      addInstrument(instrument);
      // Clear the field immediately. Nothing here should outlive the submit.
      setNumber("");
      setCvc("");
      onDone();
    } catch (error) {
      setProblems(
        isHoasisError(error)
          ? String(error.context.problems ?? error.message).split(". ").filter(Boolean)
          : ["Something went wrong. Check the details and try again."],
      );
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 p-4">
      <Callout
        tone="warn"
        icon={<AlertTriangle className="size-4" />}
        title="Do not enter a real card"
      >
        This prototype has no payment processor. Use the test number {TEST_CARD}, or any card
        that passes a checksum.
      </Callout>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
          Card number
        </span>
        <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3">
          <CreditCard className="size-4 shrink-0 text-fg-subtle" />
          <input
            inputMode="numeric"
            autoComplete="off"
            value={number}
            onChange={(e) => setNumber(formatCardNumber(e.target.value))}
            placeholder={TEST_CARD}
            className="tnum min-w-0 flex-1 bg-transparent text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
          {brand !== "unknown" ? <Badge tone="neutral">{BRAND_LABEL[brand]}</Badge> : null}
        </div>
      </label>

      <div className="grid grid-cols-3 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            Expires
          </span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={expiry}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
              setExpiry(raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw);
            }}
            placeholder="MM/YY"
            className="tnum h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            {cvcLengthFor(brand) === 4 ? "CID" : "CVC"}
          </span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder={"•".repeat(cvcLengthFor(brand))}
            className="tnum h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            ZIP
          </span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
            placeholder="98036"
            className="tnum h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
        </label>
      </div>

      {problems.length ? (
        <ul className="space-y-1 rounded-lg bg-danger-soft px-3 py-2">
          {problems.map((problem) => (
            <li key={problem} className="text-[12px] text-danger">
              {problem}
            </li>
          ))}
        </ul>
      ) : null}

      <Button variant="primary" size="lg" className="w-full" type="submit">
        Add card
      </Button>
      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
        <Lock className="mt-px size-3 shrink-0" />
        In production this field is hosted by the payment processor and the number never reaches
        our code. Here it is checked and discarded in the same call, so only the brand, the last
        four, and the expiry are ever kept.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Apple Pay                                                                   */
/* -------------------------------------------------------------------------- */

/** Apple exposes this only on Safari, and only over HTTPS. */
function applePayAvailable(): boolean {
  if (typeof window === "undefined") return false;
  const session = (window as { ApplePaySession?: { canMakePayments?: () => boolean } })
    .ApplePaySession;
  return Boolean(session?.canMakePayments?.());
}

function AddApplePay({ onDone }: { onDone: () => void }) {
  const { addInstrument } = useAppState();
  const owner = useCurrentOwner();
  const available = applePayAvailable();

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3 rounded-lg bg-surface-2 p-3">
        <Apple className="mt-0.5 size-4 shrink-0 text-fg-muted" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">
            {available ? "Apple Pay is available on this device" : "Apple Pay is not available here"}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-fg-muted">
            {available
              ? "Confirming would normally open the Apple Pay sheet. This prototype has no merchant identifier, so it records the card on file instead."
              : "Apple Pay needs Safari on an Apple device, over HTTPS, with a registered merchant identifier. None of those are set up for this prototype."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          if (!owner) return;
          addInstrument({
            ownerId: owner.id,
            kind: "apple-pay",
            label: "Apple Pay",
            mask: "4402",
            brand: "visa",
            addedDate: todayIsoDate(),
            token: `tok_applepay_${todayIsoDate().replace(/-/g, "")}`,
          });
          onDone();
        }}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-black text-[15px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <Apple className="size-4" />
        Set up Apple Pay
      </button>

      <p className="flex items-start gap-1.5 text-[11px] leading-snug text-fg-subtle">
        <Check className="mt-px size-3 shrink-0" />
        Apple Pay costs the association the same as the card behind it. It is faster to use, not
        cheaper to accept.
      </p>
    </div>
  );
}
