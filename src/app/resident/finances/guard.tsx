"use client";

import { CloudOff, Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";

/** The board decides whether owners can see association balances. */
export function FundsGate({ children }: { children: React.ReactNode }) {
  const { settings, community } = useAppState();
  if (!settings.showFundsToResidents) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Association funds are not published"
        description="Your board has turned this section off."
      />
    );
  }
  if (community.fundsUnavailable) {
    return (
      <EmptyState
        icon={<CloudOff className="size-5" />}
        title="Funds could not load"
        description="The numbers are safe. Try again in a minute."
      />
    );
  }
  return <>{children}</>;
}
