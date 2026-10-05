"use client";

import { useRef } from "react";
import Link from "next/link";
import { Camera, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { useAppState, useCurrentOwner, useHomePhoto } from "@/lib/app-state";
import { shrinkImage } from "@/lib/home-photo";
import { useToast } from "@/components/app/toast";
import { HOME_TYPE_LABEL, isMixed } from "@/lib/home-types";

/**
 * The My Home card: the photograph, the address, the association.
 *
 * Lived on the dashboard until the 2026-09-01 huddle slimmed that page down
 * to "what do I owe and how do I pay"; it moved here to Account, the page the
 * dashboard's "view home details" always pointed at, rather than dying.
 *
 * The owner can add a photo of their own home; until they do, the seeded
 * photo of their home stands in, and failing that the community's cover, the
 * closest true image we hold. `useHomePhoto` resolves that order. An upload
 * lives in this browser, so losing it costs a picture, never a record.
 */
export function MyHomeCard({ detailsLink = true }: { detailsLink?: boolean }) {
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
    <Card className="flex items-stretch overflow-hidden">
      <div className="relative w-28 shrink-0">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${photo})` }}
          aria-hidden
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
          className="absolute bottom-1.5 right-1.5 flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65"
        >
          <Camera className="size-3.5" />
        </button>
      </div>
      <div className="min-w-0 flex-1 p-4">
        <p className="text-headline font-semibold tracking-[-0.015em] text-fg">My Home</p>
        <p className="mt-0.5 truncate text-body text-fg-muted">{owner.address}</p>
        <p className="truncate text-footnote text-fg-subtle">
          {kind ? `${kind} · ` : ""}
          {settings.displayName}
        </p>
        <div className="mt-1.5 flex items-center gap-3">
          {detailsLink ? (
            <Link
              href="/resident/account"
              className="inline-flex items-center gap-0.5 text-footnote font-semibold text-accent hover:underline"
            >
              See your statement
              <ChevronRight className="size-3.5" />
            </Link>
          ) : null}
          {uploaded ? (
            <button
              type="button"
              onClick={() => {
                setPhoto(null);
                notify("Photo removed");
              }}
              className="text-footnote font-medium text-fg-muted underline underline-offset-2 hover:text-fg"
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
