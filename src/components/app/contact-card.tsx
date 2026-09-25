"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Card, SectionTitle, fieldClass } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/components/app/toast";

/**
 * How the association reaches this owner.
 *
 * The roster showed a phone and a mailing address and gave nobody a way to
 * set them, so every real association's roster carried blanks. The owner
 * keeps their own, because the board copying it from an email is how it
 * ends up wrong. A statutory notice goes to the mailing address, which is
 * often not the home, so it is its own field rather than assumed.
 */
export function ContactCard() {
  const owner = useCurrentOwner();
  const { updateMyContact } = useAppState();
  // The roster carries the invited address; the person who founded the
  // association was never invited, so their own is the one they signed in with.
  const auth = useAuth();
  const email = owner?.email || auth.user?.email || "";
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(owner?.phone ?? "");
  const [mailing, setMailing] = useState(owner?.mailingAddress ?? "");

  if (!owner) return null;

  const field =
    fieldClass;

  function save() {
    void updateMyContact({ phone: phone.trim(), mailingAddress: mailing.trim() }).then((ok) => {
      if (!ok) return;
      setEditing(false);
      notify("Contact details saved. The board sees them on your record.");
    });
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <SectionTitle>How to reach you</SectionTitle>
        {editing ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhone(owner.phone);
              setMailing(owner.mailingAddress ?? "");
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}
      </div>
      <Card
        as="form"
        className="mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {editing ? (
          <div className="space-y-4 px-4 py-4">
            <label className="block">
              <span className="mb-1 block text-footnote font-semibold text-fg-muted">Phone</span>
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(937) 555-0140"
                className={field}
                autoFocus
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-footnote font-semibold text-fg-muted">
                Mailing address, if not the home
              </span>
              <input
                autoComplete="street-address"
                value={mailing}
                onChange={(e) => setMailing(e.target.value)}
                placeholder="PO Box 210, Dayton, OH 45401"
                className={field}
              />
              <span className="mt-1 block text-footnote leading-snug text-fg-subtle">
                Anything the association must send on paper goes here.
              </span>
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="md">
                Save
              </Button>
              <Button variant="ghost" size="md" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <dl className="divide-y divide-border">
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-footnote text-fg-muted">Email</dt>
              <dd className="min-w-0 truncate text-right text-body text-fg">
                {email || "Not on file"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-footnote text-fg-muted">Phone</dt>
              <dd className="text-right text-body text-fg">{owner.phone || "Not on file"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-footnote text-fg-muted">Mail goes to</dt>
              <dd className="min-w-0 text-right text-body text-fg">
                {owner.mailingAddress || owner.address || "The home"}
              </dd>
            </div>
          </dl>
        )}
      </Card>
    </div>
  );
}
