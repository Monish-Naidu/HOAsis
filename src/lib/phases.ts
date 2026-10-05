import type { Ballot, BallotStatus, Meeting } from "@/lib/types";
import { todayIsoDate } from "@/lib/utils";

/**
 * Where a ballot or a meeting stands today, read from its dates as well as
 * its stored status.
 *
 * The stored status only moves when somebody presses a button: a ballot is
 * "open" until the board presses Close now, and a real association's meeting
 * is "scheduled" for ever, because nothing writes "ended". Each screen used
 * to decide for itself what a passed date meant, so the resident's ballot
 * card said Closed while their dashboard, the bell and the board's Voting
 * page all still called it open. Every reader asks here instead, so both
 * shells give one answer.
 *
 * Pure: the clock is passed in, and defaults to the association's own.
 */

/**
 * An open ballot whose closing date has passed reads as closed. The closing
 * date itself is the last day to vote, so it is still open on that day.
 *
 * A scheduled ballot is left as it is stored: the database only takes votes
 * on an open one, so calling it open by its date would offer choices that
 * are then refused.
 */
export function ballotPhase(
  ballot: Pick<Ballot, "status" | "closesDate">,
  today: string = todayIsoDate(),
): BallotStatus {
  if (ballot.status === "open" && ballot.closesDate < today) return "closed";
  return ballot.status;
}

/**
 * A ballot that is over by its date and still open in the record.
 *
 * Reading the phase is enough for what a screen says, but only pressing a
 * button writes "closed", and Close now goes with the Open list. So a ballot
 * that ran to its closing date had no way left to be sealed: the row stayed
 * open in the database for good. The board's Voting page offers Record the
 * result on these, which is the same write Close now makes.
 */
export function ballotNeedsSealing(
  ballot: Pick<Ballot, "status" | "closesDate">,
  today: string = todayIsoDate(),
): boolean {
  return ballot.status === "open" && ballotPhase(ballot, today) === "closed";
}

/**
 * A scheduled meeting whose date has passed reads as ended. One held today
 * stays scheduled until the day is over, whatever time it starts.
 */
export function meetingPhase(
  meeting: Pick<Meeting, "status" | "date">,
  today: string = todayIsoDate(),
): Meeting["status"] {
  if (meeting.status === "scheduled" && meeting.date < today) return "ended";
  return meeting.status;
}
