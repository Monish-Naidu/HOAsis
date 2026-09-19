import { ResidentShell } from "@/components/app/resident-shell";


export const metadata = { title: { default: "Resident", template: "%s · Your HOAsis" } };

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResidentShell>
      {children}
    </ResidentShell>
  );
}
