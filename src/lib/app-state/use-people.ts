import { useCallback } from "react";
import { allCommunities } from "@/lib/data/communities";
import { type AppDeps, destructive, isUuid, latest, logDemoActivity, newId, remoteWrite, sessionStore, sliceStore, ValidationError } from "./core";
import { caps, DEFAULT_ROLE_CAPABILITIES, DEFAULT_ROLE_VIEWS, NO_CAPABILITIES } from "@/lib/data/accounts";
import { DUES_HIGH_MESSAGE, isEmail, MAX_DUES_CENTS } from "@/lib/input-checks";
import { todayIsoDate } from "@/lib/utils";
import { reportRemoteError, WRITE_TIMEOUT_MS } from "@/lib/data/remote-store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import type { AccessLevel, AccountRole, Capabilities, Capability, HomeType, JoinRequest, Home } from "@/lib/types";
import { placeLabel } from "@/lib/wording";
import { activityWords } from "@/lib/activity";

/**
 * People: owners and co-owners, who holds which seat and role, a sale or
 * transfer of a home, retiring an owner, and requests to join.
 */
export function usePeopleActions(deps: AppDeps) {
  const { remote, communityId } = deps;

  const setCapability = useCallback(
    (id: string, capability: Capability, level: AccessLevel) => {
      // The President's grid is deliberately immutable. An association that can
      // strip its President of access has no way back in.
      const change = level === "change";
      const view = level === "view";
      if (!remote.community) {
        sliceStore(communityId, "accounts").update((list) =>
          list.map((a) =>
            a.id === id && a.role !== "president"
              ? {
                  ...a,
                  capabilities: { ...a.capabilities, [capability]: change },
                  views: { ...a.views, [capability]: view },
                }
              : a,
          ),
        );
        return;
      }
      const rc = remote.community;
      const seat = rc.accounts.find((a) => a.id === id);
      if (!seat || seat.role === "president") return;
      const held = (set: Capabilities, on: boolean) =>
        Object.entries({ ...set, [capability]: on })
          .filter(([, v]) => v)
          .map(([name]) => name);
      void remoteWrite("Saving access", () => {
        // The seat as the last write left it. Built from the copy on screen,
        // the second of two quick presses on the grid dropped the first.
        const account = latest(rc).accounts.find((a) => a.id === id) ?? seat;
        return supabaseBrowser()
          .from("memberships")
          .update(
            { capabilities: held(account.capabilities, change), views: held(account.views, view) },
            { count: "exact" },
          )
          .eq("association_id", rc.id)
          .eq("profile_id", id)
          .is("ends_on", null);
      });
    },
    [remote.community, communityId],
  );

  /**
   * Appoints a household to an office, or returns them to being a resident.
   *
   * Capabilities reset to that office's defaults, because carrying the old
   * ones over is how a former treasurer keeps the books open. The President's
   * own row is left alone: an association that can demote its President has no
   * way back in.
   */
  const setAccountRole = useCallback(
    (accountId: string, role: AccountRole) => {
      if (!remote.community) {
        sliceStore(communityId, "accounts").update((all) =>
          all.map((account) =>
            account.id === accountId && account.role !== "president"
              ? {
                  ...account,
                  role,
                  capabilities: caps(DEFAULT_ROLE_CAPABILITIES[role] ?? []),
                  views: caps(DEFAULT_ROLE_VIEWS[role] ?? []),
                }
              : account,
          ),
        );
        return;
      }
      const rc = remote.community;
      // Making somebody President is a handover, and the database keeps the
      // rule that there is exactly one; it has its own function for that.
      if (role === "president") {
        void remoteWrite("Transferring the presidency", () =>
          supabaseBrowser().rpc("transfer_presidency", { p_to_profile: accountId }),
        );
        return;
      }
      void remoteWrite("Saving the role", () =>
        supabaseBrowser()
          .from("memberships")
          .update(
            {
              role,
              capabilities: DEFAULT_ROLE_CAPABILITIES[role] ?? [],
              views: DEFAULT_ROLE_VIEWS[role] ?? [],
            },
            { count: "exact" },
          )
          .eq("association_id", rc.id)
          .eq("profile_id", accountId)
          .is("ends_on", null)
          .neq("role", "president"),
      );
    },
    [remote.community, communityId],
  );

  const setHomeRole = useCallback(
    (homeId: string, role: AccountRole) => {
      if (!remote.community) {
        const account = sliceStore(communityId, "accounts")
          .getSnapshot()
          .find((a) => a.homeId === homeId);
        if (account) setAccountRole(account.id, role);
        return;
      }
      const rc = remote.community;
      // The presidency needs a person, not a home; that is a handover.
      if (role === "president") {
        const holder = rc.accounts.find((a) => a.homeId === homeId);
        if (holder) setAccountRole(holder.id, role);
        return;
      }
      // Keyed on the home, so an officer can be named before they have
      // signed up. Their capabilities are waiting when they do.
      void remoteWrite("Saving the role", () =>
        supabaseBrowser()
          .from("memberships")
          .update(
            {
              role,
              capabilities: DEFAULT_ROLE_CAPABILITIES[role] ?? [],
              views: DEFAULT_ROLE_VIEWS[role] ?? [],
            },
            { count: "exact" },
          )
          .eq("association_id", rc.id)
          .eq("unit_id", homeId)
          .is("ends_on", null)
          .neq("role", "president"),
      );
    },
    [remote.community, communityId, setAccountRole],
  );

  /**
   * Adds a household to the roster, with the account that lets them sign in.
   *
   * An owner and an account are created together because in an association
   * they are the same fact: the register says who the members are, and every
   * member gets access. Splitting them lets the two drift.
   */
  const addOwnerSaving = useCallback(
    (input: {
      name: string;
      email: string;
      unit: string;
      homeType?: HomeType;
    }): { home: Home; saved: Promise<boolean> } => {
      const unit = input.unit.trim();
      const existing = remote.community
        ? remote.community.homes
        : sliceStore(communityId, "homes").getSnapshot();
      if (existing.some((o) => o.unit === unit)) {
        throw new ValidationError(`${placeLabel(unit)} is already on the roster`, { unit });
      }

      // The id is chosen here so the screen can name the household before
      // the write lands; the database takes it as given.
      const homeId = remote.community ? newId() : `${communityId}-own-${unit}`;
      const home: Home = {
        id: homeId,
        displayName: input.name.trim(),
        members: [input.name.trim()],
        email: input.email.trim(),
        phone: "",
        unit,
        address: placeLabel(unit),
        moveInDate: todayIsoDate(),
        balanceCents: 0,
        autopay: false,
        standing: "current",
        daysPastDue: 0,
        homeType: input.homeType,
      };

      if (remote.community) {
        const rc = remote.community;
        const saved = remoteWrite("Adding the home", async () => {
          const added = await supabaseBrowser().rpc("add_household", {
            p_association_id: rc.id,
            p_unit_id: homeId,
            p_name: home.displayName,
            p_email: home.email,
            p_unit: unit,
          });
          // The kind of home rides on the unit the function just made.
          if (added.error || !input.homeType) return added;
          return supabaseBrowser()
            .from("units")
            .update({ home_type: input.homeType })
            .eq("id", homeId);
        });
        return { home, saved };
      }

      sliceStore(communityId, "homes").update((all) => [...all, home]);
      sliceStore(communityId, "accounts").update((all) => [
        ...all,
        {
          id: `${communityId}-acct-${unit}`,
          homeId,
          name: home.displayName,
          email: home.email,
          unit,
          role: "resident" as const,
          capabilities: NO_CAPABILITIES,
          views: NO_CAPABILITIES,
        },
      ]);
      return { home, saved: Promise.resolve(true) };
    },
    [remote.community, communityId],
  );

  /**
   * The household at once, for a screen that names it before the write
   * lands. A caller whose next step depends on the write having landed uses
   * `addOwnerSaving` and waits for `saved`.
   */
  const addOwner = useCallback(
    (input: { name: string; email: string; unit: string; homeType?: HomeType }) =>
      addOwnerSaving(input).home,
    [addOwnerSaving],
  );

  /**
   * What each home owed on the day the association switched to us.
   *
   * The one step that makes a move from anywhere else work end to end, and the
   * reason nothing in this product imports a ledger. Reproducing a decade of
   * somebody else's history is where a migration stalls, and the reproduced
   * version is never right anyway: a single opening figure per home is enough
   * to be correct from the switch date forward.
   *
   * It is written as a dated line on the statement rather than as a number
   * that appears from nowhere, because an owner who cannot see where a balance
   * came from disputes it, and a board that cannot show where it came from
   * loses that dispute.
   */
  const setHouseholdOwner = useCallback(
    (homeId: string, input: { name: string; email: string }) => {
      const name = input.name.trim();
      const email = input.email.trim();
      if (remote.community) {
        // The empty membership the founding wizard left on the home takes the
        // name, so the row on the roster becomes theirs rather than a second
        // household on the same lot. Seating waits for them to sign in.
        //
        // Counted, because there is no insert behind this: a home with no
        // empty seat, or one this officer may not write, matched nothing,
        // saved nothing and was still reported as "Jane Doe is on 12".
        return remoteWrite("Adding the owner", () =>
          supabaseBrowser()
            .from("memberships")
            .update({ full_name: name, invited_email: email || null }, { count: "exact" })
            .eq("unit_id", homeId)
            .is("profile_id", null)
            .is("ends_on", null),
        );
      }
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) =>
          o.id === homeId
            ? { ...o, displayName: name, members: [name], email, placeholder: false }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /**
   * The demo's version of a seat: the person is named on the home and gets an
   * account of their own. Two accounts can point at one home, which is what
   * a second owner is. Nothing is added to the register.
   */
  const seatInDemo = useCallback(
    (homeId: string, input: { name: string; email: string }, second: boolean) => {
      const homes = sliceStore(communityId, "homes");
      const home = homes.getSnapshot().find((o) => o.id === homeId);
      if (!home) return false;
      const name = input.name.trim();
      const email = input.email.trim();
      const accounts = sliceStore(communityId, "accounts");
      const onHome = accounts.getSnapshot().filter((a) => a.homeId === homeId);
      if (second || home.placeholder) {
        // A second owner joins the names on title; the first owner of an
        // empty home replaces the stand in name.
        homes.update((all) =>
          all.map((o) =>
            o.id !== homeId
              ? o
              : second
                ? { ...o, members: [...o.members, name] }
                : { ...o, displayName: name, members: [name], email, placeholder: false },
          ),
        );
        accounts.update((all) => [
          ...all,
          {
            id: `${communityId}-acct-${home.unit}${second ? `-${onHome.length + 1}` : ""}`,
            homeId,
            name,
            email,
            unit: home.unit,
            role: "resident" as const,
            capabilities: NO_CAPABILITIES,
            views: NO_CAPABILITIES,
          },
        ]);
        return true;
      }
      // A home with a listed owner who has no email: the requester takes it.
      homes.update((all) =>
        all.map((o) => (o.id === homeId ? { ...o, displayName: name, members: [name], email } : o)),
      );
      accounts.update((all) =>
        all.map((a) => (a.homeId === homeId ? { ...a, name, email } : a)),
      );
      return true;
    },
    [communityId],
  );

  /**
   * A second owner of a home that already has one. They are a second seat on
   * the same home: the bill, the balance and the vote stay the home's.
   */
  const addSecondOwner = useCallback(
    (homeId: string, input: { name: string; email: string }) => {
      if (remote.community) {
        return remoteWrite("Adding the second owner", () =>
          supabaseBrowser().rpc("add_second_owner", {
            p_unit_id: homeId,
            p_name: input.name.trim(),
            p_email: input.email.trim(),
          }),
        );
      }
      return Promise.resolve(seatInDemo(homeId, input, true));
    },
    [remote.community, seatInDemo],
  );

  /**
   * One owner of two taken off the home, today. The other owner keeps the
   * home, the bill and the vote. A real association asks remove_owner (0090),
   * which refuses the only owner, the president and anybody on the board; the
   * demo drops the second name and account from the household.
   */
  const removeCoOwner = useCallback(
    (homeId: string, seatId: string) => {
      if (remote.community) {
        return remoteWrite("Removing the owner", () =>
          supabaseBrowser().rpc("remove_owner", { p_membership_id: seatId }),
        );
      }
      const accounts = sliceStore(communityId, "accounts");
      const gone = accounts.getSnapshot().find((a) => a.id === seatId && a.homeId === homeId);
      const onHome = accounts.getSnapshot().filter((a) => a.homeId === homeId);
      if (!gone || onHome.length < 2) return Promise.resolve(false);
      accounts.update((all) => all.filter((a) => a.id !== seatId));
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) => {
          if (o.id !== homeId) return o;
          const members = o.members.filter((m) => m !== gone.name);
          const first = members[0] ?? o.displayName;
          return {
            ...o,
            members,
            displayName: o.displayName === gone.name ? first : o.displayName,
            email: o.email === gone.email ? (onHome.find((a) => a.id !== seatId)?.email ?? o.email) : o.email,
          };
        }),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /**
   * Corrects the address a listed owner will claim their seat with.
   * claim_my_seats matches it on the next sign in or press of their
   * invitation link, so a typo no longer strands them.
   */
  const changeOwnerEmail = useCallback(
    (homeId: string, email: string) => {
      const next = email.trim();
      if (remote.community) {
        const current = remote.community.homes.find((o) => o.id === homeId);
        return remoteWrite("Changing the email", () =>
          supabaseBrowser().rpc("change_owner_email", {
            p_unit_id: homeId,
            p_old_email: current?.email ?? "",
            p_new_email: next,
          }),
        );
      }
      const was = sliceStore(communityId, "homes").getSnapshot().find((o) => o.id === homeId)?.email;
      const home = sliceStore(communityId, "homes").getSnapshot().find((o) => o.id === homeId);
      if (home && was !== next) {
        logDemoActivity(communityId, "seat", activityWords.email(home.unit, was ?? "no email", next), {
          unit_id: homeId,
          home: home.unit,
        });
      }
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) => (o.id === homeId ? { ...o, email: next } : o)),
      );
      sliceStore(communityId, "accounts").update((all) =>
        all.map((a) => (a.homeId === homeId && a.email === was ? { ...a, email: next } : a)),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /**
   * Correcting what kind of home a home is.
   *
   * The kind decides the dues it is billed from the next due date on; bills
   * already issued keep their amount, because an owner's statement never
   * changes behind them.
   */
  const setHomeType = useCallback(
    (homeIds: string[], homeType: HomeType) => {
      if (!homeIds.length) return true;
      if (remote.community) {
        return remoteWrite("Saving the kind of home", () =>
          supabaseBrowser()
            .from("units")
            .update({ home_type: homeType }, { count: "exact" })
            .in("id", homeIds),
        );
      }
      const ids = new Set(homeIds);
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) => (ids.has(o.id) ? { ...o, homeType } : o)),
      );
      return true;
    },
    [remote.community, communityId],
  );

  /**
   * One home's own dues, or several. `set_home_dues` (0084) is the only way
   * in: a finance holder may call it and a settings holder may too, which a
   * plain update of the units table would not allow the first. Bills already
   * issued keep their amount.
   */
  const setHomeDues = useCallback(
    (changes: { homeId: string; cents: number | null }[]) => {
      if (!changes.length) return true;
      if (changes.some((c) => c.cents !== null && (!Number.isInteger(c.cents) || c.cents < 0))) {
        reportRemoteError("Dues cannot be negative");
        return false;
      }
      if (changes.some((c) => c.cents !== null && c.cents > MAX_DUES_CENTS)) {
        reportRemoteError(DUES_HIGH_MESSAGE);
        return false;
      }
      if (remote.community) {
        return remoteWrite("Saving dues", async () => {
          const supabase = supabaseBrowser();
          for (const { homeId, cents } of changes) {
            const { error } = await supabase.rpc("set_home_dues", {
              p_unit_id: homeId,
              p_dues_cents: cents,
            });
            if (error) throw new Error(error.message);
          }
        }, { timeoutMs: WRITE_TIMEOUT_MS + changes.length * 1_000 });
      }
      const byHome = new Map(changes.map((c) => [c.homeId, c.cents]));
      for (const o of sliceStore(communityId, "homes").getSnapshot()) {
        if (!byHome.has(o.id)) continue;
        const next = byHome.get(o.id) || null;
        if (next === (o.duesCents ?? null)) continue;
        logDemoActivity(communityId, "unit", activityWords.dues(o.unit, next), { unit_id: o.id, home: o.unit });
      }
      sliceStore(communityId, "homes").update((all) =>
        all.map((o) => {
          if (!byHome.has(o.id)) return o;
          const cents = byHome.get(o.id);
          // Zero reads as no amount, as it does in the database.
          const { duesCents: _was, ...rest } = o;
          void _was;
          return cents ? { ...rest, duesCents: cents } : rest;
        }),
      );
      return true;
    },
    [remote.community, communityId],
  );

  /** Removes a household and its account together, returning one undo for both. */
  const removeOwner = useCallback(
    (homeId: string) => {
      if (!remote.community) {
        const undoOwners = destructive(sliceStore(communityId, "homes"), (all) =>
          all.filter((o) => o.id !== homeId),
        );
        const undoAccounts = destructive(sliceStore(communityId, "accounts"), (all) =>
          all.filter((a) => a.homeId !== homeId),
        );
        return () => {
          undoOwners();
          undoAccounts();
        };
      }
      // A home with no statement is deleted outright. One with a statement
      // is retired instead (0099): its records stay, it is billed and
      // counted no more. The database decides which, and refuses a home
      // that still owes money, saying so through the toast. The undo below
      // only fits the deleted case; a retired home is brought back by hand.
      const rc = remote.community;
      const home = rc.homes.find((o) => o.id === homeId);
      const hasStatement = (rc.homeCharges[homeId] ?? []).length > 0;
      void remoteWrite(hasStatement ? "Retiring the home" : "Removing the household", () =>
        hasStatement
          ? supabaseBrowser().rpc("retire_home", { p_unit_id: homeId })
          : supabaseBrowser().rpc("remove_household", { p_unit_id: homeId }),
      );
      return () => {
        if (!home || hasStatement) return;
        void remoteWrite("Restoring the household", () =>
          supabaseBrowser().rpc("add_household", {
            p_association_id: rc.id,
            p_unit_id: home.id,
            p_name: home.displayName,
            p_email: home.email,
            p_unit: home.unit,
          }),
        );
      };
    },
    [remote.community, communityId],
  );

  const transferHome = useCallback(
    (
      homeId: string,
      input: { name: string; email: string; closingDate: string; settleBalance: boolean },
    ) => {
      const name = input.name.trim();
      const email = input.email.trim();
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Recording the sale", async () => {
          const supabase = supabaseBrowser();
          // What the home owes now, not what it owed when the form opened. A
          // failed attempt re-reads the association, so a second try does not
          // settle a balance the first one already settled.
          const now = latest(rc);
          const home = now.homes.find((o) => o.id === homeId);
          const owed = home?.balanceCents ?? 0;
          const settle = input.settleBalance && owed > 0;
          const recordSale = () =>
            supabase.rpc("transfer_home", {
              p_unit_id: homeId,
              p_new_name: name,
              p_new_email: email,
              p_closing_date: input.closingDate,
            });
          // Paid out of escrow at closing: a payment line, so the statement
          // shows where the balance went rather than a number vanishing.
          const recordPayment = () =>
            supabase.from("charges").insert({
              association_id: rc.id,
              unit_id: homeId,
              kind: "payment",
              label: "Paid at closing",
              amount_cents: -owed,
              due_on: input.closingDate,
            });
          // And the money itself, which the title company wires to the
          // association. Without this line the owner's balance cleared while
          // the bank balance and "collected" never saw the payment.
          const recordDeposit = () => {
            const operating = now.bankAccounts.find((b) => b.kind === "operating");
            return supabase.from("ledger_entries").insert({
              association_id: rc.id,
              bank_account_id: operating && isUuid(operating.id) ? operating.id : null,
              occurred_on: input.closingDate,
              description: `Paid at closing, ${placeLabel(home?.unit ?? "")}`.trim(),
              counterparty: home?.displayName ?? "Title company",
              category: "Assessments",
              amount_cents: owed,
              confirmed_at: new Date().toISOString(),
            });
          };
          const depositMissing = (why: string) =>
            `the sale and the payment at closing are recorded, but the deposit is not in Finances (${why}). Do not record the sale again`;

          // An officer recording the sale of their own home is the one case
          // where the money goes first. The sale ends their seat, and with it
          // the right to write the payment and the deposit, so sale first
          // left the home sold and the balance still owing, refused. Any
          // other home is sold first, below. A President's home is too: the
          // database refuses that sale outright, and money written ahead of
          // a sale that cannot happen is the fault sale first was put in to
          // stop.
          const seats = now.accounts.filter((a) => a.homeId === homeId);
          const ownHome =
            seats.some((a) => a.id === remote.profileId) &&
            !seats.some((a) => a.role === "president");
          if (settle && ownHome) {
            // The one refusal that can be seen coming, checked before any
            // money is written.
            if (home && input.closingDate < home.moveInDate) {
              throw new Error("the closing date is before this owner took ownership. Check the date");
            }
            const { error } = await recordPayment();
            if (error) throw new Error(error.message);
            const { error: bookError } = await recordDeposit();
            const { error: saleError } = await recordSale();
            if (saleError) {
              // The re-read after this shows the home owing nothing, so the
              // next try goes straight to the sale.
              throw new Error(
                `the balance paid at closing is recorded, but the sale was not (${saleError.message}). Record the sale again: the balance will not be paid twice`,
              );
            }
            if (bookError) throw new Error(depositMissing(bookError.message));
            return;
          }

          // The sale first. The database can refuse it (a closing date before
          // the tenure began, a home held by the President), and money written
          // ahead of a refused sale stayed on the books with no sale behind it.
          const { error: saleError } = await recordSale();
          if (saleError) throw new Error(saleError.message);
          if (!settle) return;
          // The sale is on record by now, so a failure from here says so:
          // pressing again would seat the buyer a second time.
          const { error } = await recordPayment();
          if (error) {
            throw new Error(
              `the sale is recorded, but the balance paid at closing was not (${error.message}). Do not record the sale again. The home still shows what it owed`,
            );
          }
          const { error: bookError } = await recordDeposit();
          if (bookError) throw new Error(depositMissing(bookError.message));
        });
      }

      const homes = sliceStore(communityId, "homes");
      const before = homes.getSnapshot().find((o) => o.id === homeId);
      if (!before) return false;
      const settle = input.settleBalance && before.balanceCents > 0;
      homes.update((all) =>
        all.map((o) =>
          o.id === homeId
            ? {
                ...o,
                displayName: name,
                members: [name],
                email,
                moveInDate: input.closingDate,
                balanceCents: settle ? 0 : o.balanceCents,
                daysPastDue: settle ? 0 : o.daysPastDue,
                standing: settle ? ("current" as const) : o.standing,
                autopay: false,
                autopayMethod: undefined,
                boardRole: undefined,
              }
            : o,
        ),
      );
      if (settle) {
        sliceStore(communityId, "homeCharges").update((all) => ({
          ...all,
          [homeId]: [
            {
              id: `${homeId}-closing-${input.closingDate}`,
              date: input.closingDate,
              label: "Paid at closing",
              kind: "payment" as const,
              amountCents: -before.balanceCents,
              balanceAfterCents: 0,
            },
            ...(all[homeId] ?? []),
          ],
        }));
      }
      // The seller's sign-in goes with them; the buyer gets a resident seat.
      sliceStore(communityId, "accounts").update((all) => [
        ...all.filter((a) => a.homeId !== homeId),
        {
          id: `${communityId}-acct-${before.unit}-${input.closingDate}`,
          homeId,
          name,
          email,
          unit: before.unit,
          role: "resident" as const,
          capabilities: NO_CAPABILITIES,
          views: NO_CAPABILITIES,
        },
      ]);
      // Synchronous on purpose: the demo path settles in one render, and a
      // promise here would make every test's act() an async one.
      return true;
    },
    [remote.community, remote.profileId, communityId],
  );

  const updateMyContact = useCallback(
    (input: { phone: string; mailingAddress: string }) => {
      if (remote.community) {
        const rc = remote.community;
        return remoteWrite("Saving your contact details", () =>
          supabaseBrowser().rpc("update_my_contact", {
            p_association_id: rc.id,
            p_phone: input.phone,
            p_mailing_address: input.mailingAddress,
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
            ? { ...o, phone: input.phone, mailingAddress: input.mailingAddress || undefined }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  const decideJoin = useCallback(
    (requestId: string, status: "approved" | "declined") => {
      const today = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        const by = rc.accounts.find((a) => a.id === remote.profileId)?.name ?? "Board";
        return remoteWrite(status === "approved" ? "Letting them in" : "Declining", () =>
          supabaseBrowser()
            .from("join_requests")
            .update({ status, decided_on: today, decided_by: by }, { count: "exact" })
            .eq("id", requestId),
        );
      }
      const by =
        sliceStore(communityId, "accounts")
          .getSnapshot()
          .find((a) => a.id === sessionStore.getSnapshot().accountId)?.name ?? "Board";
      sliceStore(communityId, "joinRequests").update((all) =>
        all.map((j) =>
          j.id === requestId ? { ...j, status, decidedOn: today, decidedBy: by } : j,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, remote.profileId, communityId],
  );

  const approveJoinRequest = useCallback(
    async (requestId: string, unit: string) => {
      const existing = remote.community
        ? remote.community.joinRequests
        : sliceStore(communityId, "joinRequests").getSnapshot();
      const request = existing.find((j) => j.id === requestId);
      if (!request) return false;
      // The roster is the only door. Approving is adding the household with
      // the address they gave, so the same rules apply as to any other add.
      const { home, saved } = addOwnerSaving({ name: request.name, email: request.email, unit });
      // The household first, and only then the decision. Marked approved
      // while the add was still in the air, a refused add left a request
      // that read "approved", a welcome email on its way, and no home.
      if (!(await saved)) return false;
      const decided = await decideJoin(requestId, "approved");
      // They made an account when they asked, so the note that says "you're
      // in" carries a link that opens it. Fire and forget: the roster is
      // already right, and a failed email is logged on the server.
      if (decided && remote.community) {
        void fetch("/api/email/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            associationId: remote.community.id,
            unitIds: [home.id],
            kind: "welcome",
          }),
        }).catch(() => undefined); // The roster is right already; the server logs a failed email.
      }
      return decided;
    },
    [remote.community, communityId, addOwnerSaving, decideJoin],
  );

  /**
   * The board chose a home from the register for this request. Nothing is
   * created from what the person typed: the database seats them on that
   * home (or beside its owner), and only then is the request marked decided,
   * so a refusal leaves it waiting.
   */
  const seatJoinRequest = useCallback(
    async (requestId: string, homeId: string, second: boolean) => {
      const existing = remote.community
        ? remote.community.joinRequests
        : sliceStore(communityId, "joinRequests").getSnapshot();
      const request = existing.find((j) => j.id === requestId);
      if (!request) return false;
      if (remote.community) {
        const seated = await remoteWrite("Letting them in", () =>
          supabaseBrowser().rpc("seat_join_request", {
            p_request_id: requestId,
            p_unit_id: homeId,
            p_as_second: second,
          }),
        );
        if (!seated) return false;
        const decided = await decideJoin(requestId, "approved");
        // The note that says "you're in" goes to every address on the home,
        // so a second owner is not sent one: it would reach the first owner
        // too. They find the home on their next sign in or Check again.
        if (decided && !second) {
          void fetch("/api/email/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              associationId: remote.community.id,
              unitIds: [homeId],
              kind: "welcome",
            }),
          }).catch(() => undefined); // The roster is right already; the server logs a failed email.
        }
        return decided;
      }
      if (!seatInDemo(homeId, { name: request.name, email: request.email }, second)) return false;
      return decideJoin(requestId, "approved");
    },
    [remote.community, communityId, decideJoin, seatInDemo],
  );

  const declineJoinRequest = useCallback(
    (requestId: string) => decideJoin(requestId, "declined"),
    [decideJoin],
  );

  const requestToJoin = useCallback(
    async (input: { code: string; name: string; email: string; unit: string; note: string }) => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      const email = input.email.trim();
      if (!code) return { ok: false as const, error: "Enter the join code from your board." };
      if (!name || !isEmail(email)) {
        return { ok: false as const, error: "Enter your name and a working email address." };
      }
      // A demo association answers from the browser, so the flow can be
      // tried without an account. A real one goes to the database as anyone.
      const local = allCommunities().find((c) => c.association.joinCode === code);
      if (local) {
        const request: JoinRequest = {
          id: `join-${Date.now()}`,
          name,
          email,
          unit: input.unit.trim(),
          note: input.note.trim(),
          status: "pending",
          requestedOn: todayIsoDate(),
        };
        sliceStore(local.id, "joinRequests").update((all) =>
          all.some((j) => j.email.toLowerCase() === email.toLowerCase() && j.status === "pending")
            ? all
            : [request, ...all],
        );
        return { ok: true as const, association: local.settings.displayName };
      }
      const { data, error } = await supabaseBrowser().rpc("request_to_join", {
        p_code: code,
        p_name: name,
        p_email: email,
        p_unit: input.unit.trim(),
        p_note: input.note.trim(),
      });
      if (error || !data) {
        return { ok: false as const, error: error?.message ?? "No association has that join code. Check it with your board." };
      }
      return { ok: true as const, association: data };
    },
    [],
  );

  const lookupJoinCode = useCallback(async (input: string) => {
    const code = input.trim().toUpperCase();
    if (!code) return null;
    const local = allCommunities().find((c) => c.association.joinCode === code);
    if (local) {
      return { name: local.settings.displayName, place: local.association.addressLine };
    }
    if (!hasSupabase) return null;
    // Through our own route so lookups are counted per address; the answer
    // is the same anonymous RPC either way.
    const response = await fetch(`/api/join/lookup?code=${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { found: { name: string; place: string } | null };
    return body.found;
  }, []);

  return {
    setCapability,
    setAccountRole,
    setHomeRole,
    addOwner,
    setHouseholdOwner,
    addSecondOwner,
    removeCoOwner,
    changeOwnerEmail,
    setHomeType,
    setHomeDues,
    removeOwner,
    transferHome,
    updateMyContact,
    approveJoinRequest,
    seatJoinRequest,
    declineJoinRequest,
    requestToJoin,
    lookupJoinCode,
  };
}
