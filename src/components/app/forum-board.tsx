"use client";

import { useMemo, useState } from "react";
import {
  Heart,
  MessageSquare,
  MessageSquareText,
  Pin,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { forumCategories } from "@/lib/data";
import { ROLE_LABEL, type ForumCategory, type ForumPost } from "@/lib/types";
import { cn, formatDate, pluralize } from "@/lib/utils";

/**
 * Neighbour to neighbour. Nothing posted here creates an obligation for the
 * board, which is exactly why it is kept apart from requests.
 */
export function ForumBoard({ moderate }: { moderate?: boolean }) {
  const { posts, account, addPost, likePost, settings } = useAppState();
  const [filter, setFilter] = useState<ForumCategory | "All">("All");
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ForumCategory>("General");
  const [openPost, setOpenPost] = useState<string | null>(null);

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
        title="The forum is switched off"
        description="An admin can turn it back on in community settings."
      />
    );
  }

  function submit() {
    if (!title.trim() || !account) return;
    const post: ForumPost = {
      id: `fp-${Date.now()}`,
      author: account.name,
      unit: account.unit,
      authorRole: account.role === "resident" ? undefined : ROLE_LABEL[account.role],
      category,
      title: title.trim(),
      body: body.trim(),
      at: "2026-08-21",
      likes: 0,
      replies: [],
    };
    addPost(post);
    setTitle("");
    setBody("");
    setComposing(false);
  }

  return (
    <div className="animate-rise space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.025em] text-fg">Forum</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {pluralize(posts.length, "post")} from your neighbours
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setComposing((v) => !v)}>
          {composing ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
          {composing ? "Cancel" : "Post"}
        </Button>
      </div>

      {composing ? (
        <Card className="p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {forumCategories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  category === c
                    ? "bg-navy-900 text-navy-50 dark:bg-navy-100 dark:text-navy-950"
                    : "border border-border text-fg-muted hover:text-fg",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What is this about?"
            className="w-full bg-transparent text-[15px] font-medium text-fg outline-none placeholder:text-fg-subtle"
          />
          <textarea
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add the details"
            className="mt-2 w-full resize-none bg-transparent text-[13px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle"
          />
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
            <p className="text-[11px] text-fg-subtle">
              Posts show your name and unit to other owners.
            </p>
            <Button variant="primary" size="sm" disabled={!title.trim()} onClick={submit}>
              <Send className="size-3.5" />
              Post
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {(["All", ...forumCategories] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
              filter === c
                ? "bg-brand-soft text-brand-soft-fg"
                : "border border-border text-fg-muted hover:text-fg",
            )}
          >
            {c}
          </button>
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
          return (
            <Card key={p.id} className={cn(p.pinned && "border-l-2 border-l-navy-700 dark:border-l-navy-300")}>
              <div className="p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {p.pinned ? (
                    <Badge tone="brand">
                      <Pin className="size-2.5" />
                      Pinned
                    </Badge>
                  ) : null}
                  <Badge tone="neutral">{p.category}</Badge>
                  <span className="text-[11px] text-fg-subtle">{formatDate(p.at, "long")}</span>
                </div>
                <h2 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-fg">
                  {p.title}
                </h2>
                <p
                  className={cn(
                    "mt-1.5 text-[13px] leading-relaxed text-fg-muted",
                    !expanded && "line-clamp-3",
                  )}
                >
                  {p.body}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
                  <span className="font-medium text-fg-muted">
                    {p.author} · Unit {p.unit}
                  </span>
                  {p.authorRole ? (
                    <Badge tone="brand">
                      <ShieldCheck className="size-2.5" />
                      {p.authorRole}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-1 border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={() => likePost(p.id)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                >
                  <Heart className="size-3.5" />
                  {p.likes}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenPost(expanded ? null : p.id)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg"
                >
                  <MessageSquare className="size-3.5" />
                  {p.replies.length}
                </button>
                {moderate ? (
                  <span className="ml-auto flex gap-1">
                    <button className="rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted hover:bg-surface-2 hover:text-fg">
                      {p.pinned ? "Unpin" : "Pin"}
                    </button>
                    <button className="rounded-md px-2 py-1 text-[12px] font-medium text-danger hover:bg-danger-soft">
                      Remove
                    </button>
                  </span>
                ) : null}
              </div>

              {expanded && p.replies.length ? (
                <div className="space-y-3 border-t border-border bg-surface-2 px-4 py-3">
                  {p.replies.map((r) => (
                    <div key={r.id}>
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[12px] font-semibold text-fg">{r.author}</span>
                        <span className="text-[11px] text-fg-subtle">
                          Unit {r.unit} · {formatDate(r.at)}
                        </span>
                        {r.authorRole ? <Badge tone="brand">{r.authorRole}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted">{r.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <SectionTitle>House rules</SectionTitle>
      <p className="text-[12px] leading-relaxed text-fg-subtle">
        Anything that needs a board decision belongs in a request, not here. Requests carry a
        deadline and a record. Forum posts do not.
      </p>
    </div>
  );
}
