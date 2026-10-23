import { describe, expect, it } from "vitest";
import { formStoragePath, removeFormFile, uploadFormFile } from "@/lib/documents";

/**
 * The upload seam the settings form and a real association share.
 *
 * The order is the promise: bytes first, the row second, and a row the
 * database refuses takes the bytes back out. A failure at either step leaves
 * nothing saved, so the list can never show a form whose file is not there.
 */

interface Calls {
  uploads: { path: string; size: number; contentType?: string }[];
  inserts: Record<string, unknown>[];
  removed: string[];
}

function fakeSupabase(faults: { put?: string; row?: string }) {
  const calls: Calls = { uploads: [], inserts: [], removed: [] };
  const supabase = {
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: File, options?: { contentType?: string }) => {
          expect(bucket).toBe("documents");
          calls.uploads.push({ path, size: file.size, contentType: options?.contentType });
          return { error: faults.put ? { message: faults.put } : null };
        },
        remove: async (paths: string[]) => {
          calls.removed.push(...paths);
          return { error: null };
        },
      }),
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        expect(table).toBe("forms");
        calls.inserts.push(row);
        return { error: faults.row ? { message: faults.row } : null };
      },
    }),
  };
  return { supabase: supabase as never, calls };
}

const ASSOCIATION = "a8b2c3d4-0000-4000-8000-000000000001";
const BYTES = "%PDF-1.4 fake but known bytes\n";
const file = () => new File([BYTES], "Pool Rules.PDF", { type: "application/pdf" });

describe("formStoragePath", () => {
  it("puts the file under the association's forms folder, keyed by the form's id", () => {
    const path = formStoragePath(ASSOCIATION, "form-1", "Pool Rules.PDF");
    expect(path).toBe(`${ASSOCIATION}/forms/form-1.pdf`);
  });

  it("falls back to pdf when the name has no extension", () => {
    expect(formStoragePath(ASSOCIATION, "form-1", "noextension")).toBe(
      `${ASSOCIATION}/forms/form-1.pdf`,
    );
  });
});

describe("uploadFormFile", () => {
  it("stores the bytes, then writes the row that points at them", async () => {
    const { supabase, calls } = fakeSupabase({});
    const outcome = await uploadFormFile(supabase, ASSOCIATION, "Pool rules", file(), "2026-10-22");

    expect(outcome.error).toBeNull();
    expect(calls.uploads).toHaveLength(1);
    expect(calls.inserts).toHaveLength(1);
    const [{ path }] = calls.uploads;
    expect(path).toBe(`${ASSOCIATION}/forms/${outcome.id}.pdf`);
    expect(calls.uploads[0].contentType).toBe("application/pdf");
    expect(calls.inserts[0]).toMatchObject({
      id: outcome.id,
      association_id: ASSOCIATION,
      label: "Pool rules",
      file_name: "Pool Rules.PDF",
      size_label: `${BYTES.length} B`,
      storage_path: path,
      updated_on: "2026-10-22",
    });
    expect(calls.removed).toEqual([]);
  });

  it("a failed upload writes no row, so nothing claims a file that is not there", async () => {
    const { supabase, calls } = fakeSupabase({ put: "row level security" });
    const outcome = await uploadFormFile(supabase, ASSOCIATION, "Pool rules", file(), "2026-10-22");

    expect(outcome).toMatchObject({ id: null, storagePath: null, error: "row level security" });
    expect(calls.inserts).toEqual([]);
    expect(calls.removed).toEqual([]);
  });

  it("a refused row takes the bytes back out with it", async () => {
    const { supabase, calls } = fakeSupabase({ row: "permission denied" });
    const outcome = await uploadFormFile(supabase, ASSOCIATION, "Pool rules", file(), "2026-10-22");

    expect(outcome).toMatchObject({ id: null, storagePath: null, error: "permission denied" });
    expect(calls.removed).toEqual([calls.uploads[0].path]);
  });
});

describe("removeFormFile", () => {
  it("removes exactly the form's own path", async () => {
    const { supabase, calls } = fakeSupabase({});
    await removeFormFile(supabase, `${ASSOCIATION}/forms/form-1.pdf`);
    expect(calls.removed).toEqual([`${ASSOCIATION}/forms/form-1.pdf`]);
  });
});
