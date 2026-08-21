import { ResidentShell } from "@/components/app/resident-shell";
import { assistantContext, association } from "@/lib/data";

export const metadata = { title: { default: "Resident", template: "%s · HOAsis" } };

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResidentShell
      associationName={association.shortName}
      assistant={assistantContext()}
    >
      {children}
    </ResidentShell>
  );
}
