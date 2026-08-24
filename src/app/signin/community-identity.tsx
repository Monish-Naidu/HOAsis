"use client";

import { useAppState } from "@/lib/app-state";

/**
 * Sign in is server rendered, but the community name and photo are admin
 * owned and live in client state. These two read that state so renaming the
 * community in settings shows up on the front door too.
 */

export function CommunityBackdrop() {
  const { settings } = useAppState();
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 h-[45dvh] bg-cover bg-center opacity-[0.14] dark:opacity-[0.18]"
      style={{ backgroundImage: `url(${settings.photoUrl})` }}
      aria-hidden
    />
  );
}

export function CommunityMasthead() {
  const { settings, community } = useAppState();
  return (
    <div className="mb-7 text-center">
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] text-fg">
        {settings.displayName}
      </h1>
      <p className="mt-1 text-[13px] text-fg-muted">
        {community.association.addressLine} · {community.association.unitCount} homes
      </p>
    </div>
  );
}
