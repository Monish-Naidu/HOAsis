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
        eyebrow="Getting started"
        title={`Set up ${community.settings.displayName}`}
        description="Built from what you told us about the association, so nothing here is a step you have to decline. Each one is a question, asked one at a time."
      />
      <div className="mt-5">
        <SetupOverview />
        <PortingCard />
      </div>
    </>
  );
}
