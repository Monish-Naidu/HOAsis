"use client";

import { PageHeader } from "@/components/ui/primitives";
import { SetupHub } from "@/components/app/setup-hub";
import { useAppState } from "@/lib/app-state";

export default function SetupPage() {
  const { community } = useAppState();
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title={`Set up ${community.settings.displayName}`}
      />
      <div className="mt-5">
        <SetupHub />
      </div>
    </>
  );
}
