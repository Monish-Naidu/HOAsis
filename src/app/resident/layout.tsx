import { ResidentShell } from "@/components/app/resident-shell";
import { assistantContext, association, currentOwner } from "@/lib/data";

export const metadata = { title: { default: "Resident", template: "%s · HOAsis" } };

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResidentShell
      associationName={association.shortName}
      ownerName={currentOwner.members[0]}
      unit={currentOwner.unit}
      address={currentOwner.address}
      assistant={assistantContext()}
    >
      {children}
    </ResidentShell>
  );
}
