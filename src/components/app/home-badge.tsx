"use client";

import { useRef } from "react";
import Link from "next/link";
import { Camera, ChevronRight, Home as HomeIcon } from "lucide-react";
import { useAppState, useCurrentOwner, useHomePhoto } from "@/lib/app-state";
import { shrinkImage } from "@/lib/home-photo";
import { useToast } from "@/components/app/toast";
import { HOME_TYPE_LABEL, isMixed } from "@/lib/home-types";
import { homeLabel } from "@/lib/wording";

/**
 * The resident's home, inlaid on the community banner.
 *
 * A dark translucent card on the banner with the home photo as a rounded
 * square, per Monish's reference of 2026-09-03: the picture is the card's
 * subject, and the rest is a caption. The photo resolves through `useHomePhoto`: what the
 * owner uploaded in this browser, then the seeded photo of their home, then
 * the community's cover. Uploading here stores the same picture the Account
 * card shows; the two never disagree.
 */
export function HomeBadge() {
  const { settings, community } = useAppState();
  const owner = useCurrentOwner();
  // In a mixed community the kind of home is part of what the home is.
  const kind =
    isMixed(community.profile) && owner?.homeType ? HOME_TYPE_LABEL[owner.homeType].one : null;
  const { photo, uploaded, setPhoto } = useHomePhoto();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement>(null);
  if (!owner) return null;

  async function choose(file: File) {
    try {
      setPhoto(await shrinkImage(file));
      notify("Home photo added", "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not read that image", "warn");
    }
  }

  return (
    <div className="flex max-w-md items-center gap-4 rounded-2xl bg-navy-950/55 p-3 pr-5 text-white shadow-float ring-1 ring-white/10 backdrop-blur-md">
      <div className="relative shrink-0">
        {photo ? (
          <div
            className="size-24 rounded-xl bg-cover bg-center ring-1 ring-white/20 sm:size-28"
            style={{ backgroundImage: `url(${photo})` }}
            role="img"
            aria-label={uploaded ? "Your home" : "Your home, community photo"}
          />
        ) : (
          // No photo of the home and none of the community yet: a tile that
          // says so, with the camera button as the invitation.
          <div
            className="flex size-24 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 sm:size-28"
            role="img"
            aria-label="No photo of your home yet"
          >
            <HomeIcon className="size-8 text-white/60" strokeWidth={1.6} />
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-label={uploaded ? "Change the photo of your home" : "Add a photo of your home"}
          title={uploaded ? "Change the photo of your home" : "Add a photo of your home"}
          className="absolute -bottom-1.5 -right-1.5 flex size-9 items-center justify-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur transition-colors hover:bg-black/80"
        >
          <Camera className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        {/* The home, not the person: the rail and the bar already say who
            is signed in, and a third name on the same screen read as
            clutter (Monish, 2026-09-26). */}
        <p className="truncate text-headline font-semibold tracking-[-0.015em] sm:text-title3">
          {owner.address}
        </p>
        <p className="mt-0.5 truncate text-body text-white/90">
          {homeLabel(community, owner.unit)}
          {kind ? ` · ${kind}` : ""}
        </p>
        <p className="truncate text-footnote text-white/70">{settings.displayName}</p>
        <div className="mt-2 flex items-center gap-3">
          <Link
            href="/resident/account"
            className="inline-flex items-center gap-0.5 text-footnote font-semibold text-[#8fc0ff] hover:underline"
          >
            View home details
            <ChevronRight className="size-3.5" />
          </Link>
          {uploaded ? (
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                notify("Photo removed");
              }}
              className="text-footnote font-medium text-white/80 underline underline-offset-2 hover:text-white"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
