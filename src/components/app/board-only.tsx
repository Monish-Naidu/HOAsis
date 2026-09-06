"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Callout } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";

/**
 * Keeps a resident out of the board shell altogether.
 *
 * The capability gate already refused the page, but it sat inside the board
 * layout, so a resident who typed /board/money saw the board's navigation,
 * the trial banner and the setup bar around a refusal. None of that is
 * theirs to see. A resident who lands here is taken home instead.
 */
export function BoardOnly({ children }: { children: React.ReactNode }) {
  const { account, ready } = useAppState();
  const router = useRouter();
  const resident = ready && account?.role === "resident";

  useEffect(() => {
    if (resident) router.replace("/resident");
  }, [resident, router]);

  if (resident) {
    return (
      <div className="mx-auto w-full max-w-xl px-5 py-14">
        <Callout tone="info" icon={<Lock className="size-4" />} title="This is the board's side">
          Taking you to your home screen.
        </Callout>
      </div>
    );
  }
  return <>{children}</>;
}
