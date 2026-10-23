import type { SupabaseClient } from "@supabase/supabase-js";

import type { DocumentRecord, ISODate } from "@/lib/types";

/**
 * What the board can upload, and how a file becomes a record.
 *
 * Shared by the demo, which keeps everything but the bytes, and by a real
 * association, which puts the bytes in Storage and the rest in a row. The two
 * paths have to agree on what a document is, so this lives in one place rather
 * than in the screen.
 */

export const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * How long a link to a file stays good. Long enough that a tab left open over
 * a meeting still works, short enough that a forwarded link goes stale.
 */
export const SIGNED_URL_SECONDS = 4 * 60 * 60;

const BY_EXTENSION: Record<string, { fileType: DocumentRecord["fileType"]; mime: string }> = {
  pdf: { fileType: "pdf", mime: "application/pdf" },
  doc: { fileType: "docx", mime: "application/msword" },
  docx: {
    fileType: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  xls: { fileType: "xlsx", mime: "application/vnd.ms-excel" },
  xlsx: {
    fileType: "xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
};

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function fileTypeOf(nameOrPath: string): DocumentRecord["fileType"] {
  return BY_EXTENSION[extensionOf(nameOrPath)]?.fileType ?? "pdf";
}

/**
 * The content type to store a file under. Browsers leave it blank for some
 * Office files, and the bucket refuses a blank, so the extension decides.
 */
export function mimeTypeOf(name: string, declared?: string): string {
  return declared || BY_EXTENSION[extensionOf(name)]?.mime || "application/octet-stream";
}

/** "Q3 budget.pdf" is filed as "Q3 budget". */
export function documentTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

/** Bytes to the short form a person reads at a glance. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Why a file cannot be filed, in words for the toast, or null when it can. */
export function rejectReason(file: { name: string; size: number }): string | null {
  if (!BY_EXTENSION[extensionOf(file.name)]) return "Only PDF, Word and Excel files";
  if (file.size === 0) return "The file is empty";
  if (file.size > DOCUMENT_MAX_BYTES) return `Larger than ${formatSize(DOCUMENT_MAX_BYTES)}`;
  return null;
}

/**
 * The database says "owners" where the app says "members". The enum was
 * written first and the screens second, and renaming a Postgres enum in
 * production buys nothing. Translate at the seam, both ways.
 */
export type DbVisibility = "public" | "owners" | "board";

export function toDbVisibility(visibility: DocumentRecord["visibility"]): DbVisibility {
  return visibility === "members" ? "owners" : visibility;
}

export function fromDbVisibility(visibility: string): DocumentRecord["visibility"] {
  if (visibility === "owners") return "members";
  if (visibility === "public") return "public";
  // Anything unrecognised is shown to the fewest people, never the most.
  return "board";
}

/**
 * Where a file lives in the bucket. The association's id is the first path
 * segment because that is what the storage policy checks; the document's id
 * is the file name so two uploads called "minutes.pdf" cannot collide.
 */
export function storagePathFor(
  associationId: string,
  documentId: string,
  fileName: string,
): string {
  return `${associationId}/${documentId}.${extensionOf(fileName) || "pdf"}`;
}

/**
 * Where an uploaded form's file lives in the documents bucket. The forms
 * folder is what the storage policies key the settings capability on (0130),
 * so the path is built here, once, and nowhere else.
 */
export function formStoragePath(associationId: string, formId: string, fileName: string): string {
  return `${associationId}/forms/${formId}.${extensionOf(fileName) || "pdf"}`;
}

export type FormFileOutcome =
  { id: string; storagePath: string; error: null } | { id: null; storagePath: null; error: string };

/**
 * An uploaded form's bytes and its row, in that order. The row is what makes
 * the file reachable, so a row the database refuses takes the bytes back out
 * with it: a failed upload leaves nothing saved, and nothing on the list
 * claims a file that is not there.
 */
export async function uploadFormFile(
  supabase: SupabaseClient,
  associationId: string,
  label: string,
  file: File,
  today: ISODate,
): Promise<FormFileOutcome> {
  const id = crypto.randomUUID();
  const storagePath = formStoragePath(associationId, id, file.name);
  const { error: putError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { contentType: mimeTypeOf(file.name, file.type) });
  if (putError) return { id: null, storagePath: null, error: putError.message };
  const { error: rowError } = await supabase.from("forms").insert({
    id,
    association_id: associationId,
    label,
    file_name: file.name,
    size_label: formatSize(file.size),
    storage_path: storagePath,
    updated_on: today,
  });
  if (rowError) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { id: null, storagePath: null, error: rowError.message };
  }
  return { id, storagePath, error: null };
}

/** The bytes behind a form's row, once the row is gone. */
export async function removeFormFile(supabase: SupabaseClient, storagePath: string): Promise<void> {
  await supabase.storage.from("documents").remove([storagePath]);
}

/** What a demo keeps of an upload: everything but the bytes. */
export function toDocumentRecord(
  file: { name: string; size: number },
  id: string,
  today: ISODate,
): DocumentRecord {
  return {
    id,
    name: documentTitle(file.name),
    category: "Other",
    updatedDate: today,
    size: formatSize(file.size),
    // Board only until somebody decides otherwise: a document nobody has
    // classified yet is the one most likely to be the wrong thing to publish.
    visibility: "board",
    fileType: fileTypeOf(file.name),
  };
}
