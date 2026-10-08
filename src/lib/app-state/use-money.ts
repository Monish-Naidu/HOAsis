import { useCallback } from "react";
import type { Community } from "@/lib/data/community";
import { type AppDeps, destructive, isUuid, logDemoActivity, newId, remoteWrite, sessionStore, sliceStore, ValidationError } from "./core";
import { addDays, money, todayIsoDate } from "@/lib/utils";
import { WRITE_TIMEOUT_MS } from "@/lib/data/remote-store";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { AutopayPlan, BankAccount, VendorInvoice } from "@/lib/types";
import { canReverse, correctionCents, reversalLine, withReversals } from "@/lib/ledger-corrections";
import { chargeProblem } from "@/lib/payments/charges";
import { MANUAL_METHOD_LABEL, type ManualMethod, manualPaymentLabel, type PaymentInstrument } from "@/lib/payments/instruments";
import { type HandMethod, type ManualPaymentRow, pairManualPayments, parseManualLabel, recentManualPayments, reversalReasonProblem } from "@/lib/payments/manual-payments";
import { placeLabel } from "@/lib/wording";
import { addStatementLine } from "@/lib/statement";
import { activityWords } from "@/lib/activity";
import type { LedgerReversal } from "./types";

/** Who a payment line names: the household's name when known, else the home ("Lot 7"), never a bare "Owner". */
function payerName(home: { displayName?: string; unit: string } | undefined): string {
  return home?.displayName?.trim() || (home ? placeLabel(home.unit) : "Unknown home");
}

/**
 * Money: payments and charges, credits, reversals, starting balances, saved
 * payment methods, autopay, invoices, payouts, reserves and the ledger review.
 */
export function useMoneyActions(deps: AppDeps) {
  const { remote, communityId, bankAccountList, account, can } = deps;

  /** Connects an account the association can receive dues into. */
  const addBankAccount = useCallback(
    (account: BankAccount) => {
      if (!remote.community) {
        sliceStore(communityId, "bankAccounts").update((all) => [
          ...all.filter((a) => a.id !== account.id),
          account,
        ]);
        return;
      }
      const rc = remote.community;
      void remoteWrite("Connecting the account", () =>
        supabaseBrowser().from("bank_accounts").insert({
          id: isUuid(account.id) ? account.id : newId(),
          association_id: rc.id,
          kind: account.kind,
          institution: account.institution,
          mask: account.mask,
        }),
      );
    },
    [remote.community, communityId],
  );

  /**
   * The demo's side of a payment: statement line, balance, books, budget and
   * bank, written together. An online payment and one the board enters by
   * hand differ only in the words on the line and the date.
   */
  const applyLocalPayment = useCallback(
    (input: {
      homeId: string;
      amountCents: number;
      processorCents: number;
      platformCents: number;
      platformPaidBy: "owner" | "association";
      label: string;
      method: string;
      date: string;
    }) => {
      const date = input.date;
      const charges = sliceStore(communityId, "homeCharges");
      const existing = charges.getSnapshot()[input.homeId] ?? [];

      // What each charge still owes, after everything already applied to it.
      const paidAgainst = new Map<string, number>();
      for (const line of existing) {
        for (const applied of line.appliedTo ?? []) {
          paidAgainst.set(
            applied.chargeId,
            (paidAgainst.get(applied.chargeId) ?? 0) + applied.amountCents,
          );
        }
      }

      // Oldest first. The stored ledger is newest first, so walk it backwards.
      // Only bills already due are paid toward, as record_payment does: a
      // bill posted early waits for its date, and money sent ahead of it
      // stays a payment on the statement.
      let remaining = input.amountCents;
      const appliedTo: { chargeId: string; label: string; amountCents: number }[] = [];
      for (const line of [...existing].reverse()) {
        if (remaining <= 0) break;
        if (line.kind !== "charge" || line.date > date) continue;
        const open = line.amountCents - (paidAgainst.get(line.id) ?? 0);
        if (open <= 0) continue;
        const take = Math.min(open, remaining);
        appliedTo.push({ chargeId: line.id, label: line.label, amountCents: take });
        remaining -= take;
      }

      const homes = sliceStore(communityId, "homes");
      const home = homes.getSnapshot().find((o) => o.id === input.homeId);
      const balanceAfter = Math.max(0, (home?.balanceCents ?? 0) - input.amountCents);

      // Placed by its date, after the charges of that day, with the running
      // balances restated: written at the top it sat above a bill dated
      // later and the balance beside it read as if paid before billed.
      const headBefore = existing[0]?.balanceAfterCents ?? home?.balanceCents ?? 0;
      charges.update((all) => ({
        ...all,
        [input.homeId]: addStatementLine(
          all[input.homeId] ?? [],
          {
            id: `pay-${date}-${input.homeId}-${existing.length + 1}`,
            date,
            label: input.label,
            kind: "payment" as const,
            amountCents: -input.amountCents,
            balanceAfterCents: headBefore - input.amountCents,
            method: input.method,
            feeCents: input.processorCents,
            feePaidBy: "association" as const,
            // An early payment covers nothing yet, and saying so beats
            // inventing a charge for it to have paid.
            ...(appliedTo.length ? { appliedTo } : {}),
          },
          headBefore - input.amountCents,
        ),
      }));

      homes.update((all) =>
        all.map((o) =>
          o.id === input.homeId
            ? { ...o, balanceCents: balanceAfter, daysPastDue: 0, standing: "current" as const }
            : o,
        ),
      );

      // The association keeps the assessment; the processor takes its cut out
      // of the deposit, and our fee only if the association agreed to carry it.
      const absorbed =
        input.processorCents + (input.platformPaidBy === "association" ? input.platformCents : 0);
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");

      sliceStore(communityId, "ledger").update((all) => [
        // Worded and booked as record_payment does it (0101): the whole
        // payment in, and the processor's fee out as its own line, so the
        // board can see where the difference went.
        ...(absorbed > 0
          ? [
              {
                id: `led-${date}-${input.homeId}-fee-${all.length + 1}`,
                date,
                description: `Processing fee, unit ${home?.unit ?? "?"}`,
                counterparty: "Stripe",
                category: "Processing fees" as const,
                accountId: operating?.id ?? "unassigned",
                amountCents: -absorbed,
                status: "cleared" as const,
                matchedBy: "auto" as const,
                homeId: input.homeId,
              },
            ]
          : []),
        {
          id: `led-${date}-${input.homeId}-${all.length + 1}`,
          date,
          description: `Assessment payment, unit ${home?.unit ?? "?"}`,
          counterparty: payerName(home),
          category: "Assessments" as const,
          accountId: operating?.id ?? "unassigned",
          amountCents: input.amountCents,
          status: "cleared" as const,
          matchedBy: "auto" as const,
          homeId: input.homeId,
        },
        ...all,
      ]);

      // Income against budget is what tells a board whether collections are on
      // pace. Moving cash without moving this is how a dashboard ends up
      // reporting a full bank account and nothing collected.
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "income" && line.category === "Assessments"
            ? { ...line, ytdActualCents: line.ytdActualCents + input.amountCents }
            : line,
        ),
      );

      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((a) =>
            a.id === operating.id
              ? { ...a, balanceCents: a.balanceCents + input.amountCents - absorbed }
              : a,
          ),
        );
      }
    },
    [communityId],
  );

  /**
   * Records a payment everywhere it has to appear.
   *
   * This is the seam the whole product turns on. A payment is not one fact, it
   * is four: the household's statement, the household's balance, the
   * association's books, and the bank balance the board reconciles against.
   * Writing one and not the others is exactly the drift this product exists to
   * argue against, so they are written together or not at all.
   *
   * Money is applied to the oldest open charge first, which is the convention
   * every collection policy assumes and the one owners are told about.
   */
  const recordPayment = useCallback(
    (input: {
      homeId: string;
      amountCents: number;
      /** What the processor takes out of the deposit. */
      processorCents: number;
      /** Our fee, and who carried it. */
      platformCents: number;
      platformPaidBy: "owner" | "association";
      method: string;
      kind: "ach" | "card" | "apple-pay";
    }) => {
      if (remote.community) {
        // The database does all four writes in one function, so a payment
        // cannot land on the statement and miss the books.
        void remoteWrite("Recording the payment", () =>
          supabaseBrowser().rpc("record_payment", {
            p_unit_id: input.homeId,
            p_amount_cents: input.amountCents,
            p_rail: input.kind,
            p_processor_fee_cents: input.processorCents,
            p_platform_fee_cents: input.platformCents,
            p_platform_fee_paid_by: input.platformPaidBy,
          }),
        );
        return;
      }
      applyLocalPayment({
        ...input,
        label: input.kind === "ach" ? "Bank payment" : `Card payment, ${input.method}`,
        date: todayIsoDate(),
      });
    },
    [remote.community, applyLocalPayment],
  );

  /**
   * A check or cash the board received. Real associations go through
   * record_manual_payment (0083), which writes the statement line, the
   * allocations and the deposit together and takes the date the money
   * arrived. The demo does the same locally. Resolves once the write is
   * back, so the form can say "recorded" only when it was.
   */
  const recordManualPayment = useCallback(
    (input: {
      homeId: string;
      amountCents: number;
      method: ManualMethod;
      reference: string;
      receivedOn: string;
    }) => {
      if (remote.community) {
        return remoteWrite("Recording the payment", () =>
          supabaseBrowser().rpc("record_manual_payment", {
            p_unit_id: input.homeId,
            p_amount_cents: input.amountCents,
            p_method: input.method,
            p_reference: input.reference.trim(),
            p_received_on: input.receivedOn,
          }),
        );
      }
      applyLocalPayment({
        homeId: input.homeId,
        amountCents: input.amountCents,
        processorCents: 0,
        platformCents: 0,
        platformPaidBy: "association",
        label: manualPaymentLabel(input.method, input.reference),
        method: MANUAL_METHOD_LABEL[input.method],
        date: input.receivedOn,
      });
      return true;
    },
    [remote.community, applyLocalPayment],
  );

  /**
   * Takes a check or cash back off the books. Real associations go through
   * reverse_manual_payment (0088), which stores it as a full refund: the
   * payment reads refunded, the home is charged the amount again and the
   * deposit is offset. The demo does the same locally.
   */
  const reverseManualPayment = useCallback(
    (paymentId: string, reason: string) => {
      const why = reason.trim();
      if (!can("finances")) return false;
      if (reversalReasonProblem(why)) return false;
      if (remote.community) {
        return remoteWrite("Reversing the payment", () =>
          supabaseBrowser().rpc("reverse_manual_payment", {
            p_payment_id: paymentId,
            p_reason: why,
          }),
        );
      }
      const date = todayIsoDate();
      const charges = sliceStore(communityId, "homeCharges");
      let homeId: string | null = null;
      let amountCents = 0;
      for (const [id, lines] of Object.entries(charges.getSnapshot())) {
        const line = lines.find((l) => l.id === paymentId);
        if (line) {
          homeId = id;
          amountCents = -line.amountCents;
        }
      }
      if (!homeId || amountCents <= 0) return false;
      const homes = sliceStore(communityId, "homes");
      const home = homes.getSnapshot().find((o) => o.id === homeId);
      const balanceAfter = (home?.balanceCents ?? 0) + amountCents;
      const paidHomeId = homeId;
      charges.update((all) => ({
        ...all,
        [paidHomeId]: [
          {
            id: `reversal-${date}-${paymentId}`,
            date,
            label: `Payment reversed: ${why}`,
            kind: "charge" as const,
            // As reverse_manual_payment writes it (0088): not dues, so no
            // bill, skip or late fee logic reads the line as one.
            category: "other",
            amountCents,
            balanceAfterCents: balanceAfter,
          },
          ...(all[paidHomeId] ?? []).map((l) => (l.id === paymentId ? { ...l, reversed: true } : l)),
        ],
      }));
      homes.update((all) =>
        all.map((o) => (o.id === paidHomeId ? { ...o, balanceCents: balanceAfter } : o)),
      );
      // The deposit comes back out of the books and the bank, as the money
      // went in, so collected and the bank balance fall with the balance.
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");
      sliceStore(communityId, "ledger").update((all) => [
        {
          id: `led-reversal-${date}-${paymentId}`,
          date,
          description: `Payment reversed, ${placeLabel(home?.unit ?? "?")}`,
          counterparty: payerName(home),
          category: "Assessments" as const,
          accountId: operating?.id ?? "unassigned",
          amountCents: -amountCents,
          status: "cleared" as const,
          matchedBy: "auto" as const,
          homeId: homeId,
        },
        ...all,
      ]);
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "income" && line.category === "Assessments"
            ? { ...line, ytdActualCents: line.ytdActualCents - amountCents }
            : line,
        ),
      );
      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((a) =>
            a.id === operating.id ? { ...a, balanceCents: a.balanceCents - amountCents } : a,
          ),
        );
      }
      return true;
    },
    [can, remote.community, communityId],
  );

  /**
   * One home's checks and cash entered by hand. A payments row carries no
   * date or reference, so those are read off the statement line written
   * beside it. Row level security already lets a finance holder read both.
   */
  const manualPaymentsFor = useCallback(
    async (homeId: string): Promise<ManualPaymentRow[]> => {
      if (remote.community) {
        if (!isUuid(homeId)) return [];
        const supabase = supabaseBrowser();
        const [paid, lines] = await Promise.all([
          supabase
            .from("payments")
            .select("id, amount_cents, rail, state, refunded_cents, created_at")
            .eq("unit_id", homeId)
            .in("rail", ["check", "cash"])
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("charges")
            .select("label, amount_cents, due_on")
            .eq("unit_id", homeId)
            .eq("kind", "payment")
            .or("label.like.Check payment*,label.like.Cash payment*")
            .order("created_at", { ascending: true }),
        ]);
        if (paid.error) throw new Error(paid.error.message);
        if (lines.error) throw new Error(lines.error.message);
        return recentManualPayments(
          pairManualPayments(
            [...(paid.data ?? [])].reverse().map((p) => ({
              id: p.id,
              amountCents: p.amount_cents,
              method: p.rail as HandMethod,
              reversed: p.state === "refunded" || p.refunded_cents > 0,
              createdOn: p.created_at.slice(0, 10),
            })),
            (lines.data ?? []).map((l) => ({
              label: l.label,
              amountCents: -l.amount_cents,
              date: l.due_on,
            })),
          ),
        );
      }
      const lines = sliceStore(communityId, "homeCharges").getSnapshot()[homeId] ?? [];
      const rows: ManualPaymentRow[] = [];
      for (const l of lines) {
        const parsed = l.kind === "payment" ? parseManualLabel(l.label) : null;
        if (!parsed) continue;
        rows.push({
          id: l.id,
          amountCents: -l.amountCents,
          method: parsed.method,
          receivedOn: l.date,
          reference: parsed.reference,
          reversed: Boolean(l.reversed),
        });
      }
      return recentManualPayments(rows);
    },
    [remote.community, communityId],
  );

  /**
   * A credit on one home's statement, such as a late fee waived. It lowers
   * what the home owes and is not money in the bank, so the books get no
   * line. Signed in it goes through add_credit (0103), which writes the
   * activity row a direct insert into charges could not.
   */
  // A closed fiscal year (0109) is reopened to post a correction, and closed
  // again by hand so the corrected figures are there before the meeting.
  // Signed in only: the demo has no closed years.
  const reopenFiscalYear = useCallback(
    (startsOn: string, reason: string) => {
      const rc = remote.community;
      if (!rc) return false;
      if (reason.trim().length < 3) return false;
      return remoteWrite("Reopening the year", () =>
        supabaseBrowser().rpc("reopen_fiscal_year", {
          p_association_id: rc.id,
          p_starts_on: startsOn,
          p_reason: reason.trim(),
        }),
      );
    },
    [remote.community],
  );

  const closeFiscalYear = useCallback(
    (startsOn: string) => {
      const rc = remote.community;
      if (!rc) return false;
      return remoteWrite("Closing the year", () =>
        supabaseBrowser().rpc("close_fiscal_year", {
          p_association_id: rc.id,
          p_starts_on: startsOn,
        }),
      );
    },
    [remote.community],
  );

  const addCredit = useCallback(
    (input: { homeId: string; amountCents: number; reason: string }) => {
      const reason = input.reason.trim();
      if (input.amountCents <= 0 || !reason) return false;
      const date = todayIsoDate();
      if (remote.community) {
        return remoteWrite("Adding the credit", () =>
          supabaseBrowser().rpc("add_credit", {
            p_unit_id: input.homeId,
            p_amount_cents: input.amountCents,
            p_label: reason,
          }),
        );
      }
      const home = sliceStore(communityId, "homes")
        .getSnapshot()
        .find((o) => o.id === input.homeId);
      logDemoActivity(communityId, "charge", activityWords.credit(input.amountCents, home?.unit ?? "a home", reason), {
        unit_id: input.homeId,
        home: home?.unit,
      });
      const balanceAfter = (home?.balanceCents ?? 0) - input.amountCents;
      sliceStore(communityId, "homeCharges").update((all) => ({
        ...all,
        [input.homeId]: [
          {
            id: `credit-${date}-${input.homeId}-${(all[input.homeId] ?? []).length + 1}`,
            date,
            label: reason,
            kind: "credit" as const,
            amountCents: -input.amountCents,
            balanceAfterCents: balanceAfter,
          },
          ...(all[input.homeId] ?? []),
        ],
      }));
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) => (o.id === input.homeId ? { ...o, balanceCents: balanceAfter } : o)),
      );
      return true;
    },
    [remote.community, communityId],
  );

  /** One charge line on a home's demo statement, with the balance it leaves. */
  const addLocalCharge = useCallback(
    (homeId: string, amountCents: number, label: string, dueOn: string) => {
      const home = sliceStore(communityId, "homes")
        .getSnapshot()
        .find((o) => o.id === homeId);
      const balanceAfter = (home?.balanceCents ?? 0) + amountCents;
      sliceStore(communityId, "homeCharges").update((all) => ({
        ...all,
        [homeId]: [
          {
            id: `charge-${dueOn}-${homeId}-${(all[homeId] ?? []).length + 1}`,
            date: dueOn,
            label,
            kind: "charge" as const,
            amountCents,
            balanceAfterCents: balanceAfter,
          },
          ...(all[homeId] ?? []),
        ],
      }));
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) => (o.id === homeId ? { ...o, balanceCents: balanceAfter } : o)),
      );
    },
    [communityId],
  );

  /**
   * A one-off charge on one home. Real associations go through add_charge
   * (0086), which checks the amount, the label and the date again and writes
   * the activity record; the demo puts the line on the statement locally.
   * The charge is not dues, so it draws no late fee.
   */
  const addCharge = useCallback(
    (input: { homeId: string; amountCents: number; label: string; dueOn: string }) => {
      const label = input.label.trim();
      if (!can("finances")) return false;
      if (chargeProblem({ ...input, label }, todayIsoDate())) return false;
      if (remote.community) {
        return remoteWrite("Adding the charge", () =>
          supabaseBrowser().rpc("add_charge", {
            p_unit_id: input.homeId,
            p_amount_cents: input.amountCents,
            p_label: label,
            p_due_on: input.dueOn,
          }),
        );
      }
      addLocalCharge(input.homeId, input.amountCents, label, input.dueOn);
      return true;
    },
    [can, remote.community, addLocalCharge],
  );

  /** The same one-off charge on every home, in one transaction. */
  const addChargeToAll = useCallback(
    (input: { amountCents: number; label: string; dueOn: string }) => {
      const label = input.label.trim();
      if (!can("finances")) return false;
      if (chargeProblem({ ...input, label }, todayIsoDate())) return false;
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Adding the charge to every home", () =>
          supabaseBrowser().rpc("add_charge_to_all", {
            p_association_id: rc.id,
            p_amount_cents: input.amountCents,
            p_label: label,
            p_due_on: input.dueOn,
          }),
        );
      }
      for (const o of sliceStore(communityId, "homes").getSnapshot()) {
        addLocalCharge(o.id, input.amountCents, label, input.dueOn);
      }
      return true;
    },
    [can, remote.community, communityId, addLocalCharge],
  );

  /**
   * What one bank account held on the day the books started here. One
   * confirmed ledger line in the "Opening balance" category, which the
   * metrics already keep out of income and spending, replacing an earlier
   * opening line for the same account. In a real association a correction is
   * a second line for the difference, since a ledger line is never deleted.
   */
  const setOpeningBankBalance = useCallback(
    (accountId: string, input: { amountCents: number; asOf: string }) => {
      if (input.amountCents < 0) return false;
      if (remote.community) {
        const rc = remote.community;
        if (!isUuid(accountId)) return false;
        return remoteWrite("Saving the opening balance", async () => {
          const supabase = supabaseBrowser();
          // Nothing is deleted (0106). What the account already holds as an
          // opening line stays, and the difference goes on top as a line of
          // its own, so the books show both and the sum is the new figure.
          const { data: earlier, error: readError } = await supabase
            .from("ledger_entries")
            .select("amount_cents")
            .eq("association_id", rc.id)
            .eq("bank_account_id", accountId)
            .eq("category", "Opening balance");
          if (readError) throw new Error(readError.message);
          const held = (earlier ?? []) as { amount_cents: number }[];
          const delta = correctionCents(
            held.map((row) => row.amount_cents),
            input.amountCents,
          );
          if (delta === 0) return;
          return supabase.from("ledger_entries").insert({
            association_id: rc.id,
            bank_account_id: accountId,
            occurred_on: input.asOf,
            description: held.length ? "Opening balance (corrected)" : "Opening balance",
            counterparty: "",
            category: "Opening balance",
            amount_cents: delta,
            confirmed_at: new Date().toISOString(),
          });
        });
      }
      const ledger = sliceStore(communityId, "ledger");
      const earlier = ledger
        .getSnapshot()
        .filter((e) => e.accountId === accountId && e.category === "Opening balance")
        .reduce((t, e) => t + e.amountCents, 0);
      ledger.update((all) => [
        {
          id: `led-opening-${accountId}`,
          date: input.asOf,
          description: "Opening balance",
          counterparty: "",
          category: "Opening balance" as const,
          accountId,
          amountCents: input.amountCents,
          status: "cleared" as const,
          matchedBy: "manual" as const,
        },
        ...all.filter((e) => !(e.accountId === accountId && e.category === "Opening balance")),
      ]);
      sliceStore(communityId, "bankAccounts").update((all) =>
        all.map((a) =>
          a.id === accountId ? { ...a, balanceCents: a.balanceCents - earlier + input.amountCents } : a,
        ),
      );
      return true;
    },
    [remote.community, communityId],
  );

  const setOpeningBalances = useCallback(
    (asOf: string, balances: { homeId: string; amountCents: number }[]) => {
      if (remote.community) {
        // One line per home. A correction is a second line for the
        // difference rather than a delete and a rewrite (0106), so the
        // statement shows both and the balance view sums them.
        const rc = remote.community;
        return remoteWrite("Saving opening balances", async () => {
          const supabase = supabaseBrowser();
          const { data, error: readError } = await supabase
            .from("charges")
            .select("unit_id, amount_cents, due_on")
            .eq("association_id", rc.id)
            .eq("label", "Balance brought forward");
          if (readError) throw new Error(readError.message);
          const held = (data ?? []) as { unit_id: string; amount_cents: number; due_on: string }[];
          for (const { homeId, amountCents } of balances) {
            const mine = held.filter((row) => row.unit_id === homeId);
            const delta = correctionCents(
              mine.map((row) => row.amount_cents),
              amountCents,
            );
            if (delta === 0) {
              // The same figure under a new date would be an edit to the old line.
              if (mine.some((row) => row.due_on !== asOf)) {
                throw new Error("an opening balance keeps its date. Change the amount to correct it");
              }
              continue;
            }
            const { error } = await supabase.from("charges").insert({
              association_id: rc.id,
              unit_id: homeId,
              kind: delta > 0 ? "charge" : "credit",
              label: "Balance brought forward",
              amount_cents: delta,
              due_on: asOf,
            });
            if (error) throw new Error(error.message);
          }
        }, { timeoutMs: WRITE_TIMEOUT_MS + balances.length * 1_000 });
      }
      const byHome = new Map(balances.map((b) => [b.homeId, b.amountCents]));

      // Only the balance moves. Standing and days past due are deliberately
      // left alone: a figure typed into a box says what is owed and says
      // nothing about how long it has been owed, and turning it into
      // "collections" would drop a household onto the enforcement ladder on
      // their first day here on the strength of an inference. The ladder runs
      // off the calendar from the switch date, which is the whole reason it is
      // defensible at a hearing.
      sliceStore(communityId, "homes").update((all) =>
        all.map((home) => {
          const amount = byHome.get(home.id);
          return amount === undefined ? home : { ...home, balanceCents: amount };
        }),
      );

      sliceStore(communityId, "homeCharges").update((all) => {
        const next = { ...all };
        for (const { homeId, amountCents } of balances) {
          const existing = (next[homeId] ?? []).filter(
            (line) => line.id !== `${homeId}-opening`,
          );
          if (amountCents === 0) {
            next[homeId] = existing;
            continue;
          }
          next[homeId] = [
            {
              id: `${homeId}-opening`,
              date: asOf,
              label: "Balance brought forward",
              kind: "charge" as const,
              amountCents,
              balanceAfterCents: amountCents,
            },
            ...existing,
          ];
        }
        return next;
      });
      // Synchronous, like `transferHome`: the demo settles in one render.
      return true;
    },
    [remote.community, communityId],
  );

  const setAutopay = useCallback(
    (plan: AutopayPlan | null) => {
      if (remote.community) {
        const rc = remote.community;
        // The home on screen. set_my_autopay writes every seat the person
        // holds, which would switch autopay on or off for all their homes at
        // once; this one names the home.
        const unitId = account?.homeId;
        if (!unitId) return Promise.resolve(false);
        return remoteWrite(plan ? "Saving autopay" : "Turning autopay off", () =>
          supabaseBrowser().rpc("set_my_home_autopay", {
            p_association_id: rc.id,
            p_unit_id: unitId,
            p_autopay: plan as unknown as Json,
          }),
        );
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!me) return Promise.resolve(false);
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) =>
          o.id === me.homeId
            ? { ...o, autopay: Boolean(plan), autopayPlan: plan ?? undefined }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId, account?.homeId],
  );

  const addInstrument = useCallback(
    (draft: Omit<PaymentInstrument, "id" | "isDefault">): PaymentInstrument => {
      const existing = remote.community
        ? remote.community.instruments
        : sliceStore(communityId, "instruments").getSnapshot();
      const mine = existing.filter((i) => i.homeId === draft.homeId);
      const instrument: PaymentInstrument = {
        ...draft,
        id: remote.community ? newId() : `pm-${draft.kind}-${draft.mask}-${existing.length}`,
        // The first one an owner adds becomes their default, because a payment
        // screen with nothing selected is a dead end.
        isDefault: mine.length === 0,
      };
      if (remote.community) {
        const rc = remote.community;
        const { id, homeId, kind, label, mask, isDefault, addedDate, ...detail } = instrument;
        void remoteWrite("Saving the payment method", () =>
          supabaseBrowser().from("payment_instruments").insert({
            id,
            association_id: rc.id,
            unit_id: homeId,
            profile_id: remote.profileId,
            kind,
            label,
            mask,
            is_default: isDefault,
            added_on: addedDate,
            detail,
          }),
        );
        return instrument;
      }
      sliceStore(communityId, "instruments").set([...existing, instrument]);
      return instrument;
    },
    [remote.community, remote.profileId, communityId],
  );

  const removeInstrument = useCallback(
    (instrumentId: string) => {
      if (remote.community) {
        const rc = remote.community;
        // The route detaches the method from Stripe before the row goes, and
        // a detached method cannot come back, so there is nothing to undo.
        void remoteWrite("Removing the payment method", async () => {
          const response = await fetch("/api/stripe/instruments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ associationId: rc.id, instrumentId }),
          });
          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.error ?? "The payment method was not removed. Try again");
          }
        });
        return undefined;
      }
      return destructive(sliceStore(communityId, "instruments"), (all) => {
        const removed = all.find((i) => i.id === instrumentId);
        const kept = all.filter((i) => i.id !== instrumentId);
        if (!removed?.isDefault) return kept;
        const successor = kept.find((i) => i.homeId === removed.homeId);
        return successor
          ? kept.map((i) => (i.id === successor.id ? { ...i, isDefault: true } : i))
          : kept;
      });
    },
    [remote.community, communityId],
  );

  const setDefaultInstrument = useCallback(
    (instrumentId: string) => {
      if (remote.community) {
        const target = remote.community.instruments.find((i) => i.id === instrumentId);
        if (!target) return;
        void remoteWrite("Choosing the default", async () => {
          const supabase = supabaseBrowser();
          const { error } = await supabase
            .from("payment_instruments")
            .update({ is_default: false })
            .eq("unit_id", target.homeId);
          if (error) throw new Error(error.message);
          // The first update clears the others and may match none. This one is
          // aimed at the method just chosen, so it has to land.
          return supabase
            .from("payment_instruments")
            .update({ is_default: true }, { count: "exact" })
            .eq("id", instrumentId);
        });
        return;
      }
      sliceStore(communityId, "instruments").update((all) => {
        const target = all.find((i) => i.id === instrumentId);
        if (!target) return all;
        // Exactly one default per household, enforced on write.
        return all.map((i) =>
          i.homeId === target.homeId ? { ...i, isDefault: i.id === instrumentId } : i,
        );
      });
    },
    [remote.community, communityId],
  );

  const confirmLedgerEntry = useCallback(
    (entryId: string, category?: Community["ledger"][number]["category"]) => {
      if (remote.community) {
        const entry = remote.community.ledger.find((e) => e.id === entryId);
        // Through a function, which says who confirmed it. A line is not
        // edited back to unconfirmed, so there is no undo (0106).
        void remoteWrite("Confirming the transaction", () =>
          supabaseBrowser().rpc("confirm_ledger_entry", {
            p_entry_id: entryId,
            p_category: category ?? entry?.suggestedCategory ?? entry?.category ?? null,
          }),
        );
        return;
      }
      sliceStore(communityId, "ledger").update((all) =>
        all.map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                status: "cleared" as const,
                category: category ?? entry.suggestedCategory ?? entry.category,
                suggestedCategory: undefined,
                suggestionConfidence: undefined,
                matchedBy: "manual" as const,
              }
            : entry,
        ),
      );
    },
    [remote.community, communityId],
  );

  /**
   * A line is not deleted. Reversing writes its opposite, dated today, and
   * both stay on the books. The undo puts the line back as a new line, which
   * is a second correction, not a delete of the first.
   */
  const reverseLedgerEntry = useCallback(
    (entryId: string, reason: string): LedgerReversal | Promise<LedgerReversal> => {
      const why = reason.trim();
      if (!can("finances")) return false;
      if (reversalReasonProblem(why)) return false;
      if (remote.community) {
        const rc = remote.community;
        const entry = rc.ledger.find((e) => e.id === entryId);
        if (!entry || !canReverse(entry)) return false;
        return remoteWrite("Reversing the transaction", () =>
          supabaseBrowser().rpc("reverse_ledger_entry", { p_entry_id: entryId, p_reason: why }),
        ).then((ok): LedgerReversal => {
          if (!ok) return false;
          return {
            undo: () => {
              void remoteWrite("Putting the transaction back", () =>
                supabaseBrowser().from("ledger_entries").insert({
                  association_id: rc.id,
                  bank_account_id: isUuid(entry.accountId) ? entry.accountId : null,
                  occurred_on: entry.date,
                  description: entry.description,
                  counterparty: entry.counterparty,
                  category: entry.category,
                  amount_cents: entry.amountCents,
                  confirmed_at: null,
                }),
              );
            },
          };
        });
      }
      const ledger = sliceStore(communityId, "ledger");
      const entry = ledger.getSnapshot().find((e) => e.id === entryId);
      if (!entry || !canReverse(entry)) return false;
      const reversal = reversalLine(entry, newId(), todayIsoDate());
      logDemoActivity(
        communityId,
        "ledger",
        `Transaction reversed: ${entry.description} (${money(Math.abs(entry.amountCents))}): ${why}`,
        { reversed_entry_id: entry.id, reason: why },
      );
      ledger.update((all) =>
        withReversals([reversal, ...all]).sort((a, b) => b.date.localeCompare(a.date)),
      );
      return {
        undo: () => {
          ledger.update((all) =>
            [{ ...entry, id: newId(), reversedById: undefined }, ...all].sort((a, b) =>
              b.date.localeCompare(a.date),
            ),
          );
        },
      };
    },
    [can, remote.community, communityId],
  );

  const recordReserveTransfer = useCallback(
    (amountCents: number, date: string) => {
      if (amountCents <= 0) throw new ValidationError("Enter an amount", { amount: "Enter an amount" });
      const source = remote.community ?? null;
      const accounts = source ? source.bankAccounts : bankAccountList;
      const operating = accounts.find((b) => b.kind === "operating");
      const reserve = accounts.find((b) => b.kind !== "operating");
      if (!operating || !reserve) {
        throw new ValidationError("Add an operating and a reserve account first", {});
      }
      const pair = [
        { accountId: operating.id, amountCents: -amountCents, description: "Transfer to reserve account", counterparty: reserve.name },
        { accountId: reserve.id, amountCents, description: "Transfer from operating account", counterparty: operating.name },
      ];
      if (source) {
        void remoteWrite("Recording the transfer", () =>
          supabaseBrowser().from("ledger_entries").insert(
            pair.map((line) => ({
              association_id: source.id,
              bank_account_id: isUuid(line.accountId) ? line.accountId : null,
              occurred_on: date,
              description: line.description,
              counterparty: line.counterparty,
              category: "Reserve transfer",
              amount_cents: line.amountCents,
              confirmed_at: new Date().toISOString(),
            })),
          ),
        );
        return;
      }
      sliceStore(communityId, "ledger").update((all) =>
        [
          ...pair.map((line) => ({
            id: newId(),
            date,
            description: line.description,
            counterparty: line.counterparty,
            category: "Reserve transfer" as const,
            accountId: line.accountId,
            amountCents: line.amountCents,
            status: "cleared" as const,
          })),
          ...all,
        ].sort((a, b) => b.date.localeCompare(a.date)),
      );
      // The demo's balances are stored, not summed, so they move by hand.
      sliceStore(communityId, "bankAccounts").update((all) =>
        all.map((b) =>
          b.id === operating.id
            ? { ...b, balanceCents: b.balanceCents - amountCents }
            : b.id === reserve.id
              ? { ...b, balanceCents: b.balanceCents + amountCents }
              : b,
        ),
      );
    },
    [remote.community, bankAccountList, communityId],
  );

  const approvePayout = useCallback(
    (payoutId: string) => {
      if (remote.community) {
        const rc = remote.community;
        const approver = rc.accounts.find((a) => a.id === remote.profileId);
        const asked = rc.payouts.find((p) => p.id === payoutId);
        if (!approver || !asked) return;
        if (asked.approvals.some((a) => a.name === approver.name)) return;
        // The database adds the signature under a row lock (approve_payout,
        // 0094). The browser used to read the list, add a name and write
        // the whole list back, and two officers pressing at once each wrote
        // a list of one over the other's.
        void remoteWrite("Approving the payment", () =>
          supabaseBrowser().rpc("approve_payout", { p_payout_id: payoutId }),
        );
        return;
      }
      const approver = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!approver) return;
      sliceStore(communityId, "payouts").update((all) =>
        all.map((payout) => {
          if (payout.id !== payoutId) return payout;
          if (payout.approvals.some((a) => a.name === approver.name)) return payout;
          const approvals = [...payout.approvals, { name: approver.name, at: todayIsoDate() }];
          return {
            ...payout,
            approvals,
            status: approvals.length >= payout.approvalsRequired ? "scheduled" : payout.status,
          };
        }),
      );
    },
    [remote.community, remote.profileId, communityId],
  );

  const markPayoutPaid = useCallback(
    (payoutId: string) => {
      if (!can("finances")) return false;
      const today = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        const payout = rc.payouts.find((p) => p.id === payoutId);
        if (!payout || (payout.status !== "scheduled" && payout.status !== "in-transit")) return false;
        return remoteWrite("Marking the payment paid", async () => {
          const supabase = supabaseBrowser();
          // Only a payment still waiting to go out: a second press, or another
          // officer's, finds it paid and writes no second ledger line.
          const moved = await supabase
            .from("payouts")
            .update({ status: "paid" }, { count: "exact" })
            .eq("id", payoutId)
            .in("status", ["scheduled", "in-transit"]);
          if (moved.error) throw new Error(moved.error.message);
          if (!moved.count) throw new Error("That payment was already marked paid");
          const vendor = rc.vendors.find((v) => v.id === payout.vendorId);
          const operating = rc.bankAccounts.find((b) => b.kind === "operating");
          return supabase.from("ledger_entries").insert({
            association_id: rc.id,
            bank_account_id: operating && isUuid(operating.id) ? operating.id : null,
            occurred_on: today,
            description: payout.invoiceNumber ? `${payout.vendor}, ${payout.invoiceNumber}` : payout.vendor,
            counterparty: payout.vendor,
            category: vendor?.defaultCategory ?? "Vendors",
            amount_cents: -payout.amountCents,
            confirmed_at: new Date().toISOString(),
          });
        });
      }
      const payout = sliceStore(communityId, "payouts").getSnapshot().find((p) => p.id === payoutId);
      if (!payout || (payout.status !== "scheduled" && payout.status !== "in-transit")) return false;
      const vendor = sliceStore(communityId, "vendors").getSnapshot().find((v) => v.id === payout.vendorId);
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");
      const category = vendor?.defaultCategory ?? "Repairs & maintenance";
      sliceStore(communityId, "payouts").update((all) =>
        all.map((p) => (p.id === payoutId ? { ...p, status: "paid" as const } : p)),
      );
      // A bill paid from the invoice inbox already has its line, booked
      // pending; the money leaves the bank now, so it clears. Otherwise the
      // line is written here, as addPayout writes one for a payment recorded
      // as paid.
      const ledger = sliceStore(communityId, "ledger");
      if (ledger.getSnapshot().some((e) => e.payoutId === payoutId)) {
        ledger.update((all) =>
          all.map((e) =>
            e.payoutId === payoutId ? { ...e, status: "cleared" as const, date: today } : e,
          ),
        );
      } else {
        ledger.update((all) => [
          {
            id: `le-${payoutId}`,
            date: today,
            description: payout.invoiceNumber ? `${payout.vendor}, ${payout.invoiceNumber}` : payout.vendor,
            counterparty: payout.vendor,
            category,
            accountId: operating?.id ?? "unassigned",
            amountCents: -payout.amountCents,
            status: "cleared" as const,
            matchedBy: "manual" as const,
            payoutId,
          },
          ...all,
        ]);
      }
      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((a) =>
            a.id === operating.id ? { ...a, balanceCents: a.balanceCents - payout.amountCents } : a,
          ),
        );
      }
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "expense" && line.category === category
            ? { ...line, ytdActualCents: line.ytdActualCents + payout.amountCents }
            : line,
        ),
      );
      return true;
    },
    [can, remote.community, communityId],
  );

  const addPayout = useCallback(
    (payout: Community["payouts"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Recording the payment", async () => {
          const supabase = supabaseBrowser();
          const { error } = await supabase.from("payouts").insert({
            id: newId(),
            association_id: rc.id,
            vendor_id: isUuid(payout.vendorId) ? payout.vendorId : null,
            vendor_name: payout.vendor,
            invoice_number: payout.invoiceNumber,
            amount_cents: payout.amountCents,
            method: payout.method,
            status: payout.status,
            issued_on: payout.issuedDate,
            expected_on: payout.expectedDate,
            approvals: payout.approvals,
            approvals_required: payout.approvalsRequired,
          });
          if (error) throw new Error(error.message);
          // Money that already left is a line on the books from the same
          // click, or Finances shows a bank balance the bank does not.
          if (payout.status !== "paid") return;
          const vendor = rc.vendors.find((v) => v.id === payout.vendorId);
          const operating = rc.bankAccounts.find((b) => b.kind === "operating");
          return supabase.from("ledger_entries").insert({
            association_id: rc.id,
            bank_account_id: operating && isUuid(operating.id) ? operating.id : null,
            occurred_on: payout.issuedDate,
            description: payout.invoiceNumber
              ? `${payout.vendor}, ${payout.invoiceNumber}`
              : payout.vendor,
            counterparty: payout.vendor,
            category: payout.category ?? vendor?.defaultCategory ?? "Vendors",
            amount_cents: -payout.amountCents,
            confirmed_at: new Date().toISOString(),
          });
        });
        return;
      }
      sliceStore(communityId, "payouts").update((all) =>
        [payout, ...all].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)),
      );
      // The rest of what the signed-in path writes for money that already
      // left: a line on the operating account's books, and from it the bank
      // balance, the vendor's year, and the budget line. A payout row alone
      // read "Paid" while cash, Transactions and the vendor's total stood
      // still.
      if (payout.status !== "paid") return;
      const vendor = sliceStore(communityId, "vendors")
        .getSnapshot()
        .find((v) => v.id === payout.vendorId);
      const operating = sliceStore(communityId, "bankAccounts")
        .getSnapshot()
        .find((a) => a.kind === "operating");
      const category = payout.category ?? vendor?.defaultCategory ?? "Repairs & maintenance";
      const entry: Community["ledger"][number] = {
        id: `le-${payout.id}`,
        date: payout.issuedDate,
        description: payout.invoiceNumber ? `${payout.vendor}, ${payout.invoiceNumber}` : payout.vendor,
        counterparty: payout.vendor,
        category,
        accountId: operating?.id ?? "unassigned",
        amountCents: -payout.amountCents,
        status: "cleared",
        matchedBy: "manual",
        payoutId: payout.id,
      };
      sliceStore(communityId, "ledger").update((all) => [entry, ...all]);
      if (operating) {
        sliceStore(communityId, "bankAccounts").update((all) =>
          all.map((acct) =>
            acct.id === operating.id ? { ...acct, balanceCents: acct.balanceCents - payout.amountCents } : acct,
          ),
        );
      }
      if (vendor && payout.issuedDate.slice(0, 4) === todayIsoDate().slice(0, 4)) {
        sliceStore(communityId, "vendors").update((all) =>
          all.map((v) => (v.id === vendor.id ? { ...v, ytdPaidCents: v.ytdPaidCents + payout.amountCents } : v)),
        );
      }
      sliceStore(communityId, "budget").update((all) =>
        all.map((line) =>
          line.kind === "expense" && line.category === category
            ? { ...line, ytdActualCents: line.ytdActualCents + payout.amountCents }
            : line,
        ),
      );
    },
    [remote.community, communityId],
  );

  /**
   * Invoices have no table yet, so a real association is refused plainly
   * rather than given a record that lives in one browser and looks saved.
   */
  const invoicesLocalOnly = useCallback(() => {
    if (remote.community) {
      throw new ValidationError("Invoices are not saved for real associations yet", {});
    }
  }, [remote.community]);

  const addInvoice = useCallback(
    (input: Omit<VendorInvoice, "id" | "status" | "via">) => {
      invoicesLocalOnly();
      const invoice: VendorInvoice = {
        ...input,
        id: `inv-${communityId}-${Date.now().toString(36)}`,
        status: "new",
        via: "upload",
      };
      sliceStore(communityId, "invoices").update((all) => [invoice, ...all]);
      return invoice;
    },
    [invoicesLocalOnly, communityId],
  );

  const approveInvoice = useCallback(
    (invoiceId: string) => {
      invoicesLocalOnly();
      sliceStore(communityId, "invoices").update((all) =>
        all.map((i) => (i.id === invoiceId && i.status === "new" ? { ...i, status: "approved" } : i)),
      );
    },
    [invoicesLocalOnly, communityId],
  );

  const rejectInvoice = useCallback(
    (invoiceId: string, reason: string) => {
      invoicesLocalOnly();
      sliceStore(communityId, "invoices").update((all) =>
        all.map((i) =>
          i.id === invoiceId ? { ...i, status: "rejected", rejectedReason: reason.trim() } : i,
        ),
      );
    },
    [invoicesLocalOnly, communityId],
  );

  const payInvoice = useCallback(
    (invoiceId: string, notes?: string) => {
      invoicesLocalOnly();
      const invoice = sliceStore(communityId, "invoices")
        .getSnapshot()
        .find((i) => i.id === invoiceId);
      if (!invoice) throw new ValidationError("That invoice is not on file", { invoiceId });
      if (invoice.status === "paid") return;
      const vendor = sliceStore(communityId, "vendors")
        .getSnapshot()
        .find((v) => v.id === invoice.vendorId);
      const operating =
        sliceStore(communityId, "bankAccounts")
          .getSnapshot()
          .find((a) => a.kind === "operating") ?? sliceStore(communityId, "bankAccounts").getSnapshot()[0];
      if (!operating) {
        throw new ValidationError("Connect the association's bank account before paying a bill", {});
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const today = todayIsoDate();
      const stamp = Date.now().toString(36);
      const payout: Community["payouts"][number] = {
        id: `po-${communityId}-${stamp}`,
        vendorId: invoice.vendorId,
        vendor: invoice.vendor,
        invoiceNumber: invoice.number,
        amountCents: invoice.amountCents,
        method: "ach",
        status: "scheduled",
        issuedDate: today,
        expectedDate: addDays(today, 2),
        approvals: [{ name: me?.name ?? "The board", at: today }],
        approvalsRequired: 1,
        notes: notes?.trim() || undefined,
        invoiceId,
      };
      const entry: Community["ledger"][number] = {
        id: `le-${communityId}-${stamp}`,
        date: today,
        description: `${invoice.vendor}, ${invoice.description}`,
        counterparty: invoice.vendor,
        category: vendor?.defaultCategory ?? "Repairs & maintenance",
        accountId: operating.id,
        amountCents: -invoice.amountCents,
        status: "pending",
        matchedBy: "manual",
        payoutId: payout.id,
      };
      sliceStore(communityId, "payouts").update((all) =>
        [payout, ...all].sort((a, b) => b.issuedDate.localeCompare(a.issuedDate)),
      );
      sliceStore(communityId, "ledger").update((all) => [entry, ...all]);
      sliceStore(communityId, "invoices").update((all) =>
        all.map((i) =>
          i.id === invoiceId
            ? { ...i, status: "paid", payoutId: payout.id, notes: notes?.trim() || i.notes }
            : i,
        ),
      );
      if (vendor) {
        sliceStore(communityId, "vendors").update((all) =>
          all.map((v) =>
            v.id === vendor.id ? { ...v, ytdPaidCents: v.ytdPaidCents + invoice.amountCents } : v,
          ),
        );
      }
    },
    [invoicesLocalOnly, communityId],
  );

  const setPayoutNotes = useCallback(
    (payoutId: string, notes: string) => {
      // The payouts table has no notes column yet; a real association keeps
      // the note in this browser, and the screen says so.
      if (remote.community) return;
      sliceStore(communityId, "payouts").update((all) =>
        all.map((p) => (p.id === payoutId ? { ...p, notes: notes.trim() || undefined } : p)),
      );
    },
    [remote.community, communityId],
  );

  const addBudgetLine = useCallback(
    (line: Community["budget"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the budget line", () =>
          supabaseBrowser().from("budget_lines").insert({
            association_id: rc.id,
            category: line.category,
            annual_cents: line.annualCents,
            kind: line.kind,
            position: rc.budget.length,
          }),
        );
        return;
      }
      sliceStore(communityId, "budget").update((all) => [...all, line]);
    },
    [remote.community, communityId],
  );

  const addReserveComponent = useCallback(
    (component: Community["reserveComponents"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the component", () =>
          supabaseBrowser().from("reserve_components").insert({
            id: isUuid(component.id) ? component.id : newId(),
            association_id: rc.id,
            name: component.name,
            useful_life_years: component.usefulLifeYears,
            remaining_life_years: component.remainingLifeYears,
            replacement_cost_cents: component.replacementCostCents,
            funded_cents: component.fundedCents,
            last_inspection: component.lastInspection ?? null,
            note: component.note ?? null,
          }),
        );
        return;
      }
      sliceStore(communityId, "reserveComponents").update((all) => [...all, component]);
    },
    [remote.community, communityId],
  );

  const addSharedCost = useCallback(
    (cost: Community["sharedCosts"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the shared cost", () =>
          supabaseBrowser().from("shared_costs").insert({
            id: isUuid(cost.id) ? cost.id : newId(),
            association_id: rc.id,
            name: cost.name,
            kind: cost.kind,
            provider: cost.provider,
            account_ref: cost.accountRef,
            allocation: cost.allocation,
            markup_percent: cost.markupPercent,
            active: cost.active,
            usage_unit: cost.usageUnit,
          }),
        );
        return;
      }
      sliceStore(communityId, "sharedCosts").update((all) => [...all, cost]);
    },
    [remote.community, communityId],
  );

  const removeSharedCost = useCallback(
    (costId: string) => {
      if (remote.community) {
        // The bills go with it, by cascade.
        void remoteWrite("Removing the shared cost", () =>
          supabaseBrowser().from("shared_costs").delete({ count: "exact" }).eq("id", costId),
        );
        return;
      }
      sliceStore(communityId, "sharedCosts").update((all) =>
        all.filter((cost) => cost.id !== costId),
      );
      // The bills go with it. Leaving them would keep the cost in every total
      // while it no longer appears in any list, which is worse than losing it.
      sliceStore(communityId, "sharedCostBills").update((all) =>
        all.filter((bill) => bill.sharedCostId !== costId),
      );
    },
    [remote.community, communityId],
  );

  const postSharedCostBill = useCallback(
    (bill: Community["sharedCostBills"][number]) => {
      if (remote.community) {
        const cost = remote.community.sharedCosts.find((c) => c.id === bill.sharedCostId);
        // The database divides the bill between the homes and posts a charge
        // to each, in one function, so the split cannot drift from the total.
        void remoteWrite("Posting the bill", () =>
          supabaseBrowser().rpc("post_shared_cost_bill", {
            p_shared_cost_id: bill.sharedCostId,
            p_period_start: bill.periodStart,
            p_period_end: bill.periodEnd,
            p_total_cents: bill.totalCents,
            p_due_on: bill.dueOn,
            p_usage_amount: bill.usageAmount ?? null,
            p_usage_unit: cost?.usageUnit ?? "",
          }),
        );
        return;
      }
      sliceStore(communityId, "sharedCostBills").update((all) => [...all, bill]);
    },
    [remote.community, communityId],
  );

  return {
    reopenFiscalYear,
    closeFiscalYear,
    addBankAccount,
    recordPayment,
    recordManualPayment,
    reverseManualPayment,
    manualPaymentsFor,
    addCredit,
    addCharge,
    addChargeToAll,
    setOpeningBankBalance,
    setOpeningBalances,
    setAutopay,
    addInstrument,
    removeInstrument,
    setDefaultInstrument,
    confirmLedgerEntry,
    reverseLedgerEntry,
    recordReserveTransfer,
    approvePayout,
    markPayoutPaid,
    addPayout,
    addInvoice,
    approveInvoice,
    rejectInvoice,
    payInvoice,
    setPayoutNotes,
    addBudgetLine,
    addReserveComponent,
    addSharedCost,
    removeSharedCost,
    postSharedCostBill,
  };
}
