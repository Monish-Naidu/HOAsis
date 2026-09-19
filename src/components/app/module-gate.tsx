"use client";

import { Construction } from "lucide-react";
import { Callout } from "@/components/ui/primitives";
import { moduleOffCopy } from "@/lib/modules";
import type { ModuleKey } from "@/lib/modules";

/**
 * What a page says when its module is switched off.
 *
 * Both shells render this in place of the page. The navigation already hides
 * the link, and this is what makes hiding honest: a bookmark or a typed URL
 * gets the same answer as the sidebar, in the same words, for everyone.
 */
export function ModuleOff({ module }: { module: ModuleKey }) {
  const copy = moduleOffCopy(module);
  return (
    <Callout tone="neutral" icon={<Construction className="size-4" />} title={copy.title}>
      {copy.body}
    </Callout>
  );
}
