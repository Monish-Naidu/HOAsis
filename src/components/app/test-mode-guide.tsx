"use client";

import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * How to test payments, shown in the product while Stripe is in test mode.
 *
 * Gated on the publishable key: a pk_test_ key means no real money can move,
 * so the fake bank and card numbers Stripe accepts are safe to print on the
 * screen where they are typed. The moment a live key is deployed this
 * renders nothing, with no code change. Delete the component when the team
 * no longer needs it; nothing else depends on it.
 */
export const STRIPE_TEST_MODE = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "").startsWith(
  "pk_test_",
);

const NUMBERS: { label: string; value: string; note: string }[] = [
  { label: "Routing number", value: "110000000", note: "Use with every test account below" },
  { label: "Bank, instant", value: "000123456789", note: "Verifies at once, payment succeeds" },
  { label: "Bank, micro-deposits", value: "000222222227", note: "Confirm amounts 32 and 45 later" },
  { label: "Bank, fails", value: "000111111113", note: "The payment is returned" },
  { label: "Card, works", value: "4242 4242 4242 4242", note: "Any future date, any CVC, any ZIP" },
  { label: "Card, declines", value: "4000 0000 0000 0002", note: "Shows the decline path" },
];

export function TestModeGuide({
  audience,
  className,
}: {
  audience: "board" | "resident";
  className?: string;
}) {
  if (!STRIPE_TEST_MODE) return null;
  return (
    <details
      className={cn(
        "group rounded-card border border-warn/30 bg-warn-soft/60 text-fg open:bg-warn-soft/80",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-[15px] font-semibold text-warn [&::-webkit-details-marker]:hidden">
        <FlaskConical className="size-4 shrink-0" />
        Test mode: no real money moves. How to try it
        <span className="ml-auto text-[13px] font-medium opacity-70 group-open:hidden">Show</span>
        <span className="ml-auto hidden text-[13px] font-medium opacity-70 group-open:inline">Hide</span>
      </summary>
      <div className="space-y-3 border-t border-warn/20 px-4 py-3 text-[15px] leading-relaxed">
        {audience === "board" ? (
          <ol className="list-decimal space-y-1 pl-5">
            <li>Press <strong>Set up payments</strong>. Stripe opens its onboarding form.</li>
            <li>
              At the top of that form use <strong>Skip this account form</strong>. Stripe fills in
              a fake, verified business and brings you back here.
            </li>
            <li>
              This row reads <strong>Payments are live</strong> once Stripe has switched the account
              on, usually within a minute. Reload if it still says Resume setup.
            </li>
            <li>
              Switch to <strong>Resident</strong> at the top, open <strong>Payments</strong>, and pay
              with the numbers below. The payment appears under Finances a moment later.
            </li>
          </ol>
        ) : (
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Pick <strong>New bank account</strong>, then in Stripe&apos;s form choose{" "}
              <strong>Enter bank details manually</strong> and use a routing and account number
              from the table. Or pick <strong>New card</strong> and use a card number.
            </li>
            <li>Press Pay. A card settles while you watch; a bank shows as processing.</li>
            <li>
              To save a method for autopay, use <strong>Add a payment method</strong> instead, then
              switch autopay on. The cron runs daily at 14:30 UTC.
            </li>
          </ol>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <tbody>
              {NUMBERS.map((n) => (
                <tr key={n.label} className="border-t border-warn/15">
                  <td className="py-1.5 pr-3 font-medium whitespace-nowrap">{n.label}</td>
                  <td className="tnum py-1.5 pr-3 font-mono whitespace-nowrap select-all">{n.value}</td>
                  <td className="py-1.5 opacity-80">{n.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}
