"use client";

import { PageHeader } from "@/components/ui/primitives";
import { SetupOverview } from "@/components/app/setup-plan";
import { useAppState } from "@/lib/app-state";

export default function SetupPage() {
  const { community } = useAppState();
  return (
    <>
      <PageHeader
        title={`Set up ${community.settings.displayName}`}
        description="The steps to get your community running."
      />
      <SetupOverview />
    </>
  );
}
