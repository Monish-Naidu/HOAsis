import { useCallback } from "react";
import type { Community } from "@/lib/data/community";
import { type AppDeps, destructive, emailNotice, logDemoActivity, newId, remoteWrite, sessionStore, sliceStore, ValidationError } from "./core";
import { todayIsoDate } from "@/lib/utils";
import { officeOf } from "@/lib/board-offices";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Announcement, ForumPost, ForumReply, MessageThread, Office, ThreadAddress } from "@/lib/types";
import { activityWords } from "@/lib/activity";
import { type ReplyEmail, replyEmailState } from "@/lib/email/plain-error";

/**
 * Communications: announcements, the resident forum, and the message threads
 * between owners and the board.
 */
export function useCommunicationsActions(deps: AppDeps) {
  const { remote, communityId } = deps;

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
        const home = me ? rc.homes.find((o) => o.id === me.homeId) : undefined;
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
      const home = me
        ? sliceStore(communityId, "homes").getSnapshot().find((o) => o.id === me.homeId)
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
        unit: home?.unit ?? "",
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

  const messageBoard = useCallback(
    async (
      homeId: string,
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
            p_unit_id: homeId,
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
      const home = sliceStore(communityId, "homes").getSnapshot().find((o) => o.id === homeId);
      const from = home?.members[0] ?? home?.displayName ?? "Owner";
      sliceStore(communityId, "threads").update((all) => [
        {
          id: `t-${newId()}`,
          subject: subject.trim(),
          participants: [from],
          homeId,
          unit: home?.unit,
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
    async (threadId: string, homeId: string, body: string) => {
      if (!body.trim()) return false;
      if (remote.community) {
        return remoteWrite("Sending your reply", () =>
          supabaseBrowser().rpc("reply_as_owner", { p_thread_id: threadId, p_body: body.trim() }),
        );
      }
      const home = sliceStore(communityId, "homes").getSnapshot().find((o) => o.id === homeId);
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
                    from: home?.members[0] ?? home?.displayName ?? "Owner",
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
          if (!thread.homeId) return "none";
          return replyEmailState(
            await emailNotice(
              rc.id,
              {
                kind: thread.tag === "Billing" ? "letter" : "message",
                unitIds: [thread.homeId],
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
        unit_id: replied?.homeId,
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
      homeId: string,
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
        const home = rc.homes.find((o) => o.id === homeId);
        if (!home) return false;
        const sender = rc.accounts.find((a) => a.id === remote.profileId);
        const senderName = sender?.name ?? "Board";
        // Resolves once the letter is on its thread, so a screen sending
        // several can say how many landed. The email follows on its own.
        return remoteWrite("Sending the letter", () =>
          supabaseBrowser().from("threads").insert({
            id,
            association_id: rc.id,
            subject,
            unit_id: homeId,
            participants: [home.displayName, senderName],
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
              unitIds: [homeId],
              subject,
              body,
            });
          }
          return ok;
        });
      }
      const home = sliceStore(communityId, "homes")
        .getSnapshot()
        .find((o) => o.id === homeId);
      if (!home) return false;
      const sender = sliceStore(communityId, "accounts")
        .getSnapshot()
        .find((a) => a.id === sessionStore.getSnapshot().accountId);
      const senderName = sender?.name ?? "Board";
      sliceStore(communityId, "threads").update((all) => [
        {
          id,
          subject,
          participants: [home.displayName, senderName],
          homeId,
          unit: home.unit,
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

  return {
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
  };
}
