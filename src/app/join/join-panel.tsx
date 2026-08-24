"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { useAppState, useCommunityById, useStorageReady } from "@/lib/app-state";
import { parseInvitation } from "@/lib/invitations";
import { money } from "@/lib/utils";

/**
 * Claiming an account from an invitation.
 *
 * The household already exists on the register, so this does not create
 * anything. It confirms the link is genuine, shows the person which unit they
 * are about to take, and signs them in. Real auth adds a password or a passkey
 * at exactly this point and changes nothing else on this screen.
 */
export function JoinPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const { setCommunity, signIn } = useAppState();

  const invitation = parseInvitation(new URLSearchParams(params.toString()));
  const ready = useStorageReady();
  const community = useCommunityById(invitation?.communityId);
  const owner = community?.owners.find((o) => o.id === invitation?.ownerId);
  const account = community?.accounts.find((a) => a.ownerId === invitation?.ownerId);

  // Storage has not been read yet, so nothing is missing, it is just not here.
  if (invitation && !ready) {
    return <Card className="h-40 animate-pulse bg-surface-2" aria-label="Loading invitation" />;
  }

  if (!invitation || !community || !owner || !account) {
    return (
      <Card className="p-6">
        <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-fg">
          This invitation is not valid
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          The link may have been mistyped or the household may no longer be on the register. Ask
          your board to send it again.
        </p>
        <Link
          href="/signin"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-border-2 px-4 text-[13px] font-semibold text-fg hover:bg-surface-2"
        >
          Go to sign in
        </Link>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
          You have been invited to
        </p>
        <h1 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {community.settings.displayName}
        </h1>
        <p className="mt-1 text-[13px] text-fg-muted">{community.association.addressLine}</p>
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

        <p className="flex items-start gap-2 pt-1 text-[11px] leading-snug text-fg-subtle">
          <ShieldCheck className="mt-px size-3.5 shrink-0" />
          This link was issued for your unit. Your board sees your balance and your requests;
          neighbors do not.
        </p>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12px] text-fg-muted">{label}</span>
      <span className="text-[13px] font-medium text-fg">{value}</span>
    </div>
  );
}
