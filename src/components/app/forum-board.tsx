"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Heart,
  MessageCircle,
  MessageSquareText,
  Pin,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState } from "@/components/ui/primitives";
import { useAppState, usePendingPosts, useVisiblePosts } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { forumCategories } from "@/lib/data";
import { ROLE_LABEL, type ForumCategory, type ForumPost } from "@/lib/types";
import { cn, daysFromToday, formatDate, pluralize, relativeDays, todayIsoDate } from "@/lib/utils";
import { placeLabel } from "@/lib/wording";

/** "today", "3 days ago", then a real date once it stops being recent. */
function when(iso: string) {
  return daysFromToday(iso) > -30 ? relativeDays(iso) : formatDate(iso);
}

/** A post written in the composer has no title of its own; the first line stands in. */
function titleFrom(body: string) {
  const line = body.split("\n").find((l) => l.trim()) ?? "";
  return line.trim().slice(0, 80);
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-brand-soft text-brand-soft-fg"
          : "border border-border text-fg-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

const actionButton =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg";

/**
 * Neighbor to neighbor. Nothing posted here creates an obligation for the
 * board, which is exactly why it is kept apart from requests.
 */
export function ForumBoard({ moderate }: { moderate?: boolean }) {
  const {
    account,
    addPost,
    likePost,
    replyToPost,
    settings,
    moderatePost,
    togglePinned,
    removePost,
  } = useAppState();
  const { notify } = useToast();
  const readable = useVisiblePosts();
  const pending = usePendingPosts();
  const posts = moderate ? readable.filter((p) => p.status === "published") : readable;

  const [filter, setFilter] = useState<ForumCategory | "All">("All");
  const [composing, setComposing] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ForumCategory>("General");
  const [openPost, setOpenPost] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(() => new Set());
  const [draftReply, setDraftReply] = useState("");
  const [replyNote, setReplyNote] = useState<string | null>(null);

  const visible = useMemo(() => {
    const rows = filter === "All" ? posts : posts.filter((p) => p.category === filter);
    return [...rows].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return a.at < b.at ? 1 : -1;
    });
  }, [posts, filter]);

  if (!settings.forumEnabled) {
    return (
      <EmptyState
        icon={<MessageSquareText className="size-5" />}
        title="Community is switched off"
        description="An admin can turn it back on in community settings."
      />
    );
  }

  const isResident = account?.role === "resident";

  function resetComposer() {
    setBody("");
    setCategory("General");
    setComposing(false);
  }

  function submit() {
    const text = body.trim();
    if (!text || !account) return;
    const post: ForumPost = {
      id: `fp-${Date.now()}`,
      author: account.name,
      unit: account.unit,
      authorRole: isResident ? undefined : ROLE_LABEL[account.role],
      category,
      // Board members publish straight away. Everyone else waits for a moderator.
      status: isResident ? "pending" : "published",
      moderatedBy: isResident ? undefined : account.name,
      moderatedAt: isResident ? undefined : todayIsoDate(),
      title: titleFrom(text),
      body: text,
      at: todayIsoDate(),
      likes: 0,
      replies: [],
    };
    addPost(post);
    resetComposer();
    notify(isResident ? "Sent to the board for review" : "Posted", "ok");
  }

  function like(id: string) {
    if (liked.has(id)) return;
    likePost(id);
    setLiked((prev) => new Set(prev).add(id));
  }

  function toggleThread(id: string) {
    setOpenPost((cur) => (cur === id ? null : id));
    setDraftReply("");
    setReplyNote(null);
  }

  function sendReply(id: string) {
    const ok = replyToPost(id, draftReply);
    if (ok) {
      setDraftReply("");
      setReplyNote(null);
    } else if (draftReply.trim()) {
      setReplyNote(id);
    }
  }

  return (
    <div className="animate-rise space-y-5">
      <div>
        {/* The board page sits beside 28px page titles; the resident page keeps
            the phone scale. */}
        <h1
          className={cn(
            "font-semibold tracking-[-0.025em] text-fg",
            moderate ? "text-[28px]" : "text-[24px]",
          )}
        >
          Community
        </h1>
        <p className="mt-1 text-[15px] text-fg-muted">
          {pluralize(posts.length, "post")} from your neighbors
        </p>
      </div>

      {account ? (
        <Card className="p-3">
          <div className="flex items-start gap-3">
            <Avatar name={account.name} tone={isResident ? "neutral" : "brand"} />
            <div className="min-w-0 flex-1">
              <textarea
                rows={composing ? 4 : 1}
                value={body}
                onFocus={() => setComposing(true)}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Share something with your neighbors"
                className="mt-1 w-full resize-none bg-transparent text-[15px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
              />
              {composing ? (
                <>
                  <div className="no-scrollbar -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
                    {forumCategories.map((c) => (
                      <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                        {c}
                      </Chip>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <p className="text-[13px] text-fg-subtle">
                      {isResident ? "A board member reviews it first." : "Posts right away."}
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={resetComposer}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" disabled={!body.trim()} onClick={submit}>
                        <Send className="size-3.5" />
                        Post
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {moderate && pending.length > 0 ? (
        <Card as="section" className="divide-y divide-border">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <span className="text-[13px] font-semibold text-fg">Waiting for review</span>
            <span className="text-[13px] text-fg-subtle">{pending.length}</span>
          </div>
          {pending.map((post) => (
            <div key={post.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar name={post.author} tone="neutral" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                  <span className="font-semibold text-fg">{post.author}</span>
                  <span className="text-fg-subtle">
                    Unit {post.unit} · {post.category} · {when(post.at)}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[15px] leading-relaxed text-fg-muted">
                  {post.body || post.title}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const undo = moderatePost(post.id, "published");
                    notify(`Published ${post.author}'s post`, "ok", { label: "Undo", onClick: undo });
                  }}
                >
                  <Check className="size-3.5" />
                  Publish
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const undo = moderatePost(post.id, "rejected", "Does not fit the community rules");
                    notify(`Rejected ${post.author}'s post`, "warn", { label: "Undo", onClick: undo });
                  }}
                >
                  <X className="size-3.5" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {(["All", ...forumCategories] as const).map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="size-5" />}
          title="Nothing here yet"
          description="Be the first to post in this category."
        />
      ) : null}

      <div className="space-y-3">
        {visible.map((p) => {
          const expanded = openPost === p.id;
          const showTitle = p.title && !p.body.startsWith(p.title);
          const isLiked = liked.has(p.id);
          return (
            <Card key={p.id} as="article">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={p.author} tone={p.authorRole ? "brand" : "neutral"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                      <span className="font-semibold text-fg">{p.author}</span>
                      {p.authorRole ? (
                        <Badge tone="brand">
                          <ShieldCheck className="size-2.5" />
                          {p.authorRole}
                        </Badge>
                      ) : null}
                      {p.pinned ? (
                        <Pin className="size-3 text-fg-subtle" aria-label="Pinned" />
                      ) : null}
                    </div>
                    <p className="text-[13px] text-fg-subtle">
                      Unit {p.unit} · {when(p.at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {p.status === "pending" ? <Badge tone="warn">In review</Badge> : null}
                    <Badge tone="neutral">{p.category}</Badge>
                  </div>
                </div>

                {showTitle ? (
                  <h2 className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                    {p.title}
                  </h2>
                ) : null}
                <p
                  className={cn(
                    "whitespace-pre-line text-[15px] leading-relaxed text-fg",
                    showTitle ? "mt-1" : "mt-3",
                    !expanded && "line-clamp-4",
                  )}
                >
                  {p.body}
                </p>
              </div>

              <div className="flex items-center gap-1 border-t border-border px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => like(p.id)}
                  aria-pressed={isLiked}
                  className={cn(actionButton, isLiked && "text-danger hover:text-danger")}
                >
                  <Heart className={cn("size-4", isLiked && "fill-current")} />
                  {p.likes}
                </button>
                <button
                  type="button"
                  onClick={() => toggleThread(p.id)}
                  aria-expanded={expanded}
                  className={actionButton}
                >
                  <MessageCircle className="size-4" />
                  {p.replies.length}
                  <span className="sr-only">{pluralize(p.replies.length, "reply", "replies")}</span>
                </button>
                <button type="button" onClick={() => toggleThread(p.id)} className={actionButton}>
                  Reply
                </button>
                {moderate ? (
                  <span className="ml-auto flex gap-1">
                    <button type="button" onClick={() => togglePinned(p.id)} className={actionButton}>
                      {p.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const undo = removePost(p.id);
                        notify(`Removed ${p.author}'s post`, "warn", { label: "Undo", onClick: undo });
                      }}
                      className={cn(actionButton, "text-danger hover:bg-danger-soft hover:text-danger")}
                    >
                      Remove
                    </button>
                  </span>
                ) : null}
              </div>

              {expanded ? (
                <div className="space-y-3 border-t border-border bg-surface-2 px-4 py-3">
                  {p.replies.map((r) => (
                    <div key={r.id} className="flex items-start gap-2.5">
                      <Avatar
                        name={r.author}
                        tone={r.authorRole ? "brand" : "neutral"}
                        className="size-7 text-[11px]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                          <span className="font-semibold text-fg">{r.author}</span>
                          {r.authorRole ? <Badge tone="brand">{r.authorRole}</Badge> : null}
                          <span className="text-fg-subtle">
                            {r.unit ? `${placeLabel(r.unit)} · ` : ""}
                            {when(r.at)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[15px] leading-relaxed text-fg">{r.body}</p>
                      </div>
                    </div>
                  ))}
                  {account ? (
                    <form
                      className="flex items-center gap-2.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        sendReply(p.id);
                      }}
                    >
                      <Avatar
                        name={account.name}
                        tone={isResident ? "neutral" : "brand"}
                        className="size-7 text-[11px]"
                      />
                      <input
                        value={draftReply}
                        onChange={(e) => setDraftReply(e.target.value)}
                        placeholder="Write a reply"
                        aria-label="Write a reply"
                        className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-border-2"
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={!draftReply.trim()}
                        aria-label="Send reply"
                      >
                        <Send className="size-3.5" />
                      </Button>
                    </form>
                  ) : null}
                  {replyNote === p.id ? (
                    <p className="text-[13px] text-fg-subtle">
                      Replies are not saved for this community yet.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="text-[13px] text-fg-subtle">
        Need a board decision? Send a request instead. Posts here carry no deadline.
      </p>
    </div>
  );
}
