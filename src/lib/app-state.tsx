"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { allCommunities, seededCommunities, communityById } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { caps, DEFAULT_ROLE_CAPABILITIES, DEFAULT_ROLE_VIEWS, NO_CAPABILITIES } from "@/lib/data/accounts";
import { DUES_HIGH_MESSAGE, MAX_DUES_CENTS, isEmail } from "@/lib/input-checks";
import { addDays, daysFromToday, formatDate, setToday, todayIsoDate } from "@/lib/utils";
import { createdCommunitiesStore } from "@/lib/data/created-communities";
import { useRemote, refreshRemote, reportRemoteError, NOTHING_CHANGED, WRITE_TIMEOUT_MS } from "@/lib/data/remote-store";
import { officeOf } from "@/lib/board-offices";
import { ownerDues } from "@/lib/home-types";
import { supabaseBrowser } from "@/lib/supabase/client";
import { hasSupabase } from "@/lib/supabase/env";
import type { Json } from "@/lib/supabase/database.types";
import { documentTitle, formatSize, mimeTypeOf, rejectReason, storagePathFor, toDbVisibility, toDocumentRecord } from "@/lib/documents";

import type { DocumentRecord, ActionItem, Announcement, Capability, JoinRequest, WorkOrder, ForumPost, ForumReply, HomeRequest, MessageThread, Office, ThreadAddress, Owner, HomeType, AccountRole, Violation, ViolationReport, AccessLevel, Capabilities } from "@/lib/types";
import { canRaiseNotice } from "@/lib/violations";
import { type PaymentInstrument } from "@/lib/payments/instruments";
import { placeLabel } from "@/lib/wording";
import { homeCount } from "@/lib/metrics";
import { activityWords } from "@/lib/activity";
import { noticeToast, replyEmailState, type ReplyEmail } from "@/lib/email/plain-error";
import { vendorNameProblem } from "@/lib/vendor-name";
import { statusAfterReply, statusLabel } from "@/lib/request-status";
import { ballotPhase, meetingPhase } from "@/lib/phases";
import { communityStore, demoActivityStore, destructive, dismissStore, emailNotice, homePhotoStore, homeStore, isUuid, joinLine, latest, logDemoActivity, MUTABLE_SLICES, newId, NOT_CHANGED, noticesInFlight, remoteWrite, sessionStore, sliceStore, useHydrated, useStore, ValidationError, voteReceipt } from "./app-state/core";
import type { AppState, UploadOutcome } from "./app-state/types";
import { useSessionActions } from "./app-state/use-session";
import type { BaseDeps } from "./app-state/core";
import { useSettingsActions } from "./app-state/use-settings";
import type { AppDeps } from "./app-state/core";
import { useMoneyActions } from "./app-state/use-money";

export { resetAllStores } from "./app-state/core";
export type { LedgerReversal, SettingsPatch, UploadOutcome, View } from "./app-state/types";



const Ctx = createContext<AppState | null>(null);


export function AppStateProvider({ children }: { children: ReactNode }) {
  const session = useStore(sessionStore);
  const chosenHome = useStore(homeStore);
  const ready = useHydrated();

  const remote = useRemote();
  const communityId = useStore(communityStore);
  // Created associations live in a store, so the list has to be read rather
  // than captured at import time.
  const createdList = useStore(createdCommunitiesStore);
  const communityList = useMemo(() => [...seededCommunities, ...createdList], [createdList]);
  const community = communityById(communityId);

  // Each association's fixture data is written as of its own date, so the
  // pinned clock follows the community. Set before the slices are read so
  // every derived figure below this line sees the same "today". A real
  // association is read as of the actual date, so its clock is that date;
  // a closing date defaulting to the demo's August would be refused by the
  // database as earlier than the tenure it is closing.
  setToday(remote.community?.asOf ?? community.asOf);

  // One hook per slice, in a fixed order, so the hook count never changes when
  // the community does.
  const settings = useStore(sliceStore(communityId, "settings"));
  const accountList = useStore(sliceStore(communityId, "accounts"));
  const ownerList = useStore(sliceStore(communityId, "owners"));
  const bankAccountList = useStore(sliceStore(communityId, "bankAccounts"));
  const budgetLines = useStore(sliceStore(communityId, "budget"));
  // Demo associations keep their skipped setup tasks here. Real ones keep them
  // in the database, loaded alongside the community.
  const localDismissals = useStore(dismissStore(communityId));
  const ownerChargeMap = useStore(sliceStore(communityId, "ownerCharges"));
  const amenities = useStore(sliceStore(communityId, "amenities"));
  const forms = useStore(sliceStore(communityId, "forms"));
  const posts = useStore(sliceStore(communityId, "posts"));
  const requestList = useStore(sliceStore(communityId, "requests"));
  const instruments = useStore(sliceStore(communityId, "instruments"));
  const ledger = useStore(sliceStore(communityId, "ledger"));
  const payouts = useStore(sliceStore(communityId, "payouts"));
  const invoices = useStore(sliceStore(communityId, "invoices"));
  const vendors = useStore(sliceStore(communityId, "vendors"));
  const threads = useStore(sliceStore(communityId, "threads"));
  const documents = useStore(sliceStore(communityId, "documents"));
  const governingDocs = useStore(sliceStore(communityId, "governingDocs"));
  const violationList = useStore(sliceStore(communityId, "violations"));
  const reportList = useStore(sliceStore(communityId, "violationReports"));
  const associationRow = useStore(sliceStore(communityId, "association"));
  const meetingList = useStore(sliceStore(communityId, "meetings"));
  const reserveComponentList = useStore(sliceStore(communityId, "reserveComponents"));
  const sharedCosts = useStore(sliceStore(communityId, "sharedCosts"));
  const sharedCostBills = useStore(sliceStore(communityId, "sharedCostBills"));
  const ballots = useStore(sliceStore(communityId, "ballots"));
  const templates = useStore(sliceStore(communityId, "templates"));
  // Three slices that were mutable without being subscribed here, so a demo
  // write landed in storage and the screen kept showing the seed until reload.
  const announcementList = useStore(sliceStore(communityId, "announcements"));
  const actionItemList = useStore(sliceStore(communityId, "actionItems"));
  const joinRequestList = useStore(sliceStore(communityId, "joinRequests"));
  const demoActivity = useStore(demoActivityStore(communityId));

  const baseDeps: BaseDeps = {
    session,
    chosenHome,
    remote,
    communityId,
    community,
    settings,
    accountList,
    ownerList,
    bankAccountList,
    budgetLines,
    localDismissals,
    ownerChargeMap,
    amenities,
    forms,
    posts,
    requestList,
    instruments,
    ledger,
    payouts,
    invoices,
    vendors,
    threads,
    documents,
    governingDocs,
    violationList,
    reportList,
    associationRow,
    meetingList,
    reserveComponentList,
    sharedCosts,
    sharedCostBills,
    ballots,
    templates,
    announcementList,
    actionItemList,
    joinRequestList,
    demoActivity,
  };

  const {
    mySeats,
    account,
    chooseHome,
    signIn,
    signOut,
    setView,
    setCommunity,
    can,
    sees,
  } = useSessionActions(baseDeps);

  const deps: AppDeps = { ...baseDeps, mySeats, account, can };

  const {
    updateSettings,
    setAmenities,
    setForms,
    removeForm,
    removeAmenity,
    resetDemo,
    createRemoteAssociation,
    dismissedSetupTasks,
    dismissSetupTask,
    restoreSetupTask,
    createCommunity,
    updateAssociation,
    saveTemplate,
  } = useSettingsActions(deps);

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
    (ownerId: string, role: AccountRole) => {
      if (!remote.community) {
        const account = sliceStore(communityId, "accounts")
          .getSnapshot()
          .find((a) => a.ownerId === ownerId);
        if (account) setAccountRole(account.id, role);
        return;
      }
      const rc = remote.community;
      // The presidency needs a person, not a home; that is a handover.
      if (role === "president") {
        const holder = rc.accounts.find((a) => a.ownerId === ownerId);
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
          .eq("unit_id", ownerId)
          .is("ends_on", null)
          .neq("role", "president"),
      );
    },
    [remote.community, communityId, setAccountRole],
  );

  const {
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
  } = useMoneyActions(deps);

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
    }): { owner: Owner; saved: Promise<boolean> } => {
      const unit = input.unit.trim();
      const existing = remote.community
        ? remote.community.owners
        : sliceStore(communityId, "owners").getSnapshot();
      if (existing.some((o) => o.unit === unit)) {
        throw new ValidationError(`${placeLabel(unit)} is already on the roster`, { unit });
      }

      // The id is chosen here so the screen can name the household before
      // the write lands; the database takes it as given.
      const ownerId = remote.community ? newId() : `${communityId}-own-${unit}`;
      const owner: Owner = {
        id: ownerId,
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
            p_unit_id: ownerId,
            p_name: owner.displayName,
            p_email: owner.email,
            p_unit: unit,
          });
          // The kind of home rides on the unit the function just made.
          if (added.error || !input.homeType) return added;
          return supabaseBrowser()
            .from("units")
            .update({ home_type: input.homeType })
            .eq("id", ownerId);
        });
        return { owner, saved };
      }

      sliceStore(communityId, "owners").update((all) => [...all, owner]);
      sliceStore(communityId, "accounts").update((all) => [
        ...all,
        {
          id: `${communityId}-acct-${unit}`,
          ownerId,
          name: owner.displayName,
          email: owner.email,
          unit,
          role: "resident" as const,
          capabilities: NO_CAPABILITIES,
          views: NO_CAPABILITIES,
        },
      ]);
      return { owner, saved: Promise.resolve(true) };
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
      addOwnerSaving(input).owner,
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
    (ownerId: string, input: { name: string; email: string }) => {
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
            .eq("unit_id", ownerId)
            .is("profile_id", null)
            .is("ends_on", null),
        );
      }
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) =>
          o.id === ownerId
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
    (ownerId: string, input: { name: string; email: string }, second: boolean) => {
      const owners = sliceStore(communityId, "owners");
      const owner = owners.getSnapshot().find((o) => o.id === ownerId);
      if (!owner) return false;
      const name = input.name.trim();
      const email = input.email.trim();
      const accounts = sliceStore(communityId, "accounts");
      const onHome = accounts.getSnapshot().filter((a) => a.ownerId === ownerId);
      if (second || owner.placeholder) {
        // A second owner joins the names on title; the first owner of an
        // empty home replaces the stand in name.
        owners.update((all) =>
          all.map((o) =>
            o.id !== ownerId
              ? o
              : second
                ? { ...o, members: [...o.members, name] }
                : { ...o, displayName: name, members: [name], email, placeholder: false },
          ),
        );
        accounts.update((all) => [
          ...all,
          {
            id: `${communityId}-acct-${owner.unit}${second ? `-${onHome.length + 1}` : ""}`,
            ownerId,
            name,
            email,
            unit: owner.unit,
            role: "resident" as const,
            capabilities: NO_CAPABILITIES,
            views: NO_CAPABILITIES,
          },
        ]);
        return true;
      }
      // A home with a listed owner who has no email: the requester takes it.
      owners.update((all) =>
        all.map((o) => (o.id === ownerId ? { ...o, displayName: name, members: [name], email } : o)),
      );
      accounts.update((all) =>
        all.map((a) => (a.ownerId === ownerId ? { ...a, name, email } : a)),
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
    (ownerId: string, input: { name: string; email: string }) => {
      if (remote.community) {
        return remoteWrite("Adding the second owner", () =>
          supabaseBrowser().rpc("add_second_owner", {
            p_unit_id: ownerId,
            p_name: input.name.trim(),
            p_email: input.email.trim(),
          }),
        );
      }
      return Promise.resolve(seatInDemo(ownerId, input, true));
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
    (ownerId: string, seatId: string) => {
      if (remote.community) {
        return remoteWrite("Removing the owner", () =>
          supabaseBrowser().rpc("remove_owner", { p_membership_id: seatId }),
        );
      }
      const accounts = sliceStore(communityId, "accounts");
      const gone = accounts.getSnapshot().find((a) => a.id === seatId && a.ownerId === ownerId);
      const onHome = accounts.getSnapshot().filter((a) => a.ownerId === ownerId);
      if (!gone || onHome.length < 2) return Promise.resolve(false);
      accounts.update((all) => all.filter((a) => a.id !== seatId));
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => {
          if (o.id !== ownerId) return o;
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
    (ownerId: string, email: string) => {
      const next = email.trim();
      if (remote.community) {
        const current = remote.community.owners.find((o) => o.id === ownerId);
        return remoteWrite("Changing the email", () =>
          supabaseBrowser().rpc("change_owner_email", {
            p_unit_id: ownerId,
            p_old_email: current?.email ?? "",
            p_new_email: next,
          }),
        );
      }
      const was = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId)?.email;
      const home = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId);
      if (home && was !== next) {
        logDemoActivity(communityId, "seat", activityWords.email(home.unit, was ?? "no email", next), {
          unit_id: ownerId,
          home: home.unit,
        });
      }
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => (o.id === ownerId ? { ...o, email: next } : o)),
      );
      sliceStore(communityId, "accounts").update((all) =>
        all.map((a) => (a.ownerId === ownerId && a.email === was ? { ...a, email: next } : a)),
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
    (ownerIds: string[], homeType: HomeType) => {
      if (!ownerIds.length) return true;
      if (remote.community) {
        return remoteWrite("Saving the kind of home", () =>
          supabaseBrowser()
            .from("units")
            .update({ home_type: homeType }, { count: "exact" })
            .in("id", ownerIds),
        );
      }
      const ids = new Set(ownerIds);
      sliceStore(communityId, "owners").update((all) =>
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
    (changes: { ownerId: string; cents: number | null }[]) => {
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
          for (const { ownerId, cents } of changes) {
            const { error } = await supabase.rpc("set_home_dues", {
              p_unit_id: ownerId,
              p_dues_cents: cents,
            });
            if (error) throw new Error(error.message);
          }
        }, { timeoutMs: WRITE_TIMEOUT_MS + changes.length * 1_000 });
      }
      const byOwner = new Map(changes.map((c) => [c.ownerId, c.cents]));
      for (const o of sliceStore(communityId, "owners").getSnapshot()) {
        if (!byOwner.has(o.id)) continue;
        const next = byOwner.get(o.id) || null;
        if (next === (o.duesCents ?? null)) continue;
        logDemoActivity(communityId, "unit", activityWords.dues(o.unit, next), { unit_id: o.id, home: o.unit });
      }
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) => {
          if (!byOwner.has(o.id)) return o;
          const cents = byOwner.get(o.id);
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

  /**
   * A neighbour telling the board about another home.
   *
   * Lands as a report and never as a violation. The gap between those two is
   * the whole of this feature: what a resident submits is an input to an
   * investigation, and it becomes enforceable only once somebody from the
   * association has gone and looked.
   */
  const addViolationReport = useCallback(
    (input: {
      reporterId: string;
      reporterName: string;
      reporterUnit: string;
      subjectUnit: string;
      subjectOwnerId?: string;
      what: string;
      observedOn: string;
    }) => {
      const existing = remote.community
        ? remote.community.violationReports
        : sliceStore(communityId, "violationReports").getSnapshot();
      const sequence = existing.length + 1;
      const report: ViolationReport = {
        id: remote.community ? newId() : `rep-${communityId}-${sequence}-${input.subjectUnit}`,
        reference: `REP-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        reporterId: input.reporterId,
        reporterName: input.reporterName,
        reporterUnit: input.reporterUnit,
        subjectUnit: input.subjectUnit.trim(),
        subjectOwnerId: input.subjectOwnerId,
        what: input.what.trim(),
        observedOn: input.observedOn,
        submittedOn: todayIsoDate(),
        status: "new",
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Sending the report", () =>
          supabaseBrowser().from("violation_reports").insert({
            id: report.id,
            association_id: rc.id,
            reference: report.reference,
            reporter_profile_id: remote.profileId,
            reporter_name: report.reporterName,
            reporter_unit: report.reporterUnit,
            subject_unit: report.subjectUnit,
            subject_unit_id: isUuid(report.subjectOwnerId ?? "") ? report.subjectOwnerId : null,
            what: report.what,
            observed_on: report.observedOn,
            submitted_on: report.submittedOn,
            status: "new",
          }),
        );
        return report;
      }
      sliceStore(communityId, "violationReports").update((all) => [report, ...all]);
      return report;
    },
    [remote.community, remote.profileId, communityId],
  );

  /**
   * The board's own observation, written down.
   *
   * Not a status flip. The note is the thing a notice rests on, so a
   * verification without one is refused rather than recorded, which is the
   * difference between an investigation and a tick.
   */
  const verifyReport = useCallback(
    (reportId: string, by: string, note: string) => {
      if (!note.trim()) {
        throw new ValidationError("Write down what you saw before marking this verified", {
          reportId,
        });
      }
      if (remote.community) {
        void remoteWrite("Saving what you saw", () =>
          supabaseBrowser()
            .from("violation_reports")
            .update(
              {
                status: "verified",
                verified_by: by,
                verified_on: todayIsoDate(),
                verification_note: note.trim(),
              },
              { count: "exact" },
            )
            .eq("id", reportId),
        );
        return;
      }
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) =>
          r.id === reportId
            ? {
                ...r,
                status: "verified" as const,
                verification: { by, on: todayIsoDate(), note: note.trim() },
              }
            : r,
        ),
      );
    },
    [remote.community, communityId],
  );

  /** Closing a report the board looked at and found nothing in. */
  const dismissReport = useCallback(
    (reportId: string, reason: string) => {
      if (remote.community) {
        void remoteWrite("Closing the report", () =>
          supabaseBrowser()
            .from("violation_reports")
            .update({ status: "dismissed", dismissed_reason: reason.trim() }, { count: "exact" })
            .eq("id", reportId),
        );
        return;
      }
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) =>
          r.id === reportId
            ? { ...r, status: "dismissed" as const, dismissedReason: reason.trim() }
            : r,
        ),
      );
    },
    [remote.community, communityId],
  );

  /**
   * Raising a notice from a verified report.
   *
   * Refuses anything that has not been verified, in the state layer rather
   * than only in the screen, because the screen is the part somebody will
   * later copy. The notice carries the board's citation and the board's
   * photographs; nothing the reporter wrote becomes the allegation.
   */
  const raiseNoticeFromReport = useCallback(
    (
      reportId: string,
      input: { rule: string; ruleCitation: string; ownerId: string; ownerName: string },
    ) => {
      const reports = remote.community
        ? remote.community.violationReports
        : sliceStore(communityId, "violationReports").getSnapshot();
      const report = reports.find((r) => r.id === reportId);
      if (!report) throw new ValidationError("That report is not on file", { reportId });
      if (!canRaiseNotice(report)) {
        throw new ValidationError(
          "Someone has to look at the home and mark this report verified before a notice can be sent",
          { reportId },
        );
      }

      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `VIO-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName,
        unit: report.subjectUnit,
        rule: input.rule.trim(),
        ruleCitation: input.ruleCitation.trim(),
        stage: "courtesy",
        openedDate: todayIsoDate(),
        nextActionDate: addDays(todayIsoDate(), 14),
        // The board's own photographs go on afterwards. Nothing the reporter
        // supplied is carried across as if the association had taken it.
        photos: [],
        fineCents: 0,
        reportId,
      };

      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Raising the notice", async () => {
          const supabase = supabaseBrowser();
          // The report is claimed first, and only while no notice stands on
          // it. This is the write row level security can hide, and it used
          // to come second: the notice went in, the link matched nothing,
          // the board was told nothing had changed, and pressing again
          // raised a second notice on the same report. Refused here, nothing
          // has been written yet, so pressing again is safe.
          const claim = await supabase
            .from("violation_reports")
            .update({ violation_id: violation.id }, { count: "exact" })
            .eq("id", reportId)
            .is("violation_id", null);
          if (claim.error) throw new Error(claim.error.message);
          if (claim.count === 0) throw new Error(NOTHING_CHANGED);
          const { error } = await supabase.from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            fix: violation.fix ?? "",
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: reportId,
            source: "neighbor",
          });
          if (error) {
            // The notice did not go in, so the report is let go of and is
            // back in the queue to be raised again. Not counted: there is
            // nothing more to say if this misses too.
            await supabase
              .from("violation_reports")
              .update({ violation_id: null })
              .eq("id", reportId)
              .eq("violation_id", violation.id);
            throw new Error(error.message);
          }
        });
        return violation;
      }

      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      sliceStore(communityId, "violationReports").update((all) =>
        all.map((r) => (r.id === reportId ? { ...r, violationId: violation.id } : r)),
      );
      return violation;
    },
    [remote.community, communityId],
  );

  const addNotice = useCallback(
    (input: {
      ownerId: string;
      ownerName: string;
      unit: string;
      rule: string;
      fix?: string;
      ruleCitation?: string;
    }) => {
      if (!input.rule.trim() || !input.unit.trim()) {
        throw new ValidationError("Choose a home and name the rule", {});
      }
      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `VIO-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId,
        ownerName: input.ownerName.trim(),
        unit: input.unit.trim(),
        rule: input.rule.trim(),
        fix: (input.fix ?? "").trim() || undefined,
        ruleCitation: (input.ruleCitation ?? "").trim(),
        stage: "courtesy",
        openedDate: todayIsoDate(),
        nextActionDate: addDays(todayIsoDate(), 14),
        photos: [],
        fineCents: 0,
        source: "board",
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Sending the notice", () =>
          supabaseBrowser().from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            // The words the owner reads under the title (0097). Left out of
            // this insert, they reached the list row in the session that typed
            // them and nobody else.
            fix: violation.fix ?? "",
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: null,
            source: "board",
          }),
        );
        return violation;
      }
      logDemoActivity(communityId, "violation", activityWords.notice(violation.unit, violation.rule), {
        unit_id: violation.ownerId,
        home: violation.unit,
        reference: violation.reference,
      });
      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      return violation;
    },
    [remote.community, communityId],
  );

  const closeBallot = useCallback(
    (ballotId: string) => {
      if (remote.community) {
        void remoteWrite("Closing the ballot", () =>
          supabaseBrowser()
            .from("ballots")
            .update({ status: "closed" }, { count: "exact" })
            .eq("id", ballotId),
        );
        return;
      }
      sliceStore(communityId, "ballots").update((all) =>
        all.map((b) => (b.id === ballotId ? { ...b, status: "closed" as const } : b)),
      );
    },
    [remote.community, communityId],
  );

  const setViolationStage = useCallback(
    (violationId: string, stage: Violation["stage"]) => {
      const today = todayIsoDate();
      const nextActionDate = stage === "cured" ? today : addDays(today, 14);
      const patch: Partial<Violation> =
        stage === "cured"
          ? { stage, nextActionDate, resolvedDate: today }
          : { stage, nextActionDate };
      if (remote.community) {
        void remoteWrite(stage === "cured" ? "Resolving the notice" : "Updating the notice", () =>
          supabaseBrowser()
            .from("violations")
            .update(
              {
                stage,
                next_action_on: nextActionDate,
                resolved_on: stage === "cured" ? today : null,
              },
              { count: "exact" },
            )
            .eq("id", violationId),
        );
        return;
      }
      sliceStore(communityId, "violations").update((all) =>
        all.map((v) => (v.id === violationId ? { ...v, ...patch } : v)),
      );
    },
    [remote.community, communityId],
  );

  const addCityNotice = useCallback(
    (input: {
      agency: string;
      caseNumber: string;
      deadline: string;
      rule: string;
      ownerId?: string;
      ownerName?: string;
      unit?: string;
    }) => {
      const agency = input.agency.trim();
      const caseNumber = input.caseNumber.trim();
      if (!agency || !input.rule.trim() || !input.deadline) {
        throw new ValidationError("A city notice needs the agency, what it says, and the deadline", {});
      }
      const existing = remote.community
        ? remote.community.violations
        : sliceStore(communityId, "violations").getSnapshot();
      const sequence = existing.length + 1;
      const violation: Violation = {
        id: remote.community ? newId() : `vio-${communityId}-${sequence}`,
        reference: `CITY-${todayIsoDate().slice(0, 4)}-${String(100 + sequence)}`,
        ownerId: input.ownerId ?? "",
        // Against the association itself unless a home is named.
        ownerName: input.ownerName?.trim() || "The association",
        unit: input.unit?.trim() || "Common area",
        rule: input.rule.trim(),
        // The agency and case number ride the citation too, so they survive a
        // database that has no column for them yet.
        ruleCitation: caseNumber ? `${agency}, case ${caseNumber}` : agency,
        stage: "first-notice",
        openedDate: todayIsoDate(),
        nextActionDate: input.deadline,
        photos: [],
        fineCents: 0,
        source: "city",
        agency,
        caseNumber: caseNumber || undefined,
      };
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Logging the notice", () =>
          supabaseBrowser().from("violations").insert({
            id: violation.id,
            association_id: rc.id,
            reference: violation.reference,
            unit_id: isUuid(violation.ownerId) ? violation.ownerId : null,
            unit_label: violation.unit,
            owner_name: violation.ownerName,
            rule: violation.rule,
            rule_citation: violation.ruleCitation,
            stage: violation.stage,
            opened_on: violation.openedDate,
            next_action_on: violation.nextActionDate,
            photos: [],
            fine_cents: 0,
            report_id: null,
            source: "city",
            agency,
            case_number: caseNumber,
          }),
        );
        return violation;
      }
      sliceStore(communityId, "violations").update((all) => [violation, ...all]);
      return violation;
    },
    [remote.community, communityId],
  );

  /** Removes a household and its account together, returning one undo for both. */
  const removeOwner = useCallback(
    (ownerId: string) => {
      if (!remote.community) {
        const undoOwners = destructive(sliceStore(communityId, "owners"), (all) =>
          all.filter((o) => o.id !== ownerId),
        );
        const undoAccounts = destructive(sliceStore(communityId, "accounts"), (all) =>
          all.filter((a) => a.ownerId !== ownerId),
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
      const owner = rc.owners.find((o) => o.id === ownerId);
      const hasStatement = (rc.ownerCharges[ownerId] ?? []).length > 0;
      void remoteWrite(hasStatement ? "Retiring the home" : "Removing the household", () =>
        hasStatement
          ? supabaseBrowser().rpc("retire_home", { p_unit_id: ownerId })
          : supabaseBrowser().rpc("remove_household", { p_unit_id: ownerId }),
      );
      return () => {
        if (!owner || hasStatement) return;
        void remoteWrite("Restoring the household", () =>
          supabaseBrowser().rpc("add_household", {
            p_association_id: rc.id,
            p_unit_id: owner.id,
            p_name: owner.displayName,
            p_email: owner.email,
            p_unit: owner.unit,
          }),
        );
      };
    },
    [remote.community, communityId],
  );

  const transferHome = useCallback(
    (
      ownerId: string,
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
          const owner = now.owners.find((o) => o.id === ownerId);
          const owed = owner?.balanceCents ?? 0;
          const settle = input.settleBalance && owed > 0;
          const recordSale = () =>
            supabase.rpc("transfer_home", {
              p_unit_id: ownerId,
              p_new_name: name,
              p_new_email: email,
              p_closing_date: input.closingDate,
            });
          // Paid out of escrow at closing: a payment line, so the statement
          // shows where the balance went rather than a number vanishing.
          const recordPayment = () =>
            supabase.from("charges").insert({
              association_id: rc.id,
              unit_id: ownerId,
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
              description: `Paid at closing, ${placeLabel(owner?.unit ?? "")}`.trim(),
              counterparty: owner?.displayName ?? "Title company",
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
          const seats = now.accounts.filter((a) => a.ownerId === ownerId);
          const ownHome =
            seats.some((a) => a.id === remote.profileId) &&
            !seats.some((a) => a.role === "president");
          if (settle && ownHome) {
            // The one refusal that can be seen coming, checked before any
            // money is written.
            if (owner && input.closingDate < owner.moveInDate) {
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

      const owners = sliceStore(communityId, "owners");
      const before = owners.getSnapshot().find((o) => o.id === ownerId);
      if (!before) return false;
      const settle = input.settleBalance && before.balanceCents > 0;
      owners.update((all) =>
        all.map((o) =>
          o.id === ownerId
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
        sliceStore(communityId, "ownerCharges").update((all) => ({
          ...all,
          [ownerId]: [
            {
              id: `${ownerId}-closing-${input.closingDate}`,
              date: input.closingDate,
              label: "Paid at closing",
              kind: "payment" as const,
              amountCents: -before.balanceCents,
              balanceAfterCents: 0,
            },
            ...(all[ownerId] ?? []),
          ],
        }));
      }
      // The seller's sign-in goes with them; the buyer gets a resident seat.
      sliceStore(communityId, "accounts").update((all) => [
        ...all.filter((a) => a.ownerId !== ownerId),
        {
          id: `${communityId}-acct-${before.unit}-${input.closingDate}`,
          ownerId,
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

  const addPost = useCallback(
    (post: ForumPost) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Posting", () =>
          supabaseBrowser().from("posts").insert({
            id: newId(),
            association_id: rc.id,
            author_id: remote.profileId,
            author_name: post.author,
            unit_label: post.unit,
            author_role: post.authorRole ?? null,
            category: post.category,
            title: post.title,
            body: post.body,
            status: post.status,
          }),
        );
        return;
      }
      sliceStore(communityId, "posts").update((all) => [post, ...all]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const addAnnouncement = useCallback(
    (
      a: { title: string; body: string; category: Announcement["category"]; pinned?: boolean },
      email: "announcement" | "none" = "announcement",
    ) => {
      // Author is the seat that pressed the button, in the form the fixtures
      // established: "Arya Mehr, Board President".
      const roleLabel: Record<string, string> = {
        president: "Board President",
        "vice-president": "Vice President",
        treasurer: "Treasurer",
        secretary: "Secretary",
      };
      if (remote.community) {
        const rc = remote.community;
        const me = rc.accounts.find((x) => x.id === remote.profileId);
        const author = me
          ? `${me.name}${roleLabel[me.role] ? `, ${roleLabel[me.role]}` : ""}`
          : "The board";
        const id = newId();
        void remoteWrite("Posting the announcement", () =>
          supabaseBrowser().from("announcements").insert({
            id,
            association_id: rc.id,
            author_name: author,
            category: a.category,
            title: a.title,
            body: a.body,
            pinned: a.pinned ?? false,
          }),
        ).then((ok) => {
          if (ok && email === "announcement") void emailNotice(rc.id, { kind: "announcement", id });
        });
        return;
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((x) => x.id === sessionStore.getSnapshot().accountId);
      const author = me
        ? `${me.name}${roleLabel[me.role] ? `, ${roleLabel[me.role]}` : ""}`
        : "The board";
      logDemoActivity(communityId, "announcement", activityWords.posted(a.title), { category: a.category });
      sliceStore(communityId, "announcements").update((all) => [
        {
          id: newId(),
          title: a.title,
          body: a.body,
          category: a.category,
          pinned: a.pinned,
          author,
          postedDate: todayIsoDate(),
        },
        ...all,
      ]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const sendMeetingNotice = useCallback(
    (meetingId: string) => {
      const meetings = remote.community ? remote.community.meetings : meetingList;
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return false;
      const when = `${formatDate(m.date, "long")} at ${m.time}`;
      const title = `Notice of meeting: ${m.title}, ${when}`;
      // One run at a time for a meeting. The date that takes the button away
      // is written only once the email has reported back, which for a long
      // roster is most of a minute, and a second press in that time would
      // post the notice and mail everybody again.
      if (remote.community && noticesInFlight.has(meetingId)) return false;
      // Posted once. A send that failed is pressed again, and the notice
      // from the first press is already on every home screen.
      const posted =
        remote.community &&
        latest(remote.community).announcements.some((a) => a.title === title);
      if (!posted) {
        addAnnouncement({
          title,
          body: [
            `${m.title} is on ${when}, ${m.location}.`,
            joinLine(m, (remote.community?.association ?? associationRow).id),
            m.agenda.length ? `Agenda: ${m.agenda.join("; ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          category: "Governance",
        }, "none");
      }
      const today = todayIsoDate();
      if (remote.community) {
        const rc = remote.community;
        // Statutory notice, so it goes by email under its own category
        // rather than as an announcement an owner may have turned off.
        //
        // The date is the record that notice was given, so it is written
        // after the send reports back. It used to be written first, and a
        // send the server then refused left a meeting marked as noticed
        // with nothing to press again.
        //
        // It is written whatever the send reported, because the notice is
        // posted on every home screen by then and the emails that fell
        // short have been counted out in a toast. Written only when some
        // email went, a board whose mail could not go at all (a sending
        // domain not yet verified) kept the button for good, and so did a
        // second press that found everybody already had it.
        //
        // Only a send that never got there leaves the date unwritten and
        // the button on, so pressing it again can carry on. A refusal is an
        // answer: the notice is posted in the app either way (decided
        // 2026-10-04), and the toast says the email did not go.
        noticesInFlight.add(meetingId);
        return emailNotice(rc.id, { kind: "meeting", id: meetingId }, true)
          .then(async (outcome) => {
            // The route answering at all is what dates the notice; only a
            // send that never got there leaves the button for another try.
            if (outcome.answered) {
              const recorded = await remoteWrite("Recording the notice", () =>
                supabaseBrowser()
                  .from("meetings")
                  .update({ notice_sent_on: today }, { count: "exact" })
                  .eq("id", meetingId),
              );
              if (!recorded) return false;
            }
            return noticeToast(outcome);
          })
          .finally(() => noticesInFlight.delete(meetingId));
      }
      logDemoActivity(communityId, "meeting", activityWords.meetingNotice(m.title), { notice_sent_on: today });
      sliceStore(communityId, "meetings").update((all) =>
        all.map((x) => (x.id === meetingId ? { ...x, noticeSentDate: today } : x)),
      );
      // The demo has nobody to email, so the notice is only posted.
      return "Notice posted.";
    },
    [remote.community, meetingList, associationRow, addAnnouncement, communityId],
  );

  const removeAnnouncement = useCallback(
    (id: string) => {
      if (remote.community) {
        void remoteWrite("Removing the announcement", () =>
          supabaseBrowser().from("announcements").delete({ count: "exact" }).eq("id", id),
        );
        return;
      }
      sliceStore(communityId, "announcements").update((all) =>
        all.filter((a) => a.id !== id),
      );
    },
    [remote.community, communityId],
  );

  const moderatePost = useCallback(
    (postId: string, decision: "published" | "rejected", reason?: string) => {
      if (remote.community) {
        const rc = remote.community;
        const post = rc.posts.find((p) => p.id === postId);
        const moderator = rc.accounts.find((a) => a.id === remote.profileId);
        void remoteWrite("Saving the decision", () =>
          supabaseBrowser()
            .from("posts")
            .update(
              {
                status: decision,
                moderated_by: moderator?.name ?? null,
                moderated_at: new Date().toISOString(),
                rejection_reason: decision === "rejected" ? (reason ?? null) : null,
              },
              { count: "exact" },
            )
            .eq("id", postId),
        );
        return () => {
          if (!post) return;
          void remoteWrite("Undoing the decision", () =>
            supabaseBrowser()
              .from("posts")
              .update(
                {
                  status: post.status,
                  moderated_by: post.moderatedBy ?? null,
                  rejection_reason: post.rejectionReason ?? null,
                },
                { count: "exact" },
              )
              .eq("id", postId),
          );
        };
      }
      const moderator = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      return destructive(sliceStore(communityId, "posts"), (all) =>
        all.map((post) =>
          post.id === postId
            ? {
                ...post,
                status: decision,
                moderatedBy: moderator?.name,
                moderatedAt: todayIsoDate(),
                rejectionReason: decision === "rejected" ? reason : undefined,
              }
            : post,
        ),
      );
    },
    [remote.community, remote.profileId, communityId],
  );

  const togglePinned = useCallback(
    (postId: string) => {
      if (remote.community) {
        const post = remote.community.posts.find((p) => p.id === postId);
        void remoteWrite("Pinning", () =>
          supabaseBrowser()
            .from("posts")
            .update({ pinned: !post?.pinned }, { count: "exact" })
            .eq("id", postId),
        );
        return;
      }
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post)),
      );
    },
    [remote.community, communityId],
  );

  const removePost = useCallback(
    (postId: string) => {
      if (remote.community) {
        // Removed means rejected, which hides it from every neighbour and
        // keeps the record, and is the only version of removal that can be
        // undone: the insert policy would not let a moderator put back a post
        // that somebody else wrote.
        const post = remote.community.posts.find((p) => p.id === postId);
        void remoteWrite("Removing the post", () =>
          supabaseBrowser()
            .from("posts")
            .update({ status: "rejected" }, { count: "exact" })
            .eq("id", postId),
        );
        return () => {
          if (!post) return;
          void remoteWrite("Restoring the post", () =>
            supabaseBrowser()
              .from("posts")
              .update({ status: post.status }, { count: "exact" })
              .eq("id", postId),
          );
        };
      }
      return destructive(sliceStore(communityId, "posts"), (all) =>
        all.filter((p) => p.id !== postId),
      );
    },
    [remote.community, communityId],
  );

  const likePost = useCallback(
    (postId: string) => {
      if (remote.community) {
        void remoteWrite("Liking", () => supabaseBrowser().rpc("like_post", { p_post_id: postId }));
        return;
      }
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)),
      );
    },
    [remote.community, communityId],
  );

  const replyToPost = useCallback(
    (postId: string, body: string) => {
      const text = body.trim();
      if (!text) return false;
      if (remote.community) {
        const rc = remote.community;
        const me = rc.accounts.find((a) => a.id === remote.profileId);
        const home = me ? rc.owners.find((o) => o.id === me.ownerId) : undefined;
        const roleLabel: Record<string, string> = {
          president: "Board President",
          "vice-president": "Vice President",
          treasurer: "Treasurer",
          secretary: "Secretary",
        };
        void remoteWrite("Replying", () =>
          supabaseBrowser().from("post_replies").insert({
            association_id: rc.id,
            post_id: postId,
            author_id: remote.profileId,
            author_name: me?.name ?? "Neighbor",
            author_role: me ? (roleLabel[me.role] ?? null) : null,
            unit_label: home?.unit ?? "",
            body: text,
          }),
        );
        return true;
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const owner = me
        ? sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === me.ownerId)
        : undefined;
      const roleLabel: Record<string, string> = {
        president: "Board President",
        "vice-president": "Vice President",
        treasurer: "Treasurer",
        secretary: "Secretary",
      };
      const reply: ForumReply = {
        id: `fr-${postId}-${Date.now().toString(36)}`,
        author: me?.name ?? "Neighbor",
        unit: owner?.unit ?? "",
        authorRole: me ? roleLabel[me.role] : undefined,
        at: todayIsoDate(),
        body: text,
      };
      sliceStore(communityId, "posts").update((all) =>
        all.map((post) =>
          post.id === postId ? { ...post, replies: [...post.replies, reply] } : post,
        ),
      );
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
      sliceStore(communityId, "owners").update((all) =>
        all.map((o) =>
          o.id === me.ownerId
            ? { ...o, phone: input.phone, mailingAddress: input.mailingAddress || undefined }
            : o,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );


  const markViolationFixed = useCallback(
    (violationId: string, note: string) => {
      const today = todayIsoDate();
      if (remote.community) {
        return remoteWrite("Telling the board", () =>
          supabaseBrowser().rpc("mark_violation_fixed", {
            p_violation_id: violationId,
            p_note: note,
          }),
        );
      }
      sliceStore(communityId, "violations").update((all) =>
        all.map((v) =>
          v.id === violationId && v.stage !== "cured"
            ? { ...v, ownerFixedDate: today, ownerFixedNote: note.trim() || undefined }
            : v,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /* ------------------------------------------------------------ work orders */

  const setWorkOrder = useCallback(
    (requestId: string, workOrder: WorkOrder | null) => {
      const existing = remote.community
        ? remote.community.requests
        : sliceStore(communityId, "requests").getSnapshot();
      const request = existing.find((r) => r.id === requestId);
      if (!request) return;
      // The owner reads the same thread the board does, so what changed on
      // the order is said there in words rather than left for them to diff.
      const previous = request.workOrder;
      let body: string | null = null;
      if (!workOrder) body = "The work order was taken off this request.";
      else if (!previous) body = `Work order opened${workOrder.vendorName ? ` with ${workOrder.vendorName}` : ""}.`;
      else if (workOrder.completedOn && !previous.completedOn) body = "The work is done.";
      else if (workOrder.scheduledOn && workOrder.scheduledOn !== previous.scheduledOn)
        body = `Scheduled for ${formatDate(workOrder.scheduledOn, "medium")}${workOrder.vendorName ? ` with ${workOrder.vendorName}` : ""}.`;
      const actorName = remote.community
        ? (remote.community.accounts.find((a) => a.id === remote.profileId)?.name ?? "Board")
        : (sliceStore(communityId, "accounts")
            .getSnapshot()
            .find((a) => a.id === sessionStore.getSnapshot().accountId)?.name ?? "Board");
      const thread = body
        ? [
            ...request.thread,
            {
              id: `rt-${request.id}-${request.thread.length}`,
              at: todayIsoDate(),
              actor: actorName,
              actorRole: "board" as const,
              body,
              kind: "status" as const,
            },
          ]
        : request.thread;
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Saving the work order", () => {
          // The note goes onto the thread as the last write left it, so a
          // decision saved a moment ago is not written over by this one.
          const now = latest(rc).requests.find((r) => r.id === requestId)?.thread ?? request.thread;
          const event = body ? thread[thread.length - 1] : undefined;
          return supabaseBrowser()
            .from("requests")
            .update(
              {
                work_order: (workOrder as unknown as Json) ?? null,
                thread: event ? [...now, { ...event, id: `rt-${request.id}-${now.length}` }] : now,
              },
              { count: "exact" },
            )
            .eq("id", requestId);
        });
        return;
      }
      sliceStore(communityId, "requests").update((all) =>
        all.map((r) =>
          r.id === requestId ? { ...r, workOrder: workOrder ?? undefined, thread } : r,
        ),
      );
    },
    [remote.community, remote.profileId, communityId],
  );

  /* ------------------------------------------------------------------ rsvps */

  const rsvpMeeting = useCallback(
    (meetingId: string, response: "yes" | "no") => {
      if (remote.community) {
        return remoteWrite("Saving your answer", () =>
          supabaseBrowser().rpc("rsvp_meeting", { p_meeting_id: meetingId, p_response: response }),
        );
      }
      const me = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      if (!me) return Promise.resolve(false);
      sliceStore(communityId, "meetings").update((all) =>
        all.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                rsvps: [
                  ...(m.rsvps ?? []).filter((r) => r.profileId !== me.id),
                  { profileId: me.id, name: me.name, unit: me.unit, response, at: todayIsoDate() },
                ],
              }
            : m,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, communityId],
  );

  /* ----------------------------------------------------------- action items */

  const addActionItem = useCallback(
    (input: { title: string; ownerName: string; dueOn?: string; meetingId?: string }) => {
      const title = input.title.trim();
      if (!title) throw new ValidationError("Describe the action item", { title });
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the item", () =>
          supabaseBrowser().from("action_items").insert({
            association_id: rc.id,
            title,
            owner_name: input.ownerName.trim(),
            due_on: input.dueOn || null,
            meeting_id: input.meetingId && isUuid(input.meetingId) ? input.meetingId : null,
            created_by: remote.profileId,
          }),
        );
        return;
      }
      const item: ActionItem = {
        id: `act-${Date.now()}`,
        title,
        ownerName: input.ownerName.trim(),
        dueOn: input.dueOn || undefined,
        meetingId: input.meetingId,
        createdOn: todayIsoDate(),
      };
      sliceStore(communityId, "actionItems").update((all) => [...all, item]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const setActionItemDone = useCallback(
    (itemId: string, done: boolean) => {
      const doneOn = done ? todayIsoDate() : undefined;
      if (remote.community) {
        void remoteWrite(done ? "Ticking it off" : "Reopening it", () =>
          supabaseBrowser()
            .from("action_items")
            .update({ done_on: doneOn ?? null }, { count: "exact" })
            .eq("id", itemId),
        );
        return;
      }
      sliceStore(communityId, "actionItems").update((all) =>
        all.map((i) => (i.id === itemId ? { ...i, doneOn } : i)),
      );
    },
    [remote.community, communityId],
  );

  const removeActionItem = useCallback(
    (itemId: string) => {
      if (remote.community) {
        void remoteWrite("Removing the item", () =>
          supabaseBrowser().from("action_items").delete({ count: "exact" }).eq("id", itemId),
        );
        return;
      }
      sliceStore(communityId, "actionItems").update((all) => all.filter((i) => i.id !== itemId));
    },
    [remote.community, communityId],
  );

  /* -------------------------------------------------------- request to join */

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
      const { owner, saved } = addOwnerSaving({ name: request.name, email: request.email, unit });
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
            unitIds: [owner.id],
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
    async (requestId: string, ownerId: string, second: boolean) => {
      const existing = remote.community
        ? remote.community.joinRequests
        : sliceStore(communityId, "joinRequests").getSnapshot();
      const request = existing.find((j) => j.id === requestId);
      if (!request) return false;
      if (remote.community) {
        const seated = await remoteWrite("Letting them in", () =>
          supabaseBrowser().rpc("seat_join_request", {
            p_request_id: requestId,
            p_unit_id: ownerId,
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
              unitIds: [ownerId],
              kind: "welcome",
            }),
          }).catch(() => undefined); // The roster is right already; the server logs a failed email.
        }
        return decided;
      }
      if (!seatInDemo(ownerId, { name: request.name, email: request.email }, second)) return false;
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

  /* -------------------------------------------------------------- requests */

  const addRequest = useCallback(
    (request: HomeRequest) => {
      if (remote.community) {
        const rc = remote.community;
        // The number comes back from the row. The form numbers a request
        // from the ones its owner can see, and the database gives a number
        // already taken the next free one, so what was sent is a guess. The
        // filer may read their own row back (requests_read), which is what
        // lets the insert return it. Resolves null when nothing was saved,
        // so the form stays put instead of saying "Request submitted".
        let stored = "";
        return remoteWrite("Sending the request", async () => {
          const { data, error } = await supabaseBrowser().from("requests").insert({
            id: newId(),
            association_id: rc.id,
            unit_id: request.ownerId,
            filed_by: remote.profileId,
            reference: request.reference,
            kind: request.kind,
            title: request.title,
            body: request.summary,
            status: request.status === "draft" ? "submitted" : request.status,
            submitted_on: request.submittedDate,
            due_on: request.dueDate ?? null,
            due_reason: request.dueReason ?? null,
            attachments: request.attachments,
            thread: request.thread,
            submission: request.submission ?? null,
            certificate_id: request.certificateId ?? null,
          }).select("reference").single();
          if (error) throw new Error(error.message);
          stored = data?.reference ?? "";
        }).then((ok) => (ok ? stored : null));
      }
      sliceStore(communityId, "requests").update((all) => [request, ...all]);
    },
    [remote.community, remote.profileId, communityId],
  );

  const updateRequestStatus = useCallback(
    (requestId: string, status: HomeRequest["status"], note?: string): Promise<boolean> => {
      const decided = ["approved", "denied"].includes(status);
      const event = (request: HomeRequest, actorName: string) => ({
        id: `rt-${request.id}-${request.thread.length}`,
        at: todayIsoDate(),
        actor: actorName,
        actorRole: "board" as const,
        body: note ?? `Status changed to ${statusLabel[status].toLowerCase()}.`,
        kind: "status" as const,
      });
      if (remote.community) {
        const rc = remote.community;
        const request = rc.requests.find((r) => r.id === requestId);
        if (!request) return Promise.resolve(false);
        const actor = rc.accounts.find((a) => a.id === remote.profileId);
        return remoteWrite("Saving the decision", () => {
          // The request as the last write left it, so the note lands after
          // whatever was just added to the thread instead of replacing it.
          const now = latest(rc).requests.find((r) => r.id === requestId) ?? request;
          return supabaseBrowser()
            .from("requests")
            .update(
              {
                status,
                decided_on: decided ? todayIsoDate() : (now.decisionDate ?? null),
                decided_by: decided ? (actor?.name ?? null) : (now.decidedBy ?? null),
                decided_note: note ?? null,
                thread: [...now.thread, event(now, actor?.name ?? "Board")],
              },
              { count: "exact" },
            )
            .eq("id", requestId);
        }).then((ok) => {
          if (ok) void emailNotice(rc.id, { kind: "request", id: requestId, body: note });
          return ok;
        });
      }
      const actor = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      sliceStore(communityId, "requests").update((all) =>
        all.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                decisionDate: decided ? todayIsoDate() : request.decisionDate,
                decidedBy: decided ? actor?.name : request.decidedBy,
                thread: [...request.thread, event(request, actor?.name ?? "Board")],
              }
            : request,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, remote.profileId, communityId],
  );

  const replyToRequest = useCallback(
    (requestId: string, body: string): Promise<ReplyEmail | false> => {
      const text = body.trim();
      if (!text) return Promise.resolve(false);
      const event = (request: HomeRequest, actorName: string) => ({
        id: `rt-${request.id}-${request.thread.length}`,
        at: todayIsoDate(),
        actor: actorName,
        actorRole: "board" as const,
        body: text,
        kind: "note" as const,
      });
      if (remote.community) {
        const rc = remote.community;
        const request = rc.requests.find((r) => r.id === requestId);
        if (!request) return Promise.resolve(false);
        const actor = rc.accounts.find((a) => a.id === remote.profileId);
        return remoteWrite("Sending the reply", () => {
          // Built from the thread as the write before this one left it, not
          // the copy this press started from: two quick replies are both kept.
          const now = latest(rc).requests.find((r) => r.id === requestId) ?? request;
          return supabaseBrowser()
            .from("requests")
            .update(
              {
                thread: [...now.thread, event(now, actor?.name ?? "Board")],
                // A reply to a decision request is the start of the review.
                status: statusAfterReply(now),
              },
              { count: "exact" },
            )
            .eq("id", requestId);
        }).then(async (ok) => {
          if (!ok) return false;
          // Told only once the reply is on the record. The same email kind
          // as a decision: it says the request was updated and carries the words.
          // The board hears how it went, so the generic toasts stay quiet.
          return replyEmailState(await emailNotice(rc.id, { kind: "request", id: requestId, body: text }, true));
        });
      }
      const actor = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      // The demo has no database to wait on; the store's latest copy is read
      // inside the update, so two quick replies are both kept here too.
      sliceStore(communityId, "requests").update((all) =>
        all.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status: statusAfterReply(request),
                thread: [...request.thread, event(request, actor?.name ?? "Board")],
              }
            : request,
        ),
      );
      return Promise.resolve("none");
    },
    [remote.community, remote.profileId, communityId],
  );

  const markW9Requested = useCallback(
    (vendorId: string) => {
      if (remote.community) {
        void remoteWrite("Noting the W-9", () =>
          supabaseBrowser()
            .from("vendors")
            .update({ w9_on_file: true }, { count: "exact" })
            .eq("id", vendorId),
        );
        return;
      }
      sliceStore(communityId, "vendors").update((all) =>
        all.map((vendor) => (vendor.id === vendorId ? { ...vendor, w9OnFile: true } : vendor)),
      );
    },
    [remote.community, communityId],
  );

  const addVendor = useCallback(
    (vendor: Community["vendors"][number]) => {
      // The same rule the form shows, held here too: a second call cannot
      // add "cascade grounds co." beside "Cascade Grounds Co.".
      const known = remote.community ? remote.community.vendors : sliceStore(communityId, "vendors").getSnapshot();
      if (vendorNameProblem(vendor.name, known)) return;
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the vendor", () =>
          supabaseBrowser().from("vendors").insert({
            id: newId(),
            association_id: rc.id,
            name: vendor.name,
            service: vendor.service,
            ach_enabled: vendor.achEnabled,
            w9_on_file: vendor.w9OnFile,
            coi_expires_on: vendor.coiExpires ?? null,
            default_category: vendor.defaultCategory,
          }),
        );
        return;
      }
      logDemoActivity(communityId, "vendor", activityWords.vendor(vendor.name), { service: vendor.service });
      sliceStore(communityId, "vendors").update((all) => [vendor, ...all]);
    },
    [remote.community, communityId],
  );

  const removeVendor = useCallback(
    (vendorId: string) => {
      if (remote.community) {
        const rc = remote.community;
        const vendor = rc.vendors.find((v) => v.id === vendorId);
        void remoteWrite("Removing the vendor", () =>
          supabaseBrowser().from("vendors").delete({ count: "exact" }).eq("id", vendorId),
        );
        return () => {
          if (!vendor) return;
          void remoteWrite("Restoring the vendor", () =>
            supabaseBrowser().from("vendors").insert({
              id: vendor.id,
              association_id: rc.id,
              name: vendor.name,
              service: vendor.service,
              ach_enabled: vendor.achEnabled,
              w9_on_file: vendor.w9OnFile,
              coi_expires_on: vendor.coiExpires ?? null,
              default_category: vendor.defaultCategory,
            }),
          );
        };
      }
      return destructive(sliceStore(communityId, "vendors"), (all) =>
        all.filter((v) => v.id !== vendorId),
      );
    },
    [remote.community, communityId],
  );

  const messageBoard = useCallback(
    async (
      ownerId: string,
      subject: string,
      body: string,
      tag: MessageThread["tag"] = "General",
      toRole: ThreadAddress = "board",
    ) => {
      if (!subject.trim() || !body.trim()) {
        throw new ValidationError("Add a subject and a message", {});
      }
      if (remote.community) {
        let threadId: string | null = null;
        const ok = await remoteWrite("Sending your message", async () => {
          const result = await supabaseBrowser().rpc("start_owner_thread", {
            p_unit_id: ownerId,
            p_subject: subject.trim(),
            p_body: body.trim(),
            p_tag: tag,
            p_to_role: toRole,
          });
          threadId = typeof result.data === "string" ? result.data : null;
          return result;
        });
        // The officer who holds the office is told. The message is already
        // saved and the board reads it in Messages either way, so a failure
        // here is the board's to see in the email log, not the owner's.
        if (ok && threadId) {
          void fetch("/api/email/office-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ threadId }),
          }).catch(() => undefined);
        }
        return ok;
      }
      const owner = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId);
      const from = owner?.members[0] ?? owner?.displayName ?? "Owner";
      sliceStore(communityId, "threads").update((all) => [
        {
          id: `t-${newId()}`,
          subject: subject.trim(),
          participants: [from],
          ownerId,
          unit: owner?.unit,
          updatedDate: todayIsoDate(),
          unread: true,
          tag,
          toRole,
          messages: [
            {
              id: `m-${newId()}`,
              at: todayIsoDate(),
              from,
              fromRole: "resident",
              direction: "inbound",
              channel: "portal",
              body: body.trim(),
            },
          ],
        },
        ...all,
      ]);
      return true;
    },
    [remote.community, communityId],
  );

  const replyAsOwner = useCallback(
    async (threadId: string, ownerId: string, body: string) => {
      if (!body.trim()) return false;
      if (remote.community) {
        return remoteWrite("Sending your reply", () =>
          supabaseBrowser().rpc("reply_as_owner", { p_thread_id: threadId, p_body: body.trim() }),
        );
      }
      const owner = sliceStore(communityId, "owners").getSnapshot().find((o) => o.id === ownerId);
      sliceStore(communityId, "threads").update((all) =>
        all.map((t) =>
          t.id === threadId
            ? {
                ...t,
                unread: true,
                updatedDate: todayIsoDate(),
                messages: [
                  ...t.messages,
                  {
                    id: `m-${newId()}`,
                    at: todayIsoDate(),
                    from: owner?.members[0] ?? owner?.displayName ?? "Owner",
                    fromRole: "resident",
                    direction: "inbound",
                    channel: "portal",
                    body: body.trim(),
                  },
                ],
              }
            : t,
        ),
      );
      return true;
    },
    [remote.community, communityId],
  );

  const replyToThread = useCallback(
    (threadId: string, body: string): Promise<ReplyEmail | false> => {
      const message = (senderName: string, count: number) => ({
        id: `m-${threadId}-${count}`,
        at: todayIsoDate(),
        from: senderName,
        fromRole: "board" as const,
        direction: "outbound" as const,
        channel: "email" as const,
        body,
      });
      if (remote.community) {
        const rc = remote.community;
        const thread = rc.threads.find((t) => t.id === threadId);
        if (!thread) return Promise.resolve(false);
        // Appended in the database, to the thread as it is there now
        // (reply_as_board, migration 0072). The browser used to send the
        // whole list back, built from the thread as this tab last read it,
        // so a reply written at 9:10 from a page opened at 9:00 erased what
        // an owner had sent at 9:05. The function names the sender from
        // their seat and numbers the message itself.
        return remoteWrite("Sending the reply", () =>
          supabaseBrowser().rpc("reply_as_board", { p_thread_id: threadId, p_body: body }),
        ).then(async (ok): Promise<ReplyEmail | false> => {
          if (!ok) return false;
          // The channel on the message says "email", so it is one.
          if (!thread.ownerId) return "none";
          return replyEmailState(
            await emailNotice(
              rc.id,
              {
                kind: thread.tag === "Billing" ? "letter" : "message",
                unitIds: [thread.ownerId],
                subject: thread.subject,
                body,
              },
              true,
            ),
          );
        });
      }
      const sender = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const replied = sliceStore(communityId, "threads").getSnapshot().find((t) => t.id === threadId);
      logDemoActivity(communityId, "thread", activityWords.reply(replied?.unit ?? "an owner"), {
        unit_id: replied?.ownerId,
        home: replied?.unit,
        subject: replied?.subject,
      });
      sliceStore(communityId, "threads").update((all) =>
        all.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                unread: false,
                updatedDate: todayIsoDate(),
                messages: [
                  ...thread.messages,
                  {
                    ...message(sender?.name ?? "Board", thread.messages.length),
                    ...(officeOf(sender?.role) ? { fromOffice: officeOf(sender?.role) as Office } : {}),
                  },
                ],
              }
            : thread,
        ),
      );
      return Promise.resolve("none");
    },
    [remote.community, communityId],
  );

  const messageOwner = useCallback(
    (
      ownerId: string,
      subject: string,
      body: string,
      tag: Community["threads"][number]["tag"] = "General",
    ) => {
      const id = newId();
      const message = (senderName: string) => ({
        id: `m-${id}-0`,
        at: todayIsoDate(),
        from: senderName,
        fromRole: "board" as const,
        direction: "outbound" as const,
        channel: "email" as const,
        body,
      });
      if (remote.community) {
        const rc = remote.community;
        const owner = rc.owners.find((o) => o.id === ownerId);
        if (!owner) return false;
        const sender = rc.accounts.find((a) => a.id === remote.profileId);
        const senderName = sender?.name ?? "Board";
        // Resolves once the letter is on its thread, so a screen sending
        // several can say how many landed. The email follows on its own.
        return remoteWrite("Sending the letter", () =>
          supabaseBrowser().from("threads").insert({
            id,
            association_id: rc.id,
            subject,
            unit_id: ownerId,
            participants: [owner.displayName, senderName],
            tag,
            updated_on: todayIsoDate(),
            unread: false,
            messages: [message(senderName)],
          }),
        ).then((ok) => {
          // A dues letter is a statutory notice; a note is a message the
          // owner may turn off. The tag is what tells them apart.
          if (ok) {
            void emailNotice(rc.id, {
              kind: tag === "Billing" ? "letter" : "message",
              unitIds: [ownerId],
              subject,
              body,
            });
          }
          return ok;
        });
      }
      const owner = sliceStore(communityId, "owners")
        .getSnapshot()
        .find((o) => o.id === ownerId);
      if (!owner) return false;
      const sender = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const senderName = sender?.name ?? "Board";
      sliceStore(communityId, "threads").update((all) => [
        {
          id,
          subject,
          participants: [owner.displayName, senderName],
          ownerId,
          unit: owner.unit,
          updatedDate: todayIsoDate(),
          unread: false,
          tag,
          toRole: "board",
          messages: [message(senderName)],
        },
        ...all,
      ]);
      return true;
    },
    [remote.community, remote.profileId, communityId],
  );

  const uploadDocuments = useCallback(
    async (
      files: File[],
      options?: {
        category?: DocumentRecord["category"];
        /** Board only unless the caller says otherwise; governing documents say so. */
        visibility?: DocumentRecord["visibility"];
      },
    ): Promise<UploadOutcome> => {
      const outcome: UploadOutcome = { uploaded: [], rejected: [], filed: [] };
      const category = options?.category ?? "Notices";
      const visibility = options?.visibility ?? "board";
      const accepted: File[] = [];
      for (const file of files) {
        const reason = rejectReason(file);
        if (reason) outcome.rejected.push({ name: file.name, reason });
        else accepted.push(file);
      }

      if (!remote.community) {
        // A demo has nowhere to put the bytes, so it keeps everything else.
        const filed = accepted.map((file, index) => ({
          ...toDocumentRecord(file, `doc-upload-${Date.now()}-${index}`, todayIsoDate()),
          category,
        }));
        if (filed.length) {
          sliceStore(communityId, "documents").update((all) => [...filed, ...all]);
        }
        outcome.uploaded.push(...accepted.map((file) => file.name));
        outcome.filed.push(...filed.map((d) => ({ id: d.id, name: d.name })));
        return outcome;
      }

      const supabase = supabaseBrowser();
      const associationId = remote.community.id;
      for (const file of accepted) {
        const id = crypto.randomUUID();
        const path = storagePathFor(associationId, id, file.name);
        const { error: putError } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: mimeTypeOf(file.name, file.type) });
        if (putError) {
          outcome.rejected.push({ name: file.name, reason: putError.message });
          continue;
        }
        const { error: rowError } = await supabase.from("documents").insert({
          id,
          association_id: associationId,
          name: documentTitle(file.name),
          category,
          visibility: toDbVisibility(visibility),
          storage_path: path,
          size_label: formatSize(file.size),
        });
        if (rowError) {
          // The row is what makes a file reachable. Without one the bytes are
          // an orphan, so take them back out rather than leave them.
          await supabase.storage.from("documents").remove([path]);
          outcome.rejected.push({ name: file.name, reason: rowError.message });
          continue;
        }
        outcome.uploaded.push(file.name);
        outcome.filed.push({ id, name: documentTitle(file.name) });
      }
      if (outcome.uploaded.length) await refreshRemote();
      return outcome;
    },
    [remote.community, communityId],
  );

  /**
   * Adds text confirmed out of an uploaded governing document.
   *
   * Appends rather than replaces, and drops anything whose number is already
   * on file. Importing the same file twice is the most likely way this gets
   * used by mistake, and the failure it would otherwise produce is a document
   * with two Article VIIs, which is exactly the ambiguity a board cites into.
   */
  const addGoverningArticles = useCallback(
    (articles: Community["governingDocs"]) => {
      if (remote.community) {
        const rc = remote.community;
        const offset = rc.governingDocs.length;
        void remoteWrite("Filing the articles", () =>
          supabaseBrowser()
            .from("governing_articles")
            // The unique key on document and number is what drops a second
            // Article VII; ignoring the duplicate keeps the rest.
            .upsert(
              articles.map((article, index) => ({
                association_id: rc.id,
                document: article.document,
                number: article.number,
                title: article.title,
                topic: article.topic,
                text: article.text,
                plain: article.plain ?? null,
                affects: article.affects,
                amended_on: article.amendedOn ?? null,
                amendment_ballot_id: article.amendmentBallotId ?? null,
                adopted_on: article.adoptedOn ?? null,
                disclosure_topics: article.disclosureTopics ?? null,
                extraction: article.extraction ?? null,
                position: offset + index,
              })),
              { onConflict: "association_id,document,number", ignoreDuplicates: true },
            ),
        );
        return;
      }
      sliceStore(communityId, "governingDocs").update((all) => {
        const taken = new Set(all.map((a) => `${a.document}|${a.number}`));
        const fresh = articles.filter((a) => !taken.has(`${a.document}|${a.number}`));
        return [...all, ...fresh];
      });
    },
    [remote.community, communityId],
  );

  const addBallot = useCallback(
    (ballot: Community["ballots"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Opening the ballot", async () => {
          const supabase = supabaseBrowser();
          const id = newId();
          const { error } = await supabase.from("ballots").insert({
            id,
            association_id: rc.id,
            title: ballot.title,
            body: ballot.body,
            kind: ballot.kind,
            audience: ballot.audience,
            status: ballot.status,
            opens_on: ballot.opensDate,
            closes_on: ballot.closesDate,
            seats: ballot.seats ?? 1,
            quorum_required: ballot.quorumRequired,
            threshold_label: ballot.thresholdLabel,
            meeting_id: isUuid(ballot.meetingId ?? "") ? ballot.meetingId : null,
            live_results_visible: ballot.liveResultsVisible,
          });
          if (error) throw new Error(error.message);
          const { error: optionsError } = await supabase.from("ballot_options").insert(
            ballot.options.map((option, position) => ({
              ballot_id: id,
              label: option.label,
              detail: option.detail ?? null,
              position,
            })),
          );
          if (optionsError) throw new Error(optionsError.message);
          // Notice of a vote goes out the moment it opens to owners. The
          // server reads the ballot back and declines a board-only one.
          if (ballot.audience === "owners" && ballot.status === "open") {
            void emailNotice(rc.id, { kind: "ballot", id });
          }
        });
        return;
      }
      sliceStore(communityId, "ballots").update((all) => [ballot, ...all]);
    },
    [remote.community, communityId],
  );

  const addMeeting = useCallback(
    (meeting: Community["meetings"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Scheduling the meeting", () =>
          supabaseBrowser().from("meetings").insert({
            id: newId(),
            association_id: rc.id,
            title: meeting.title,
            held_on: meeting.date,
            held_at: meeting.time,
            location: meeting.location,
            dial_in: meeting.dialIn || null,
            passcode: meeting.passcode || null,
            status: meeting.status,
            kind: meeting.kind,
            agenda: meeting.agenda,
            notice_sent_on: meeting.noticeSentDate ?? null,
          }),
        );
        return;
      }
      logDemoActivity(communityId, "meeting", activityWords.meeting(meeting.title, meeting.date), {
        held_on: meeting.date,
      });
      sliceStore(communityId, "meetings").update((all) =>
        [...all, meeting].sort((a, b) => a.date.localeCompare(b.date)),
      );
    },
    [remote.community, communityId],
  );

  const setDocumentVisibility = useCallback(
    async (documentId: string, visibility: Community["documents"][number]["visibility"]) => {
      if (!remote.community) {
        sliceStore(communityId, "documents").update((all) =>
          all.map((doc) => (doc.id === documentId ? { ...doc, visibility } : doc)),
        );
        return;
      }
      const { error, count } = await supabaseBrowser()
        .from("documents")
        .update({ visibility: toDbVisibility(visibility) }, { count: "exact" })
        .eq("id", documentId);
      if (error) throw new Error(error.message);
      // Hidden by row level security, the row matches nothing and the
      // database says nothing. The screen catches this and says it.
      if (count === 0) throw new Error(NOT_CHANGED);
      await refreshRemote();
    },
    [remote.community, communityId],
  );

  const removeDocument = useCallback(
    async (documentId: string) => {
      if (!remote.community) {
        return destructive(sliceStore(communityId, "documents"), (all) =>
          all.filter((d) => d.id !== documentId),
        );
      }
      const doc = remote.community.documents.find((d) => d.id === documentId);
      const supabase = supabaseBrowser();
      const { error, count } = await supabase
        .from("documents")
        .delete({ count: "exact" })
        .eq("id", documentId);
      if (error) throw new Error(error.message);
      // A delete that matched nothing left the row where it is, and the
      // bytes must stay with it: taking them left a document on the list
      // that opened to nothing.
      if (count === 0) throw new Error(NOT_CHANGED);
      // With the row gone nothing can reach the file, so the bytes go too. If
      // this step fails the result is an unreachable orphan, not a document
      // that appears to have survived.
      if (doc?.storagePath) await supabase.storage.from("documents").remove([doc.storagePath]);
      await refreshRemote();
      return undefined;
    },
    [remote.community, communityId],
  );

  const castVote = useCallback(
    (ballotId: string, optionIds: string | string[]) => {
      const picks = Array.isArray(optionIds) ? optionIds : [optionIds];
      if (remote.community) {
        // The receipt is minted by the database, where it cannot be forged,
        // and arrives with the re-read. The screens show it from the ballot.
        const existing = remote.community.ballots.find((b) => b.id === ballotId);
        void remoteWrite("Casting your vote", () =>
          supabaseBrowser().rpc("cast_votes", { p_ballot_id: ballotId, p_option_ids: picks }),
        );
        return existing?.myVoteReceipt ?? "";
      }
      const store = sliceStore(communityId, "ballots");
      const existing = store.getSnapshot().find((b) => b.id === ballotId);
      const receipt = existing?.myVoteReceipt ?? voteReceipt(ballotId, picks[0]);

      store.update((all) =>
        all.map((ballot) => {
          if (ballot.id !== ballotId) return ballot;
          const previous = new Set(
            ballot.myVoteOptionIds ?? (ballot.myVoteOptionId ? [ballot.myVoteOptionId] : []),
          );
          const next = new Set(picks);
          // One mark per seat per household. Changing your mind replaces the
          // marks rather than adding to them, and keeps the original receipt
          // so the number a voter wrote down still resolves.
          return {
            ...ballot,
            myVoteOptionId: picks[0],
            myVoteOptionIds: picks,
            myVoteReceipt: receipt,
            options: ballot.options.map((option) => {
              const was = previous.has(option.id);
              const is = next.has(option.id);
              if (is && !was) return { ...option, votes: option.votes + 1 };
              if (was && !is) return { ...option, votes: Math.max(0, option.votes - 1) };
              return option;
            }),
          };
        }),
      );

      return receipt;
    },
    [remote.community, communityId],
  );

  const liveCommunity = useMemo<Community>(
    () => ({
      ...community,
      settings,
      accounts: accountList,
      owners: ownerList,
      bankAccounts: bankAccountList,
      ownerCharges: ownerChargeMap,
      budget: budgetLines,
      amenities,
      forms,
      posts,
      requests: requestList,
      instruments,
      ledger,
      payouts,
      invoices,
      vendors,
      threads,
      documents,
      governingDocs,
      violations: violationList,
      violationReports: reportList,
      ballots,
      templates,
      association: associationRow,
      meetings: meetingList,
      reserveComponents: reserveComponentList,
      sharedCosts,
      sharedCostBills,
      announcements: announcementList,
      actionItems: actionItemList,
      joinRequests: joinRequestList,
      activity: demoActivity,
    }),
    [
      community,
      settings,
      accountList,
      ownerList,
      bankAccountList,
      ownerChargeMap,
      budgetLines,
      amenities,
      forms,
      posts,
      requestList,
      instruments,
      ledger,
      payouts,
      invoices,
      vendors,
      threads,
      documents,
      governingDocs,
      violationList,
      reportList,
      ballots,
      templates,
      associationRow,
      meetingList,
      reserveComponentList,
      sharedCosts,
      sharedCostBills,
      announcementList,
      actionItemList,
      joinRequestList,
      demoActivity,
    ],
  );

  // A signed in person looking at a real association sees Postgres. Everyone
  // else sees the demo. The two never blend: `remote.community` is either the
  // whole world or none of it.
  const community_ = remote.community ?? liveCommunity;

  const value: AppState = {
    community: community_,
    communities: remote.community
      ? remote.associations.map((a) => ({ id: a.id, label: a.name, place: a.place, slug: a.slug }))
      : communityList.map((c) => ({ id: c.id, label: c.label, place: c.association.addressLine, slug: c.id })),
    setCommunity,
    account,
    mySeats,
    chooseHome,
    // Every slice is read off the active community rather than off the local
    // stores directly, so remote and demo cannot disagree about which world
    // a screen is in. In demo mode community_ is the local overlay, so this
    // is the same data by a shorter route.
    accounts: community_.accounts,
    // "admin" is what sessions stored before the 2026-09-01 rename; the guard
    // lets it through so nobody is signed out, and it reads as board here.
    view: (session.view as string) === "admin" ? "board" : session.view,
    ready,
    settings: community_.settings,
    amenities: community_.amenities,
    forms: community_.forms,
    posts: community_.posts,
    requests: community_.requests,
    instruments: community_.instruments,
    ledger: community_.ledger,
    payouts: community_.payouts,
    invoices: community_.invoices,
    vendors: community_.vendors,
    threads: community_.threads,
    documents: community_.documents,
    ballots: community_.ballots,
    templates: community_.templates,
    signIn,
    signOut,
    setView,
    can,
    sees,
    updateSettings,
    setAmenities,
    setForms,
    removeForm,
    removeAmenity,
    addVendor,
    saveTemplate,
    removeVendor,
    removeDocument,
    setCapability,
    resetDemo,
    createCommunity,
    createRemoteAssociation,
    isRemote: Boolean(remote.community),
    addOwner,
    addViolationReport,
    verifyReport,
    dismissReport,
    raiseNoticeFromReport,
    setOpeningBalances,
    setHouseholdOwner,
    addSecondOwner,
    removeCoOwner,
    changeOwnerEmail,
    setHomeType,
    setHomeDues,
    removeOwner,
    transferHome,
    setAccountRole,
    dismissedSetupTasks,
    dismissSetupTask,
    restoreSetupTask,
    addBankAccount,
    recordPayment,
    recordManualPayment,
    reverseManualPayment,
    manualPaymentsFor,
    addCredit,
    addCharge,
    addChargeToAll,
    setOpeningBankBalance,
    addPost,
    addAnnouncement,
    removeAnnouncement,
    sendMeetingNotice,
    moderatePost,
    togglePinned,
    removePost,
    addRequest,
    addInstrument,
    removeInstrument,
    setDefaultInstrument,
    confirmLedgerEntry,
    recordReserveTransfer,
    reverseLedgerEntry,
    approvePayout,
    markPayoutPaid,
    markW9Requested,
    replyToThread,
    messageBoard,
    replyAsOwner,
    messageOwner,
    uploadDocuments,
    addGoverningArticles,
    updateAssociation,
    addPayout,
    addBallot,
    addMeeting,
    addBudgetLine,
    addReserveComponent,
    addSharedCost,
    removeSharedCost,
    postSharedCostBill,
    setDocumentVisibility,
    castVote,
    updateRequestStatus,
    replyToRequest,
    likePost,
    replyToPost,
    updateMyContact,
    setAutopay,
    markViolationFixed,
    setWorkOrder,
    rsvpMeeting,
    addActionItem,
    setActionItemDone,
    removeActionItem,
    approveJoinRequest,
    seatJoinRequest,
    declineJoinRequest,
    requestToJoin,
    lookupJoinCode,
    setHomeRole,
    addInvoice,
    payInvoice,
    approveInvoice,
    rejectInvoice,
    setPayoutNotes,
    setViolationStage,
    addCityNotice,
    addNotice,
    closeBallot,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}

/**
 * The owner record behind the signed in account. An admin switching to the
 * resident view sees their own unit and their own balance, not a demo one.
 */
export function useCurrentOwner(): Owner | null {
  const { account, community } = useAppState();
  // Indexed per community, so a lookup stays constant time as either grows.
  const index = useMemo(
    () => new Map(community.owners.map((owner) => [owner.id, owner])),
    [community],
  );
  return useMemo(() => (account ? (index.get(account.ownerId) ?? null) : null), [account, index]);
}

/** Charge history is only seeded for a few households; everyone else sees an empty ledger. */
export function useOwnerCharges() {
  const { community } = useAppState();
  const owner = useCurrentOwner();
  return owner ? (community.ownerCharges[owner.id] ?? []) : [];
}

/**
 * The signed-in owner's photo of their home, with a setter. Null clears it.
 *
 * `photo` is always the best image we hold, in this order: what the owner
 * uploaded in this browser, then the photo on their record, then the
 * community's cover. `uploaded` says whether the first of those is in play,
 * which is the only case "Remove photo" makes sense for.
 */
export function useHomePhoto(): {
  photo: string | null;
  uploaded: boolean;
  setPhoto: (dataUrl: string | null) => void;
} {
  const owner = useCurrentOwner();
  const { settings } = useAppState();
  const all = useStore(homePhotoStore);
  const ownerId = owner?.id;
  const setPhoto = useCallback(
    (dataUrl: string | null) => {
      if (!ownerId) return;
      homePhotoStore.update((current) => {
        const next = { ...current };
        if (dataUrl) next[ownerId] = dataUrl;
        else delete next[ownerId];
        return next;
      });
    },
    [ownerId],
  );
  const own = ownerId ? (all[ownerId] ?? null) : null;
  return {
    photo: own ?? owner?.photoUrl ?? settings.photoUrl ?? null,
    uploaded: Boolean(own),
    setPhoto,
  };
}

export function useMyRequests() {
  const owner = useCurrentOwner();
  const { requests: all } = useAppState();
  return useMemo(
    () =>
      owner
        ? all
            .filter((r) => r.ownerId === owner.id)
            .sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1))
        : [],
    [owner, all],
  );
}

/**
 * What a resident is allowed to see: published posts, plus their own pending
 * ones so they can tell the post was received rather than lost.
 */
export function useVisiblePosts(): ForumPost[] {
  const { posts, account } = useAppState();
  return useMemo(
    () =>
      posts.filter(
        (post) =>
          post.status === "published" ||
          (account && post.author === account.name && post.status !== "rejected"),
      ),
    [posts, account],
  );
}

/** The moderation queue, oldest first so nothing sits forever. */
export function usePendingPosts(): ForumPost[] {
  const { posts } = useAppState();
  return useMemo(
    () =>
      posts.filter((p) => p.status === "pending").sort((a, b) => (a.at < b.at ? -1 : 1)),
    [posts],
  );
}

/**
 * Reconciliation over the live ledger rather than the frozen fixture, so
 * confirming a transaction updates every count that depends on it.
 */
export function useReconciliation() {
  const { ledger, community } = useAppState();
  return useMemo(() => {
    const needsReview = ledger.filter((e) => e.status === "needs-review");
    const pending = ledger.filter((e) => e.status === "pending");
    const cleared = ledger.filter((e) => e.status === "cleared");
    const duplicates = ledger.filter((e) => e.duplicateOfId);
    return {
      needsReview,
      pending,
      cleared,
      duplicates,
      staleFeeds: community.bankAccounts.filter((a) => a.status !== "live"),
      lastSyncMinutes: community.bankAccounts.length
        ? Math.min(...community.bankAccounts.map((a) => a.syncedMinutesAgo))
        : 0,
      tiesOut: needsReview.length === 0,
    };
  }, [ledger, community]);
}

/** Payouts still short of the signatures they need. */
export function usePendingApprovals() {
  const { payouts } = useAppState();
  return useMemo(
    () => payouts.filter((p) => p.approvals.length < p.approvalsRequired),
    [payouts],
  );
}

export function useUnreadThreadCount() {
  const { threads } = useAppState();
  return useMemo(() => threads.filter((t) => t.unread).length, [threads]);
}

/** Vendor paperwork the board still owes someone. */
export function useVendorGaps() {
  const { vendors } = useAppState();
  return useMemo(
    () => ({
      missingW9: vendors.filter((v) => !v.w9OnFile),
      noAch: vendors.filter((v) => !v.achEnabled),
      expiringCoi: vendors.filter(
        (v) => v.coiExpires && daysFromToday(v.coiExpires) < 60 && daysFromToday(v.coiExpires) >= 0,
      ),
    }),
    [vendors],
  );
}

/**
 * The snapshot the in-app assistant answers from.
 *
 * Built on the client from live state rather than rendered on the server, so it
 * follows the signed in household and the active association. The assistant is
 * only trustworthy if it reads the same data the screens do.
 */
export function useAssistantContext() {
  const { community, settings, requests, documents, amenities } = useAppState();
  const owner = useCurrentOwner();
  const charges = useOwnerCharges();

  return useMemo(() => {
    const lastPayment = charges.find((c) => c.kind === "payment");
    const live = community.meetings.find((m) => m.status === "live");
    const cash = community.bankAccounts.reduce(
      (acc, a) =>
        a.kind === "operating"
          ? { ...acc, operating: acc.operating + a.balanceCents }
          : { ...acc, reserve: acc.reserve + a.balanceCents },
      { operating: 0, reserve: 0 },
    );
    const reserveBalance = cash.reserve;
    const blendedApy = reserveBalance
      ? community.bankAccounts
          .filter((a) => a.kind !== "operating")
          .reduce((t, a) => t + a.apy * a.balanceCents, 0) / reserveBalance
      : 0;
    const required = community.reserveComponents.reduce(
      (t, c) => t + c.replacementCostCents,
      0,
    );
    const funded = community.reserveComponents.reduce((t, c) => t + c.fundedCents, 0);

    return {
      owner: {
        name: owner?.members[0] ?? "",
        unit: owner?.unit ?? "",
        balanceCents: owner?.balanceCents ?? 0,
        nextChargeDate: community.nextChargeDate as string | undefined,
        standing: owner?.standing ?? "current",
        daysPastDue: owner?.daysPastDue ?? 0,
        autopay: owner?.autopay ?? false,
        lastPayment: lastPayment
          ? {
              date: lastPayment.date,
              amountCents: Math.abs(lastPayment.amountCents),
              method: lastPayment.method,
              appliedTo: lastPayment.appliedTo?.map((a) => a.label) ?? [],
            }
          : undefined,
      },
      association: {
        name: community.association.name,
        // What this owner's home pays, which is the one figure the assistant
        // says about dues.
        duesCents: ownerDues(community.association, owner ?? undefined),
        unitCount: homeCount(community),
        operatingCents: cash.operating,
        reserveCents: reserveBalance,
        interestYtdCents: community.bankAccounts.reduce((t, a) => t + a.interestYtdCents, 0),
        blendedApy,
        reservePercentFunded: required ? funded / required : 0,
      },
      methods: community.instruments.map((m) => ({
        label: m.label,
        kind: m.kind,
        feeCents: 0,
        feePercent: 0,
      })),
      meetings: community.meetings
        // By phase, as every screen reads them: nothing marks a real
        // association's meeting ended, so its date does.
        .filter((m) => meetingPhase(m) !== "ended")
        .map((m) => ({
          title: m.title,
          date: m.date,
          time: m.time,
          location: m.location,
          dialIn: m.dialIn,
          status: m.status,
        })),
      liveMeeting: live ? { title: live.title, attendees: live.attendees.length } : undefined,
      events: [] as { title: string; date: string; time: string; location: string }[],
      ballots: community.ballots
        // A ballot past its closing date is closed, pressed or not.
        .filter((b) => b.audience === "owners" && ballotPhase(b) === "open")
        .map((b) => ({ title: b.title, closesDate: b.closesDate, voted: Boolean(b.myVoteOptionId) })),
      requests: requests
        .filter((r) => r.ownerId === owner?.id)
        .map((r) => ({
          reference: r.reference,
          title: r.title,
          status: r.status,
          submittedDate: r.submittedDate,
        })),
      documentCount: documents.filter((d) => d.visibility !== "board").length,
      amenities: amenities.map((a) => ({ name: a.name, status: a.status, detail: a.detail })),
      fundsVisible: settings.showFundsToResidents,
    };
  }, [community, settings, requests, documents, amenities, owner, charges]);
}

/** The signed in household's payment instruments, default first. */
export function useMyInstruments(): PaymentInstrument[] {
  const owner = useCurrentOwner();
  const { instruments } = useAppState();
  return useMemo(
    () =>
      owner
        ? instruments
            .filter((i) => i.ownerId === owner.id)
            .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        : [],
    [owner, instruments],
  );
}

/** Open, decided, then history. A request leaves the queue, never the record. */
export const OPEN_STATUSES = ["draft", "submitted", "in-review", "info-needed"] as const;
export const DECIDED_STATUSES = ["approved", "denied"] as const;

export function bucketRequests<T extends { status: string }>(rows: T[]) {
  return {
    open: rows.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status)),
    decided: rows.filter((r) => (DECIDED_STATUSES as readonly string[]).includes(r.status)),
    history: rows.filter((r) => r.status === "closed"),
  };
}

/**
 * Any association by id, including ones built through onboarding.
 *
 * Created associations live in a store that only has content after hydration,
 * so a component resolving one during the first render sees the server
 * snapshot and finds nothing. Subscribing here means the lookup re-runs once
 * storage has been read, which is what an invitation link needs.
 */
export function useCommunityById(id: string | null | undefined): Community | null {
  const created = useStore(createdCommunitiesStore);
  return useMemo(() => {
    if (!id) return null;
    const base = [...seededCommunities, ...created].find((c) => c.id === id);
    return base ? withLiveSlices(base) : null;
  }, [id, created]);
}

/**
 * A community with its stored slices laid over the seed.
 *
 * Every association exists in two halves: a seed, which is either a fixture or
 * the bundle onboarding wrote, and the slice stores that hold everything
 * changed since. Reading only the seed is how a household added this morning
 * fails to exist. The provider does the same overlay through hooks so the
 * active community stays reactive; this is the one-shot version, for reading
 * an association you are not signed into.
 */
export function withLiveSlices(base: Community): Community {
  const next = { ...base };
  for (const slice of MUTABLE_SLICES) {
    (next as Record<string, unknown>)[slice] = sliceStore(base.id, slice).getSnapshot();
  }
  return next;
}

/** True once storage has been read, so a caller can tell missing from not-yet-loaded. */
export function useStorageReady(): boolean {
  return useHydrated();
}
