import type { VendorInvoice } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Invoices vendors have sent Mehr Meadows. Newest first.                      */
/*                                                                             */
/* Three are waiting and one is paid, so the inbox, the pay flow and the paid  */
/* trail each have something to show. The paid one is the same bill as payout  */
/* po-4, so the two records agree about the number and the amount.            */
/* -------------------------------------------------------------------------- */

export const invoices: VendorInvoice[] = [
  {
    id: "inv-4",
    vendorId: "v-gulfside",
    vendor: "Cascade Grounds Co.",
    number: "CG-2026-0912",
    amountCents: 285_000,
    receivedDate: "2026-08-19",
    dueDate: "2026-09-15",
    description: "September grounds contract",
    status: "new",
    via: "email",
    file: { name: "CG-2026-0912.pdf", size: "184 KB" },
  },
  {
    id: "inv-3",
    vendorId: "v-coastal",
    vendor: "Northsound Pool Service",
    number: "NPS-4471",
    amountCents: 124_000,
    receivedDate: "2026-08-17",
    dueDate: "2026-09-01",
    description: "Pool heater igniter, parts and labor",
    status: "new",
    via: "email",
    file: { name: "NPS-4471.pdf", size: "96 KB" },
  },
  {
    id: "inv-2",
    vendorId: "v-kestrel",
    vendor: "Kestrel & Boyd LLP",
    number: "KB-2026-08",
    amountCents: 195_000,
    receivedDate: "2026-08-10",
    dueDate: "2026-09-09",
    description: "August retainer, covenant review",
    status: "approved",
    via: "upload",
    file: { name: "KB-2026-08.pdf", size: "212 KB" },
    notes: "Approved at the August 12 meeting.",
  },
  {
    id: "inv-1",
    vendorId: "v-sunbelt",
    vendor: "Cedar River Pest Control",
    number: "SPC-771",
    amountCents: 47_500,
    receivedDate: "2026-08-04",
    dueDate: "2026-08-25",
    description: "Quarterly perimeter treatment",
    status: "paid",
    via: "email",
    file: { name: "SPC-771.pdf", size: "71 KB" },
    payoutId: "po-4",
  },
];
