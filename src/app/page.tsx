import { SignInPanel } from "./sign-in-panel";
import { CommunityBackdrop, CommunityMasthead } from "./community-identity";
import { Wordmark } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme";
import { accounts, association } from "@/lib/data";
import { ROLE_LABEL } from "@/lib/types";

export const metadata = { title: "Sign in" };

export default function AuthLanding() {
  const seats = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    unit: a.unit,
    role: ROLE_LABEL[a.role],
    isAdmin: a.role !== "resident",
  }));

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg">
      <CommunityBackdrop />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[45dvh] bg-gradient-to-b from-transparent to-bg"
        aria-hidden
      />

      <header className="relative flex items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark size={34} />
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <CommunityMasthead
            location={`${association.addressLine} · ${association.unitCount} homes`}
          />
          <SignInPanel seats={seats} />
        </div>
      </main>
    </div>
  );
}
