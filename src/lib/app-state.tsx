"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { seededCommunities, communityById } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { daysFromToday, setToday } from "@/lib/utils";
import { createdCommunitiesStore } from "@/lib/data/created-communities";
import { useRemote } from "@/lib/data/remote-store";
import { ownerDues } from "@/lib/home-types";
import { supabaseBrowser } from "@/lib/supabase/client";

import type { ForumPost, Owner } from "@/lib/types";
import { type PaymentInstrument } from "@/lib/payments/instruments";
import { homeCount } from "@/lib/metrics";
import { activityWords } from "@/lib/activity";
import { vendorNameProblem } from "@/lib/vendor-name";
import { ballotPhase, meetingPhase } from "@/lib/phases";
import { communityStore, demoActivityStore, destructive, dismissStore, homePhotoStore, homeStore, logDemoActivity, MUTABLE_SLICES, newId, remoteWrite, sessionStore, sliceStore, useHydrated, useStore } from "./app-state/core";
import type { AppState } from "./app-state/types";
import { useSessionActions } from "./app-state/use-session";
import type { BaseDeps } from "./app-state/core";
import { useSettingsActions } from "./app-state/use-settings";
import type { AppDeps } from "./app-state/core";
import { useMoneyActions } from "./app-state/use-money";
import { usePeopleActions } from "./app-state/use-people";
import { useEnforcementActions } from "./app-state/use-enforcement";
import { useCommunicationsActions } from "./app-state/use-communications";
import { useMeetingsActions } from "./app-state/use-meetings";
import { useRequestsActions } from "./app-state/use-requests";
import { useDocumentsActions } from "./app-state/use-documents";

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

  const {
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
  } = usePeopleActions(deps);

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

  const {
    addViolationReport,
    verifyReport,
    dismissReport,
    raiseNoticeFromReport,
    addNotice,
    setViolationStage,
    addCityNotice,
    markViolationFixed,
  } = useEnforcementActions(deps);

  const {
    addPost,
    addAnnouncement,
    removeAnnouncement,
    moderatePost,
    togglePinned,
    removePost,
    likePost,
    replyToPost,
    messageBoard,
    replyAsOwner,
    replyToThread,
    messageOwner,
  } = useCommunicationsActions(deps);

  const {
    closeBallot,
    sendMeetingNotice,
    rsvpMeeting,
    addActionItem,
    setActionItemDone,
    removeActionItem,
    addBallot,
    addMeeting,
    castVote,
  } = useMeetingsActions({ ...deps, addAnnouncement });


  const {
    setWorkOrder,
    addRequest,
    updateRequestStatus,
    replyToRequest,
  } = useRequestsActions(deps);

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

  const {
    uploadDocuments,
    addGoverningArticles,
    setDocumentVisibility,
    removeDocument,
  } = useDocumentsActions(deps);

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
