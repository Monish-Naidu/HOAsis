import { useCallback } from "react";
import { formatDate, todayIsoDate } from "@/lib/utils";
import { type AppDeps, emailNotice, latest, newId, remoteWrite, sessionStore, sliceStore } from "./core";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import type { HomeRequest, WorkOrder } from "@/lib/types";
import { type ReplyEmail, replyEmailState } from "@/lib/email/plain-error";
import { statusAfterReply, statusLabel } from "@/lib/request-status";
import { attachmentFileName, attachmentPath, attachmentProblem, fileSizeWords, uploadAttachment } from "@/lib/attachments";
import { isUuid } from "@/lib/core/ids";

/**
 * Requests: what an owner asks the board for, how the board answers, and the
 * work orders raised from them.
 */
export function useRequestsActions(deps: AppDeps) {
  const { remote, communityId } = deps;

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
            // The form names the request before it is sent, so the files can
            // be filed under it once it is stored.
            id: isUuid(request.id) ? request.id : newId(),
            association_id: rc.id,
            unit_id: request.homeId,
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

  /**
   * Puts files on a request that already exists: each goes into the bucket
   * and the request is then told about it. A file that cannot go is skipped
   * and one that fails is reported, so the others still land. Resolves true
   * when every file that was tried was saved.
   */
  const attachFiles = useCallback(
    async (requestId: string, files: File[]): Promise<boolean> => {
      const sendable = files.filter((f) => attachmentProblem(f) === null);
      if (!sendable.length) return files.length === 0;
      if (remote.community) {
        const rc = remote.community;
        let all = sendable.length === files.length;
        for (const file of sendable) {
          const path = attachmentPath(rc.id, "requests", requestId, attachmentFileName(file.name));
          const ok = await remoteWrite(`Attaching ${file.name}`, async () => {
            const supabase = supabaseBrowser();
            const up = await uploadAttachment(supabase, path, file);
            if (up.error) return { error: { message: up.error } };
            return supabase.rpc("add_request_attachment", {
              p_request_id: requestId,
              p_name: file.name.slice(0, 120),
              p_size_bytes: file.size,
              p_path: path,
            });
          });
          all = all && ok;
        }
        return all;
      }
      sliceStore(communityId, "requests").update((list) =>
        list.map((r) =>
          r.id === requestId
            ? {
                ...r,
                attachments: [
                  ...r.attachments,
                  ...sendable.map((f) => ({ name: f.name, size: fileSizeWords(f.size), addedOn: todayIsoDate() })),
                ],
              }
            : r,
        ),
      );
      return sendable.length === files.length;
    },
    [remote.community, communityId],
  );

  return {
    setWorkOrder,
    addRequest,
    attachFiles,
    updateRequestStatus,
    replyToRequest,
  };
}
