"use client";

import { ResidentTitle } from "@/components/app/resident-title";
import { SectionTitle } from "@/components/ui/primitives";
import { ContactCard } from "@/components/app/contact-card";
import { DisplaySettings } from "@/components/app/display-settings";

export default function ResidentSettings() {
  return (
    <div className="animate-rise space-y-6">
      <ResidentTitle title="Settings" subtitle="How this looks, and how the board reaches you" />

      <section>
        <SectionTitle>Display</SectionTitle>
        <DisplaySettings />
      </section>

      <ContactCard />
    </div>
  );
}
