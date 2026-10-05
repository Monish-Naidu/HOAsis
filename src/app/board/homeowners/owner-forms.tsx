"use client";

import { useState } from "react";
import { Button, Field, fieldClass } from "@/components/ui/primitives";

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
