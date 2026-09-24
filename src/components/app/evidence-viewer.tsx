"use client";

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Camera, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Badge, Card } from "@/components/ui/primitives";
import { VANTAGE_LABEL, photoConcerns } from "@/lib/violations";
import type { ViolationPhoto } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

/**
 * The evidence, one photograph at a time.
 *
 * This used to be a number. "3 photos" tells a board how many photographs
 * exist and tells the accused household nothing, which is backwards: the whole
 * of due process here is the owner being able to see what is being said about
 * them before they have to answer it. So the same component serves both sides,
 * and the owner's copy is not a reduced version of the board's.
 *
 * Every photograph carries where it was taken from. That is the privacy
 * question made answerable rather than argued about: a bin at the curb shot
 * from the sidewalk and the same yard shot over a fence are different acts,
 * and the second one is what an appeal gets built on.
 */
export function EvidenceViewer({
  photos,
  /** The board sees the concerns. The accused owner sees the photographs. */
  showConcerns = false,
  emptyNote,
}: {
  photos: ViolationPhoto[];
  showConcerns?: boolean;
  emptyNote?: string;
}) {
  const [index, setIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <Card className="px-4 py-5">
        <p className="flex items-center gap-2 text-[15px] text-fg-muted">
          <Camera className="size-4 shrink-0 text-fg-subtle" />
          {emptyNote ??
            "No photographs are attached. A notice with no evidence behind it is one an owner can simply deny."}
        </p>
      </Card>
    );
  }

  const safe = Math.min(index, photos.length - 1);
  const photo = photos[safe];
  const concerns = showConcerns ? photoConcerns([photo]) : [];

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] w-full bg-surface-3">
        {photo.src ? (
          <Image
            src={photo.src}
            alt={photo.brief}
            fill
            sizes="(max-width: 640px) 100vw, 640px"
            className="object-cover"
          />
        ) : (
          /* No image file, and none invented. The brief is what a hearing
             actually turns on, and describing what is needed is honest in a
             way that generating a photograph of a fictional driveway is not. */
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <Camera className="size-6 text-fg-subtle" />
            <p className="text-[13px] font-semibold text-fg-muted">
              Photograph {safe + 1} of {photos.length}
            </p>
            <p className="max-w-sm text-[15px] leading-relaxed text-fg-muted">{photo.brief}</p>
          </div>
        )}

        {photos.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
              aria-label="Previous photograph"
              className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-navy-950/70 text-white backdrop-blur-sm transition-opacity hover:opacity-90"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % photos.length)}
              aria-label="Next photograph"
              className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-navy-950/70 text-white backdrop-blur-sm transition-opacity hover:opacity-90"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        ) : null}
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={photo.vantage === "street" || photo.vantage === "common-area" ? "neutral" : "warn"}>
            <Eye className="mr-1 inline size-3" />
            {VANTAGE_LABEL[photo.vantage]}
          </Badge>
          <span className="text-[13px] text-fg-muted">
            {formatDate(photo.takenOn, "long")} · {photo.takenBy}
          </span>
        </div>
        {photo.src ? (
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{photo.brief}</p>
        ) : null}

        {concerns.map((concern) => (
          <p
            key={concern.photoId}
            className={cn(
              "mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[13px] leading-relaxed",
              concern.severity === "warn"
                ? "bg-warn-soft text-fg"
                : "bg-surface-2 text-fg-muted",
            )}
          >
            <AlertTriangle
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                concern.severity === "warn" ? "text-warn" : "text-fg-subtle",
              )}
            />
            {concern.message}
          </p>
        ))}
      </div>

      {photos.length > 1 ? (
        <div className="flex gap-1.5 border-t border-border px-4 py-2.5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Photograph ${i + 1}`}
              aria-current={i === safe}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i === safe ? "bg-primary" : "bg-surface-3 hover:bg-border-2",
              )}
            />
          ))}
        </div>
      ) : null}
    </Card>
  );
}
