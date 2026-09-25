"use client";

import { useAppState } from "@/lib/app-state";
import { pluralize } from "@/lib/utils";

/**
 * Sign in is server rendered, but the community name and photo are admin
 * owned and live in client state. These read that state so renaming the
 * community in settings shows up on the front door too.
 */

/**
 * The photograph, at full strength, on its own half of the page.
 *
 * It used to be a backdrop behind the form at 14% opacity, which is not a
 * photograph, it is a smudge: too faint to recognise a place and too busy to
 * be a clean ground. Giving it a column lets it be the thing it is, and lets
 * the form sit on a plain surface where a form belongs.
 *
 * Hidden below the large breakpoint, where there is no width to spend.
 */
export function CommunityPanel() {
  const { settings, community } = useAppState();
  return (
    // Pinned to the viewport rather than stretched by the grid. The form column
    // scrolls well past one screen, and a stretched aside puts the community
    // name at the bottom of that scroll height, which is nowhere anyone looks.
    <aside className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-dvh">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${settings.photoUrl})` }}
        aria-hidden
      />
      {/* Dark at the foot, clear at the head, so the type has contrast without
          flattening the whole image. */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-950/35 to-navy-950/10"
        aria-hidden
      />
      <div className="relative flex h-full flex-col justify-end p-10 xl:p-14">
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.035em] text-white xl:text-[52px]">
          {settings.displayName}
        </h1>
        <p className="mt-3 text-headline text-white/75">
          {community.association.addressLine} · {pluralize(community.association.unitCount, "home")}
        </p>
        {settings.photoCredit ? (
          <p className="mt-8 text-footnote text-white/45">Photo, {settings.photoCredit}</p>
        ) : null}
      </div>
    </aside>
  );
}

/** The same identity, stacked above the form, for phones and tablets. */
export function CommunityMasthead() {
  const { settings, community } = useAppState();
  return (
    <div className="mb-7 lg:hidden">
      <h1 className="text-title1 font-semibold tracking-[-0.03em] text-fg">
        {settings.displayName}
      </h1>
      <p className="mt-1 text-body text-fg-muted">
        {community.association.addressLine} · {pluralize(community.association.unitCount, "home")}
      </p>
    </div>
  );
}
