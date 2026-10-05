"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Pin, Send } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { Badge, Button, Card, CardHeader, Checkbox, PageHeader, fieldClass, textareaClass } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { DuesMailer } from "@/components/app/dues-mailer";
import { useToast } from "@/components/app/toast";
import { cn, formatDate, pluralize } from "@/lib/utils";

/**
 * Messages, the announcements tab: what the board says to every home at once.
 *
 * Split from the inbox on 2026-09-24. A one-to-many notice and a one-to-one
 * reply are different jobs, and on one page the composer for the first sat
 * above the conversations for the second. The dues email lives here too,
 * because it is the same kind of thing: one message, every owner.
 */
export default function BoardAnnouncements() {
  // `?new=1` opens the composer, for the links that promise to.
  return (
    <Suspense fallback={null}>
      <AnnouncementsScreen />
    </Suspense>
  );
}

function AnnouncementsScreen() {
  const params = useSearchParams();
  const [composing, setComposing] = useState(params.get("new") === "1");

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Posted to every resident's home screen."
        action={
          composing ? undefined : (
            <Button variant="primary" size="md" onClick={() => setComposing(true)}>
              <Send className="size-3.5" />
              New announcement
            </Button>
          )
        }
      />

      <AnnouncementsManager composing={composing} setComposing={setComposing} />

      <DuesMailer />
    </>
  );
}

/**
 * What every resident's home screen carries under "From the board".
 *
 * Announcements used to exist only as demo fixtures. Now the board writes
 * them here, they persist, and removing one takes it off every resident's
 * screen the same moment.
 */
function AnnouncementsManager({
  composing,
  setComposing,
}: {
  composing: boolean;
  setComposing: (open: boolean) => void;
}) {
  const { community, addAnnouncement, removeAnnouncement, isRemote } = useAppState();
  const { notify } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // Every announcement is a notice until a board asks for kinds. The picker
  // was the one field on this form nobody could answer.
  const category: Announcement["category"] = "Notice";
  const [pinned, setPinned] = useState(false);

  const announcements = [...community.announcements].sort((a, b) =>
    a.postedDate < b.postedDate ? 1 : -1,
  );

  function post() {
    if (!title.trim() || !body.trim()) {
      notify("Add a title and a message before you post", "warn");
      return;
    }
    addAnnouncement({ title: title.trim(), body: body.trim(), category, pinned });
    setTitle("");
    setBody("");
    setPinned(false);
    setComposing(false);
    // A real association's announcement also goes out by email, and the
    // screen never said so: one press mailed every owner unannounced.
    notify(
      isRemote
        ? "Posted, and emailed to every owner with an address."
        : "Posted. Every resident's home screen carries it now.",
    );
  }

  return (
    <Card id="announcements" className="scroll-mt-32 lg:scroll-mt-24">
      <CardHeader
        title={composing ? "New announcement" : pluralize(announcements.length, "announcement")}
        subtitle="What every home sees under From the board"
      />

      {composing ? (
        <form
          className="space-y-3 border-b border-border bg-surface-2 px-5 py-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex flex-wrap gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              aria-label="Announcement title"
              className={cn(fieldClass, "min-w-0 flex-1")}
            />
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What should every household know?"
            aria-label="Announcement body"
            rows={3}
            className={textareaClass}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-footnote font-medium text-fg-muted">
              <Checkbox checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              Pin to the top of the home screen
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" onClick={post}>
                Post announcement
              </Button>
            </div>
          </div>
          {isRemote ? (
            <p className="text-footnote text-fg-muted">
              Posting also emails it to every owner with an address.
            </p>
          ) : null}
        </form>
      ) : null}

      {announcements.length === 0 && !composing ? (
        <p className="px-5 py-6 text-center text-body text-fg-muted">
          Nothing posted yet. The first announcement most boards write is how dues are billed.
        </p>
      ) : null}
      {announcements.map((a) => (
        <div
          key={a.id}
          className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-body font-medium text-fg">{a.title}</p>
              {a.pinned ? (
                <Badge tone="brand">
                  <Pin className="size-2.5" />
                  Pinned
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 line-clamp-2 text-footnote leading-snug text-fg-muted">{a.body}</p>
            <p className="mt-1 text-footnote text-fg-subtle">
              {a.author} · {formatDate(a.postedDate)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              removeAnnouncement(a.id);
              notify("Announcement removed", "warn");
            }}
            className="shrink-0 rounded-md px-2 py-1 text-footnote font-medium text-fg-muted hover:bg-surface-2 hover:text-danger"
          >
            Remove
          </button>
        </div>
      ))}
    </Card>
  );
}

