import { useCallback, useMemo } from "react";
import { sees as seesArea } from "@/lib/data/accounts";
import { setRemoteAssociation } from "@/lib/data/remote-store";
import { signOutOfSupabase } from "@/lib/auth";
import type { Capability } from "@/lib/types";
import { pickSeat } from "@/lib/home-choice";
import { type BaseDeps, communityStore, homeStore, NO_SESSION, sessionStore, sliceStore } from "./core";
import type { View } from "./types";

/**
 * Who is signed in and which home they are looking at: the seat behind the
 * screen, signing in and out, the board/resident view, and the capability
 * checks every other area asks before it writes.
 */
export function useSessionActions(deps: BaseDeps) {
  const { session, chosenHome, remote, communityId, accountList } = deps;

  // A seat's account id is the profile id, so a person with two homes holds
  // two accounts with one id. Only seats with their own profile id are theirs,
  // which means there is no way to be looking at somebody else's.
  const mySeats = useMemo(() => {
    if (remote.community) {
      return remote.community.accounts.filter((a) => a.id === remote.profileId);
    }
    const demo = accountList.find((candidate) => candidate.id === session.accountId);
    return demo ? [demo] : [];
  }, [remote.community, remote.profileId, accountList, session.accountId]);

  const account = useMemo(() => pickSeat(mySeats, chosenHome), [mySeats, chosenHome]);

  const chooseHome = useCallback(
    (unitId: string) => {
      if (mySeats.some((s) => s.ownerId === unitId)) homeStore.set(unitId);
    },
    [mySeats],
  );

  const signIn = useCallback(
    (id: string) => {
      const next = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === id);
      sessionStore.set({
        accountId: id,
        view: next && next.role !== "resident" ? "board" : "resident",
      });
    },
    [communityId],
  );

  const signOut = useCallback(() => {
    sessionStore.set(NO_SESSION);
    // Clearing the demo seat is not signing out if there is a real session
    // behind it, so end that too rather than leaving somebody logged in on a
    // page that says they are not.
    void signOutOfSupabase();
  }, []);

  const setView = useCallback(
    (view: View) => sessionStore.update((current) => ({ ...current, view })),
    [],
  );

  /**
   * Switching association also signs you out.
   *
   * An account belongs to one community, so carrying a session across would
   * leave a President of one association holding capabilities in another. The
   * safe move is to make the person sign in again on the other side.
   */
  const setCommunity = useCallback(
    (nextId: string): "switched" | "signed-out" => {
      // A real member holding two associations switches between them without
      // signing out, because the database knows which they belong to. Demo
      // seats still sign out, since picking a seat is how you choose a person.
      if (remote.associations.some((a) => a.id === nextId)) {
        void setRemoteAssociation(nextId);
        return "switched";
      }
      sessionStore.set(NO_SESSION);
      communityStore.set(nextId);
      return "signed-out";
    },
    [remote.associations],
  );

  const can = useCallback(
    (c: Capability) => Boolean(account && account.capabilities[c]),
    [account],
  );

  const sees = useCallback((c: Capability) => seesArea(account, c), [account]);

  return {
    mySeats,
    account,
    chooseHome,
    signIn,
    signOut,
    setView,
    setCommunity,
    can,
    sees,
  };
}
