"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Callout } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { capabilitiesFor } from "@/lib/board-routes";
import { CAPABILITY_LABEL } from "@/lib/data";

/**
 * Refuses a board page the signed in person cannot open.
 *
 * Lives in the layout rather than in each screen, because the version where
 * each screen guarded itself is the version we had, and ten of eleven forgot.
 * Hiding a navigation link is not access control: the URL is still typable,
 * and a resident who typed /board/money was shown the association's books.
 *
 * The rule is read from the same route table the navigation uses, so a page
 * cannot be offered under one rule and served under another.
 */
export function RequireCapability({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can } = useAppState();

  const needed = capabilitiesFor(pathname);
  if (!needed || needed.some((capability) => can(capability))) {
    return <>{children}</>;
  }

  const names = needed.map((c) => CAPABILITY_LABEL[c].toLowerCase());
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;

  return (
    <Callout tone="warn" icon={<Lock className="size-4" />} title="This is not yours to open">
      You need {list} to see this. The President grants capabilities, so ask them if you
      think you should have it.
    </Callout>
  );
}
