"use client";

import { FileText, Paperclip, X } from "lucide-react";
import { ATTACHMENT_TYPES, attachmentProblem, fileSizeWords } from "@/lib/attachments";
import type { HomeRequest } from "@/lib/types";

/**
 * The pieces of a request's files shared by the owner's form, the owner's
 * detail page and the board's detail: the limits in words, the files chosen
 * but not yet sent, and the files already on the request.
 */

export const FILE_LIMITS = "Up to 10 MB each. Photos and PDFs.";

export const FILE_ACCEPT = ATTACHMENT_TYPES.join(",");

/** Browsers show these in an image tag; HEIC stays a file row because most cannot draw it. */
const THUMBNAIL = /\.(jpe?g|png|webp|gif)$/i;

function isThumbnail(a: HomeRequest["attachments"][number]): boolean {
  if (!a.url) return false;
  if (THUMBNAIL.test(a.name)) return true;
  try {
    return THUMBNAIL.test(new URL(a.url, "https://x.invalid").pathname);
  } catch {
    return false;
  }
}

/** Files picked on a form: name, size, why one cannot go, and a way to take it out. */
export function ChosenFiles({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="divide-y divide-border border-t border-border">
      {files.map((f, i) => {
        const problem = attachmentProblem(f);
        return (
          <li key={`${f.name}-${i}`} className="px-4 py-2.5 text-footnote">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-fg">{f.name}</span>
              <span className="tnum shrink-0 text-fg-subtle">{fileSizeWords(f.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onRemove(i)}
                className="shrink-0 text-fg-subtle hover:text-danger"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {problem ? (
              <p role="alert" className="mt-1 text-danger">
                {problem}. This file will not be sent.
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What is on a request. A file with a link opens in a new tab: a photo as a
 * thumbnail in a grid, a PDF as a row. One without a link (the demo, or a
 * file kept before uploads) is its name and size.
 */
export function AttachmentList({ attachments }: { attachments: HomeRequest["attachments"] }) {
  const photos = attachments.filter(isThumbnail);
  const rows = attachments.filter((a) => !isThumbnail(a));
  return (
    <div>
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2 p-3">
          {photos.map((a) => (
            <li key={a.path ?? a.name}>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${a.name}, opens in a new tab`}
                className="block aspect-square overflow-hidden rounded-lg border border-border bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed link, not an asset next/image can optimise */}
                <img src={a.url} alt={a.name} loading="lazy" className="size-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {rows.map((a, i) => {
        const inner = (
          <>
            {a.url ? (
              <FileText className="size-3.5 shrink-0 text-fg-subtle" />
            ) : (
              <Paperclip className="size-3.5 shrink-0 text-fg-subtle" />
            )}
            <span className="min-w-0 flex-1 truncate text-body text-fg">{a.name}</span>
            <span className="tnum shrink-0 text-footnote text-fg-muted">{a.size}</span>
          </>
        );
        const cls = `flex items-center gap-3 px-4 py-2.5 ${i > 0 || photos.length ? "border-t border-border" : ""}`;
        return a.url ? (
          <a key={a.path ?? a.name} href={a.url} target="_blank" rel="noreferrer" className={`${cls} hover:bg-surface-2`}>
            {inner}
          </a>
        ) : (
          <div key={a.path ?? a.name} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
