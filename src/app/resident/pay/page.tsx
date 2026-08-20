import { PayFlow } from "./pay-flow";
import { ownerBalanceDue, paymentMethods, association, currentOwner } from "@/lib/data";

export const metadata = { title: "Pay" };

export default function PayPage() {
  const due = ownerBalanceDue();
  return (
    <PayFlow
      balanceCents={due.balanceCents}
      nextChargeDate={due.nextChargeDate}
      methods={paymentMethods}
      autopayOn={currentOwner.autopay}
      duesCents={association.duesCents}
    />
  );
}
