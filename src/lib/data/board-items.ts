import type { ActionItem, JoinRequest } from "@/lib/types";

/**
 * What the Mehr Meadows board agreed to do, and who is waiting at the door.
 *
 * Three items from the July meeting, one done and two open, so the dashboard
 * card shows what it looks like in use. One join request, so the Homeowners
 * page shows the queue without anyone having to type the code first.
 */
export const actionItems: ActionItem[] = [
  {
    id: "act-2026-07-1",
    title: "Get two quotes for the clubhouse roof",
    ownerName: "Dana Whitcomb",
    meetingId: "mtg-2026-07",
    dueOn: "2026-08-15",
    doneOn: "2026-08-11",
    createdOn: "2026-07-14",
  },
  {
    id: "act-2026-07-2",
    title: "Send the solar amendment to counsel for the recording",
    ownerName: "Sofia Bergman",
    meetingId: "mtg-2026-07",
    dueOn: "2026-08-28",
    createdOn: "2026-07-14",
  },
  {
    id: "act-2026-07-3",
    title: "Call the city about the Maple Lane storm drain",
    ownerName: "Arya Mehr",
    meetingId: "mtg-2026-07",
    dueOn: "2026-08-08",
    createdOn: "2026-07-14",
  },
];

export const joinRequests: JoinRequest[] = [
  {
    id: "join-2026-08-1",
    name: "Priya and Tom Ellison",
    email: "priya.ellison@example.com",
    unit: "56",
    note: "We closed on 56 Maple Lane on August 14. The seller said to ask here for the portal.",
    status: "pending",
    requestedOn: "2026-08-18",
  },
];
