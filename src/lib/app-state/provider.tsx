"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { seededCommunities, communityById } from "@/lib/data/communities";
import type { Community } from "@/lib/data/community";
import { setToday } from "@/lib/utils";
import { createdCommunitiesStore } from "@/lib/data/created-communities";
import { useRemote } from "@/lib/data/remote-store";
import {
  type AppDeps,
  type BaseDeps,
  communityStore,
  demoActivityStore,
  dismissStore,
  homeStore,
  sessionStore,
  sliceStore,
  useHydrated,
  useStore,
} from "./core";
import type { AppState } from "./types";
import { useCommunicationsActions } from "./use-communications";
import { useDocumentsActions } from "./use-documents";
import { useEnforcementActions } from "./use-enforcement";
import { useMeetingsActions } from "./use-meetings";
import { useMoneyActions } from "./use-money";
import { usePeopleActions } from "./use-people";
import { useRequestsActions } from "./use-requests";
import { useSessionActions } from "./use-session";
import { useSettingsActions } from "./use-settings";
import { useVendorsActions } from "./use-vendors";

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
  const homeList = useStore(sliceStore(communityId, "homes"));
  const bankAccountList = useStore(sliceStore(communityId, "bankAccounts"));
  const budgetLines = useStore(sliceStore(communityId, "budget"));
  // Demo associations keep their skipped setup tasks here. Real ones keep them
  // in the database, loaded alongside the community.
  const localDismissals = useStore(dismissStore(communityId));
  const homeChargeMap = useStore(sliceStore(communityId, "homeCharges"));
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
    homeList,
    bankAccountList,
    budgetLines,
    localDismissals,
    homeChargeMap,
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

  const { markW9Requested, addVendor, removeVendor } = useVendorsActions(deps);

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
      homes: homeList,
      bankAccounts: bankAccountList,
      homeCharges: homeChargeMap,
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
      homeList,
      bankAccountList,
      homeChargeMap,
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
