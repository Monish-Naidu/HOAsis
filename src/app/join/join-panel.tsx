"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, DoorOpen, MailCheck, ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { useAppState, useCommunityById, useStorageReady } from "@/lib/app-state";
import { parseInvitation } from "@/lib/invitations";
import { money } from "@/lib/utils";

/**
 * Two ways in.
 *
 * With an invitation, the household already exists on the register, so this
 * creates nothing: it confirms the link is genuine, shows the person which
 * unit they are about to take, and signs them in. Real auth adds a password
 * or a passkey at exactly this point and changes nothing else on this screen.
 *
 * Without one, the person types the association's code and asks. That puts
 * them in the board's queue and nowhere else; the board adds the home, and
 * the invitation email follows from that. A new owner should not have to
 * find the President's address to get started.
 */
export function JoinPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const { setCommunity, signIn } = useAppState();

  const search = new URLSearchParams(params.toString());
  const invitation = parseInvitation(search);
  const hasToken = search.has("c") || search.has("o") || search.has("k");
  const ready = useStorageReady();
  const community = useCommunityById(invitation?.communityId);
  const owner = community?.owners.find((o) => o.id === invitation?.ownerId);
  const account = community?.accounts.find((a) => a.ownerId === invitation?.ownerId);

  // No token at all: this is somebody at the door, not somebody with a key.
  if (!hasToken) {
    return <AskToJoin code={search.get("code") ?? ""} />;
  }

  // Storage has not been read yet, so nothing is missing, it is just not here.
  if (invitation && !ready) {
    return <Card className="h-40 animate-pulse bg-surface-2" aria-label="Loading invitation" />;
  }

  if (!invitation || !community || !owner || !account) {
    return (
      <Card className="p-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          This invitation is not valid
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          The link may have been mistyped or the household may no longer be on the register. Ask
          your board to send it again, or ask to join with the association&apos;s code.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/join"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg hover:opacity-90"
          >
            Ask to join
          </Link>
          <Link
            href="/signin"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border-2 px-4 text-[15px] font-semibold text-fg hover:bg-surface-2"
          >
            Go to sign in
          </Link>
        </div>
      </Card>
    );
  }

  function accept() {
    setCommunity(community!.id);
    signIn(account!.id);
    router.push("/resident");
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-6 py-5">
        <p className="text-[13px] font-semibold text-fg-muted">
          You have been invited to
        </p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {community.settings.displayName}
        </h1>
        <p className="mt-1 text-[15px] text-fg-muted">{community.association.addressLine}</p>
      </div>

      <div className="space-y-3 px-6 py-5">
        <Row label="Household" value={owner.displayName} />
        <Row label="Unit" value={owner.unit} />
        <Row
          label="Assessment"
          value={`${money(community.association.duesCents)} ${community.association.duesCadence}`}
        />

        <Button variant="primary" size="md" className="mt-2 w-full" onClick={accept}>
          Open my account
          <ArrowRight className="size-4" />
        </Button>

        <p className="flex items-start gap-2 pt-1 text-[13px] leading-snug text-fg-subtle">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          This link was issued for your unit. Your board sees your balance and your requests;
          neighbors do not.
        </p>
      </div>
    </Card>
  );
}

const field =
  "h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none placeholder:text-fg-subtle focus:border-brand";
const label = "mb-1 block text-[13px] font-semibold text-fg-muted";

function AskToJoin({ code: initialCode }: { code: string }) {
  const { requestToJoin } = useAppState();
  const [code, setCode] = useState(initialCode.toUpperCase().slice(0, 6));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const ready = code.trim().length >= 4 && name.trim().length > 0 && email.includes("@");

  async function submit() {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await requestToJoin({ code, name, email, unit, note });
    setBusy(false);
    if (result.ok) setSentTo(result.association);
    else setError(result.error);
  }

  if (sentTo) {
    return (
      <Card className="p-6">
        <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-ok-soft text-ok">
          <MailCheck className="size-5" />
        </span>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">Sent to {sentTo}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          The board will add your home and you will get an email at {email.trim()} to sign in.
          Nothing else to do for now.
        </p>
        <Link
          href="/signin"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-border-2 px-4 text-[15px] font-semibold text-fg hover:bg-surface-2"
        >
          Go to sign in
        </Link>
      </Card>
    );
  }

  return (
    <Card
      as="form"
      className="overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="border-b border-border px-6 py-5">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-muted">
          <DoorOpen className="size-3.5" />
          Ask to join
        </p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          Your association&apos;s code
        </h1>
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
          It is six characters, on the welcome letter or from anyone on the board. Your request
          goes to them, and they add your home.
        </p>
      </div>

      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className={label}>Code</span>
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))
            }
            placeholder="A1B2C3"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className={`${field} font-mono tracking-[0.2em]`}
            autoFocus={!initialCode}
          />
        </label>
        <label className="block">
          <span className={label}>Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Priya Ellison"
            className={field}
            autoFocus={Boolean(initialCode)}
          />
        </label>
        <label className="block">
          <span className={label}>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className={field}
          />
          <span className="mt-1 block text-[13px] leading-snug text-fg-subtle">
            The sign-in link comes here once the board says yes.
          </span>
        </label>
        <label className="block">
          <span className={label}>Your home (optional)</span>
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Unit or lot number, or the street address"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Anything the board should know (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="We closed on the 14th. The seller said to ask here."
            className="w-full rounded-lg border border-border-2 bg-surface px-3 py-2 text-[15px] leading-relaxed text-fg outline-none placeholder:text-fg-subtle focus:border-brand"
          />
        </label>

        {error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="md" className="w-full" disabled={!ready || busy}>
          {busy ? "Sending" : "Ask to join"}
          <ArrowRight className="size-4" />
        </Button>

        <p className="text-center text-[13px] text-fg-subtle">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-fg-muted">{label}</span>
      <span className="text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}
