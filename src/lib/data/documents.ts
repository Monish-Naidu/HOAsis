import type { DocumentRecord } from "@/lib/types";

/**
 * The demo's document library.
 *
 * Nine files, and each one is a record an association is expected to hold:
 * the four governing documents, the money (budget, statements, reserve
 * study), the latest minutes, and the insurance certificate. Nothing else.
 * The earlier list carried inspection reports, vendor contracts, notices and
 * blank forms, and a visitor could not tell the library from a shared drive.
 * Forms live under Forms, notices under Communications, contracts under
 * Vendors.
 */
export const documents: DocumentRecord[] = [
  {
    id: "doc-1",
    name: "Declaration of Covenants, Conditions & Restrictions",
    category: "Governing",
    updatedDate: "2024-03-18",
    size: "2.4 MB",
    visibility: "public",
    requiredBy: "RCW 64.38, association records",
    fileType: "pdf",
  },
  {
    id: "doc-2",
    name: "Bylaws",
    category: "Governing",
    updatedDate: "2024-03-18",
    size: "880 KB",
    visibility: "public",
    requiredBy: "RCW 64.38, association records",
    fileType: "pdf",
  },
  {
    id: "doc-3",
    name: "Articles of Incorporation",
    category: "Governing",
    updatedDate: "2016-01-04",
    size: "310 KB",
    visibility: "public",
    requiredBy: "RCW 64.38, association records",
    fileType: "pdf",
  },
  {
    id: "doc-4",
    name: "Rules & Regulations",
    category: "Governing",
    updatedDate: "2026-01-15",
    size: "540 KB",
    visibility: "public",
    requiredBy: "RCW 64.38, association records",
    fileType: "pdf",
  },
  {
    id: "doc-5",
    name: "2026 Budget",
    category: "Financial",
    updatedDate: "2025-10-22",
    size: "196 KB",
    visibility: "public",
    requiredBy: "RCW 64.38, association records",
    fileType: "pdf",
  },
  {
    id: "doc-6",
    name: "2025 Financial Statements",
    category: "Financial",
    updatedDate: "2026-03-24",
    size: "1.1 MB",
    visibility: "members",
    requiredBy: "RCW 64.38, financial statements",
    fileType: "pdf",
  },
  {
    id: "doc-7",
    name: "Reserve Study",
    category: "Financial",
    updatedDate: "2025-03-11",
    size: "3.6 MB",
    visibility: "members",
    requiredBy: "RCW 64.38, reserve study",
    fileType: "pdf",
  },
  {
    id: "doc-9",
    name: "Board Meeting Minutes, July 15, 2026",
    category: "Meetings",
    updatedDate: "2026-07-22",
    size: "142 KB",
    visibility: "public",
    requiredBy: "RCW 64.38, association records",
    fileType: "pdf",
  },
  {
    id: "doc-12",
    name: "Certificate of Insurance",
    category: "Insurance",
    updatedDate: "2026-01-02",
    size: "420 KB",
    visibility: "members",
    fileType: "pdf",
  },
];
