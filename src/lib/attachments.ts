import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Files on a request and photos on a notice (migration 0111).
 *
 * The bucket is private and keyed by the row the file belongs to:
 * `{association}/{requests|violations}/{row}/{file}`. The database checks
 * the same path when the row is told about the file, so the path is built
 * here, once, and nowhere else. Limits match the bucket's own.
 */

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

export type AttachmentKind = "requests" | "violations";

/** Why a file cannot be attached, in the words the form shows; null when it can. */
export function attachmentProblem(file: { size: number; type: string; name: string }): string | null {
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return "Photos (JPEG, PNG, WebP, HEIC) and PDFs only";
  }
  if (file.size > ATTACHMENT_MAX_BYTES) return "Keep each file under 10 MB";
  if (file.size === 0) return "That file is empty";
  if (!file.name.trim()) return "The file needs a name";
  return null;
}

/** "2.4 MB", "640 KB": the same words the database writes on the row. */
export function fileSizeWords(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * A safe file name: the original, lower-cased, with anything outside
 * letters, digits, dot and dash replaced, and a short random prefix so two
 * photos called IMG_0001.jpg do not collide.
 */
export function attachmentFileName(original: string, random: string = Math.random().toString(36).slice(2, 8)): string {
  const base = original.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "file";
  return `${random}-${base}`;
}

export function attachmentPath(associationId: string, kind: AttachmentKind, rowId: string, fileName: string): string {
  return `${associationId}/${kind}/${rowId}/${fileName}`;
}

/**
 * Puts the file in the bucket. The row is told about it by the caller
 * (add_request_attachment or add_violation_photo), after this resolves.
 */
export async function uploadAttachment(
  supabase: SupabaseClient,
  path: string,
  file: Blob & { type: string },
): Promise<{ error: string | null }> {
  const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type, upsert: false });
  return { error: error ? error.message : null };
}
