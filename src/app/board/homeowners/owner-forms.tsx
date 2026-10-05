"use client";

import { useState } from "react";
import { Button, Field, fieldClass } from "@/components/ui/primitives";
import { firstName, removeConfirmText, type OwnerSeat } from "@/lib/co-owners";

const looksLikeEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

/**
 * Corrects the address a household's owner will claim their seat with.
 * The line under the field says what it does, because the board cannot see
 * the other side: the owner signs in with this address, so it must be the
 * one they will use.
 */
export function ChangeEmailForm({
  current,
  onSave,
  onCancel,
}: {
  current: string;
  onSave: (email: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(current);
  const [busy, setBusy] = useState(false);
  const changed = email.trim().toLowerCase() !== current.trim().toLowerCase();
  return (
    <form
      className="mt-4 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed || !looksLikeEmail(email) || busy) return;
        setBusy(true);
        void onSave(email.trim())
          .then((ok) => ok && onCancel())
          .finally(() => setBusy(false));
      }}
    >
      <Field
        label="Owner email"
        hint="They sign up with this address, or press their invitation link again, to open their home."
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="New owner email"
          className={fieldClass}
          autoFocus
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !changed || !looksLikeEmail(email)}>
          Save email
        </Button>
      </div>
    </form>
  );
}

/** A second person on the same home, with their own sign in. Same bill, same vote. */
export function SecondOwnerForm({
  unit,
  onSave,
  onCancel,
}: {
  unit: string;
  onSave: (name: string, email: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = name.trim().length > 0 && looksLikeEmail(email);
  return (
    <form
      className="mt-4 space-y-2 border-t border-border pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready || busy) return;
        setBusy(true);
        void onSave(name.trim(), email.trim())
          .then((ok) => ok && onCancel())
          .finally(() => setBusy(false));
      }}
    >
      <p className="text-footnote font-semibold text-fg-muted">Second owner of {unit}</p>
      <p className="text-footnote text-fg-muted">
        They get their own sign in. The home keeps one balance and one vote.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Second owner name"
            className={fieldClass}
            autoFocus
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email, so they can sign in"
            aria-label="Second owner email"
            className={fieldClass}
          />
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={busy || !ready}>
          Add second owner
        </Button>
      </div>
    </form>
  );
}

/**
 * The two people on a home, each with a quiet way to take them off it.
 *
 * Only offered where the person's seat may be ended (see removableSeats), and
 * always behind a confirm that says who loses access and who stays, because
 * ending a seat also removes the payment methods that person saved.
 */
export function PeopleOnHome({
  people,
  removable,
  homeLabel,
  onRemove,
}: {
  people: OwnerSeat[];
  removable: OwnerSeat[];
  homeLabel: string;
  onRemove: (seat: OwnerSeat) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState<OwnerSeat | null>(null);
  const [busy, setBusy] = useState(false);
  const others = confirming ? people.filter((p) => p.id !== confirming.id) : [];
  return (
    <div className="py-1.5">
      <dt className="text-body text-fg-muted">On title</dt>
      <dd className="mt-1 space-y-1">
        {people.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-body text-fg">{p.name}</span>
            {removable.some((r) => r.id === p.id) && confirming?.id !== p.id ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(p)}
                aria-label={`Remove ${p.name} from ${homeLabel}`}
              >
                Remove {firstName(p.name)}
              </Button>
            ) : null}
          </div>
        ))}
        {confirming ? (
          <div role="group" aria-label={`Remove ${confirming.name}`} className="mt-2 space-y-2 border-t border-border pt-2">
            <p className="text-footnote text-fg-muted">
              {removeConfirmText(confirming.name, others.map((o) => o.name).join(" and "), homeLabel)}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void onRemove(confirming)
                    .then((ok) => ok && setConfirming(null))
                    .finally(() => setBusy(false));
                }}
              >
                Remove {firstName(confirming.name)}
              </Button>
            </div>
          </div>
        ) : null}
      </dd>
    </div>
  );
}
