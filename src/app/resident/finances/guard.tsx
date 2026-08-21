"use client";

import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";

/** The board decides whether owners can see association balances. */
export function FundsGate({ children }: { children: React.ReactNode }) {
  const { settings } = useAppState();
  if (!settings.showFundsToResidents) {
    return (
      <EmptyState
        icon={<Lock className="size-5" />}
        title="Association funds are not published"
        description="The board has this switched off. Ask them to turn it on in community settings, or request the records directly."
      />
    );
  }
  return <>{children}</>;
}
