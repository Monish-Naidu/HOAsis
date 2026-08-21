import { PayFlow } from "./pay-flow";
import { association } from "@/lib/data";

export const metadata = { title: "Pay" };

export default function PayPage() {
  return <PayFlow duesCents={association.duesCents} />;
}
