"use client";

import { PageHeader } from "@/components/ui/primitives";
import { SetupOverview } from "@/components/app/setup-plan";
import { PortingCard } from "@/components/app/porting-card";
import { useAppState } from "@/lib/app-state";

export default function SetupPage() {
  const { community } = useAppState();
  return (
    <>
      <PageHeader
        title={`Set up ${community.settings.displayName}`}
        description="A short list, in the order that gets money moving first."
      />
      <SetupOverview />
      <PortingCard />
    </>
  );
}
