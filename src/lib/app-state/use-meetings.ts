import { useCallback } from "react";
import type { Community } from "@/lib/data/community";
import { type AppDeps, emailNotice, isUuid, joinLine, latest, logDemoActivity, newId, noticesInFlight, remoteWrite, sessionStore, sliceStore, ValidationError, voteReceipt } from "./core";
import { formatDate, todayIsoDate } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { ActionItem, MeetingAttendee } from "@/lib/types";
import { meetingPhase } from "@/lib/phases";
import { activityWords } from "@/lib/activity";
import { noticeToast } from "@/lib/email/plain-error";
import type { useCommunicationsActions } from "./use-communications";

/**
 * Meetings and voting: scheduling, RSVPs, the notice sent for a meeting, what
 * the board agreed to do, and ballots and votes.
 */
export function useMeetingsActions(deps: AppDeps & Pick<ReturnType<typeof useCommunicationsActions>, "addAnnouncement">) {
  const { remote, communityId, associationRow, meetingList, addAnnouncement } = deps;

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

  /**
   * Moves a meeting that has not happened to another day. The first date it
   * was noticed for is kept, so the screen can say "Was Oct 3". The database
   * refuses a past date and a meeting that is over, and so does the demo.
   */
  const rescheduleMeeting = useCallback(
    (meetingId: string, to: { date: string; time?: string; location?: string }) => {
      const meetings = remote.community ? remote.community.meetings : meetingList;
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return Promise.resolve(false);
      if (to.date < todayIsoDate()) throw new ValidationError("Pick a date that has not passed.", { date: to.date });
      if (m.status === "cancelled" || meetingPhase(m) === "ended") {
        throw new ValidationError("That meeting is over.", { meetingId });
      }
      const time = to.time?.trim() || undefined;
      const location = to.location?.trim() || undefined;
      if (remote.community) {
        return remoteWrite("Changing the date", () =>
          supabaseBrowser().rpc("reschedule_meeting", {
            p_meeting_id: meetingId,
            p_held_on: to.date,
            p_held_at: time ?? null,
            p_location: location ?? null,
          }),
        );
      }
      logDemoActivity(communityId, "meeting", `Moved meeting "${m.title}" to ${to.date}`, { was: m.date, now: to.date });
      sliceStore(communityId, "meetings").update((all) =>
        all
          .map((x) =>
            x.id === meetingId
              ? {
                  ...x,
                  date: to.date,
                  time: time ?? x.time,
                  location: location ?? x.location,
                  rescheduledFrom: x.rescheduledFrom ?? (x.date !== to.date ? x.date : undefined),
                  status: "scheduled" as const,
                }
              : x,
          )
          .sort((a, b) => a.date.localeCompare(b.date)),
      );
      return Promise.resolve(true);
    },
    [remote.community, meetingList, communityId],
  );

  /** Cancels a meeting that has not happened. It stays on the record with the reason. */
  const cancelMeeting = useCallback(
    (meetingId: string, reason: string) => {
      const meetings = remote.community ? remote.community.meetings : meetingList;
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return Promise.resolve(false);
      const why = reason.trim();
      if (why.length < 3) throw new ValidationError("Say why the meeting is cancelled.", { reason });
      if (m.status === "cancelled" || meetingPhase(m) === "ended") {
        throw new ValidationError("That meeting is over.", { meetingId });
      }
      if (remote.community) {
        return remoteWrite("Cancelling the meeting", () =>
          supabaseBrowser().rpc("cancel_meeting", { p_meeting_id: meetingId, p_reason: why }),
        );
      }
      logDemoActivity(communityId, "meeting", `Cancelled meeting "${m.title}"`, { reason: why });
      sliceStore(communityId, "meetings").update((all) =>
        all.map((x) =>
          x.id === meetingId
            ? { ...x, status: "cancelled" as const, cancelledDate: todayIsoDate(), cancelReason: why }
            : x,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, meetingList, communityId],
  );

  /**
   * The minutes of a meeting that was held, and who came. Saved again, it
   * replaces what was there. A meeting still to come or cancelled has none.
   */
  const recordMinutes = useCallback(
    (meetingId: string, minutes: string, attended: MeetingAttendee[]) => {
      const meetings = remote.community ? remote.community.meetings : meetingList;
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return Promise.resolve(false);
      const text = minutes.trim();
      if (m.status === "cancelled") throw new ValidationError("A cancelled meeting has no minutes.", { meetingId });
      if (m.date > todayIsoDate()) throw new ValidationError("The meeting has not happened yet.", { meetingId });
      if (text.length < 10) throw new ValidationError("Write the minutes first.", { minutes });
      if (text.length > 20000) throw new ValidationError("Keep the minutes under 20,000 characters.", {});
      if (remote.community) {
        return remoteWrite("Saving the minutes", () =>
          supabaseBrowser().rpc("record_minutes", {
            p_meeting_id: meetingId,
            p_minutes: text,
            p_attended: attended.map((a) => ({ name: a.name, unit: a.unit ?? null, role: a.role ?? null, channel: a.channel })),
          }),
        );
      }
      logDemoActivity(communityId, "meeting", `Minutes recorded for "${m.title}"`, { attended: attended.length });
      sliceStore(communityId, "meetings").update((all) =>
        all.map((x) =>
          x.id === meetingId ? { ...x, minutes: text, minutesDate: todayIsoDate(), attended, status: "ended" as const } : x,
        ),
      );
      return Promise.resolve(true);
    },
    [remote.community, meetingList, communityId],
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

  return {
    closeBallot,
    sendMeetingNotice,
    rsvpMeeting,
    addActionItem,
    setActionItemDone,
    removeActionItem,
    addBallot,
    addMeeting,
    rescheduleMeeting,
    cancelMeeting,
    recordMinutes,
    castVote,
  };
}
