import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MAX_BYTES,
  documentTitle,
  fileTypeOf,
  formatSize,
  fromDbVisibility,
  mimeTypeOf,
  rejectReason,
  storagePathFor,
  toDbVisibility,
  toDocumentRecord,
} from "@/lib/documents";

describe("what a file becomes", () => {
  it("files the name without its extension", () => {
    expect(documentTitle("Q3 budget.final.pdf")).toBe("Q3 budget.final");
    expect(documentTitle("minutes")).toBe("minutes");
  });

  it("knows the three kinds of file and treats the rest as a pdf", () => {
    expect(fileTypeOf("a.PDF")).toBe("pdf");
    expect(fileTypeOf("a.doc")).toBe("docx");
    expect(fileTypeOf("a.xlsx")).toBe("xlsx");
    expect(fileTypeOf("assoc/uuid.xls")).toBe("xlsx");
    expect(fileTypeOf("mystery")).toBe("pdf");
  });

  it("supplies a content type when the browser left it blank", () => {
    expect(mimeTypeOf("a.docx", "")).toContain("wordprocessingml");
    expect(mimeTypeOf("a.pdf", "application/pdf")).toBe("application/pdf");
  });

  it("reads sizes the way a person does", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(40 * 1024)).toBe("40 KB");
    expect(formatSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
  });

  it("refuses what the bucket would refuse, before the upload starts", () => {
    expect(rejectReason({ name: "photo.png", size: 10 })).toMatch(/PDF, Word and Excel/);
    expect(rejectReason({ name: "empty.pdf", size: 0 })).toMatch(/empty/);
    expect(rejectReason({ name: "huge.pdf", size: DOCUMENT_MAX_BYTES + 1 })).toMatch(/Larger/);
    expect(rejectReason({ name: "fine.pdf", size: 1024 })).toBeNull();
  });

  it("keeps a demo upload board only until somebody decides", () => {
    const record = toDocumentRecord({ name: "Reserve study.pdf", size: 2048 }, "doc-1", "2026-08-20");
    expect(record).toMatchObject({
      id: "doc-1",
      name: "Reserve study",
      visibility: "board",
      fileType: "pdf",
      size: "2 KB",
      updatedDate: "2026-08-20",
    });
  });
});

describe("the seam with Postgres", () => {
  it("translates members to owners and back", () => {
    expect(toDbVisibility("members")).toBe("owners");
    expect(toDbVisibility("public")).toBe("public");
    expect(fromDbVisibility("owners")).toBe("members");
    expect(fromDbVisibility("public")).toBe("public");
  });

  it("shows an unrecognised visibility to the fewest people", () => {
    expect(fromDbVisibility("everyone")).toBe("board");
  });

  it("puts the association first in the path, which is what the policy reads", () => {
    expect(storagePathFor("assoc-1", "doc-9", "Minutes.PDF")).toBe("assoc-1/doc-9.pdf");
    expect(storagePathFor("assoc-1", "doc-9", "noext")).toBe("assoc-1/doc-9.pdf");
  });
});
