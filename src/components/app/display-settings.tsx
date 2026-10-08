"use client";

import { Card } from "@/components/ui/primitives";
import { TextSizeControl } from "@/components/app/text-size";
import { ThemeToggle } from "@/components/app/theme";

/**
 * Text size and light or dark, for this device. The same card on resident
 * Settings and at the top of board Settings, so a board member finds it in
 * the same words on either side.
 */
export function DisplaySettings() {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div>
        <p className="text-body font-medium text-fg">Text size</p>
        <p className="mt-0.5 text-footnote text-fg-muted">Makes every word bigger on this device.</p>
        <TextSizeControl className="mt-3 max-w-md" />
      </div>
      <div className="border-t border-border pt-4">
        <p className="text-body font-medium text-fg">Light or dark</p>
        <ThemeToggle expanded className="mt-3 max-w-md" />
      </div>
    </Card>
  );
}
