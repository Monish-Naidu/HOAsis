import { ResidentShell } from "@/components/app/resident-shell";


export const metadata = { title: { default: "Resident", template: "%s · ExpressHOA" } };

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResidentShell>
      {children}
    </ResidentShell>
  );
}
