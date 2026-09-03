"use client";

import { useRef } from "react";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { useAppState, useCurrentOwner, useHomePhoto } from "@/lib/app-state";
import { shrinkImage } from "@/lib/home-photo";
import { useToast } from "@/components/app/toast";

/**
 * The resident's home, inlaid on the community banner.
 *
 * A floating card with the home photo in a ring, the way a profile avatar
 * sits on a cover photo. The photo resolves through `useHomePhoto`: what the
 * owner uploaded in this browser, then the seeded photo of their home, then
 * the community's cover. Uploading here stores the same picture the Account
 * card shows; the two never disagree.
 */
export function HomeBadge() {
  const { settings } = useAppState();
  const owner = useCurrentOwner();
  const { photo, uploaded, setPhoto } = useHomePhoto();
  const { notify } = useToast();
  const input = useRef<HTMLInputElement>(null);
  if (!owner || !photo) return null;

  async function choose(file: File) {
    try {
      setPhoto(await shrinkImage(file));
      notify("Home photo added", "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not read that image", "warn");
    }
  }

  return (
    <div className="flex max-w-sm items-center gap-3.5 rounded-2xl bg-surface p-3 pr-5 shadow-float">
      <div className="relative shrink-0">
        <div
          className="size-16 rounded-full bg-cover bg-center ring-2 ring-white"
          style={{ backgroundImage: `url(${photo})` }}
          role="img"
          aria-label={uploaded ? "Your home" : "Your home, community photo"}
        />
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
          className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-surface text-fg-muted shadow-raised ring-1 ring-border transition-colors hover:text-fg"
        >
          <Camera className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-fg-subtle">My Home</p>
        <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-fg">{owner.address}</p>
        <p className="truncate text-[13px] text-fg-subtle">{settings.displayName}</p>
        <div className="mt-1 flex items-center gap-3">
          <Link
            href="/resident/account"
            className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-accent hover:underline"
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
              className="text-[13px] font-medium text-fg-subtle hover:text-fg-muted hover:underline"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
