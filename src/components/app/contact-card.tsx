"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button, Card, SectionTitle, fieldClass } from "@/components/ui/primitives";
import { useAppState, useCurrentHome } from "@/lib/app-state";
import { requestEmailChange, useAuth } from "@/lib/auth";
import { checkNewEmail, emailChangeSent } from "@/lib/email-change";
import { checkPhone } from "@/lib/input-checks";
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
  const home = useCurrentHome();
  const { updateMyContact, isRemote } = useAppState();
  // The roster carries the invited address; the person who founded the
  // association was never invited, so their own is the one they signed in with.
  const auth = useAuth();
  const email = home?.email || auth.user?.email || "";
  const { notify } = useToast();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(home?.phone ?? "");
  const [mailing, setMailing] = useState(home?.mailingAddress ?? "");
  const [phoneProblem, setPhoneProblem] = useState<string | null>(null);

  if (!home) return null;

  const field =
    fieldClass;

  function save() {
    const checked = checkPhone(phone);
    if (!checked.ok) {
      setPhoneProblem(checked.message);
      return;
    }
    setPhoneProblem(null);
    void updateMyContact({ phone: checked.phone, mailingAddress: mailing.trim() }).then((ok) => {
      if (!ok) return;
      setEditing(false);
      notify("Contact details saved. The board sees them on your record.");
    });
  }

  return (
    <div className="space-y-6">
      <SignInEmail email={email} isRemote={isRemote} />
      <div>
      <div className="flex items-end justify-between gap-3">
        <SectionTitle>How to reach you</SectionTitle>
        {editing ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPhone(home.phone);
              setMailing(home.mailingAddress ?? "");
              setPhoneProblem(null);
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
                maxLength={25}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setPhoneProblem(null);
                }}
                placeholder="(425) 555-0142"
                aria-invalid={phoneProblem ? true : undefined}
                className={field}
                autoFocus
              />
              {phoneProblem ? (
                <span role="alert" className="mt-1 block text-footnote text-danger">
                  {phoneProblem}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="mb-1 block text-footnote font-semibold text-fg-muted">
                Mailing address, if not the home
              </span>
              <input
                autoComplete="street-address"
                value={mailing}
                onChange={(e) => setMailing(e.target.value)}
                placeholder="PO Box 210, Bothell, WA 98011"
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
              <dt className="text-footnote text-fg-muted">Phone</dt>
              <dd className="text-right text-body text-fg">{home.phone || "Not on file"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 px-4 py-3">
              <dt className="text-footnote text-fg-muted">Mail goes to</dt>
              <dd className="min-w-0 text-right text-body text-fg">
                {home.mailingAddress || home.address || "The home"}
              </dd>
            </div>
          </dl>
        )}
      </Card>
      </div>
    </div>
  );
}

/**
 * The address this person signs in with, and the way to change it.
 *
 * Supabase Auth owns the address: it mails a link to the new one and
 * changes the account only when that link is opened, so nothing here
 * pretends the change has happened. The demo has no account behind it, so
 * it says so rather than faking one.
 */
function SignInEmail({ email, isRemote }: { email: string; isRemote: boolean }) {
  const [changing, setChanging] = useState(false);
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function submit() {
    if (!isRemote) {
      setProblem("This is a demo. Sign in to your own association to change your email.");
      return;
    }
    const checked = checkNewEmail(next, email);
    if (!checked.ok) {
      setProblem(checked.message);
      return;
    }
    setBusy(true);
    setProblem(null);
    void requestEmailChange(checked.email)
      .then((result) => {
        if (!result.ok) {
          setProblem(result.message ?? "We could not send that. Try again in a minute.");
          return;
        }
        setSentTo(checked.email);
        setChanging(false);
        setNext("");
      })
      .finally(() => setBusy(false));
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <SectionTitle>Email</SectionTitle>
        {changing ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProblem(null);
              setSentTo(null);
              setChanging(true);
            }}
          >
            Change
          </Button>
        )}
      </div>
      <Card className="mt-2">
        <div className="px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <p className="text-footnote text-fg-muted">Sign in with</p>
            <p className="min-w-0 truncate text-right text-body text-fg">{email || "Not on file"}</p>
          </div>
          {changing ? (
            <form
              className="mt-3 space-y-3 border-t border-border pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <label className="block">
                <span className="mb-1 block text-footnote font-semibold text-fg-muted">New email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  className={fieldClass}
                  autoFocus
                />
              </label>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="md" disabled={busy || !next.trim()}>
                  Send confirmation
                </Button>
                <Button type="button" variant="ghost" size="md" onClick={() => setChanging(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          {problem ? (
            <p role="alert" className="mt-2 text-footnote leading-snug text-danger">
              {problem}
            </p>
          ) : null}
          {sentTo ? (
            <p role="status" className="mt-2 text-footnote leading-snug text-fg-muted">
              {emailChangeSent(sentTo, email)}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
