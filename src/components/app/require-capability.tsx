"use client";

import { usePathname } from "next/navigation";
import { Eye, Lock } from "lucide-react";
import { Callout } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { boardModuleFor, routeFor } from "@/lib/board-routes";
import { ModuleOff } from "@/components/app/module-gate";
import { moduleOn } from "@/lib/modules";
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
 * cannot be offered under one rule and served under another. Both ask `sees`:
 * a seat that may look at an area opens its pages. Until 2026-10-04 this
 * asked `can` while the rail, the tabs, search and the dashboard asked
 * `sees`, so a look-only seat was offered Finances and then refused it.
 *
 * A page that exists only to change something (`changes` in the route table)
 * still asks `can`. And a seat that sees without changing is told so once,
 * above the page, so a refused save is not a surprise.
 */
export function RequireCapability({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, sees } = useAppState();

  // Switched off comes before may-they-open-it: a page that is not on for
  // anyone says so in the same words to everyone.
  const mod = boardModuleFor(pathname);
  if (mod && !moduleOn(mod)) return <ModuleOff module={mod} />;

  const route = routeFor(pathname);
  const needed = route?.need;
  if (!needed) return <>{children}</>;

  const mayChange = needed.some((capability) => can(capability));
  const mayOpen = route?.changes ? mayChange : needed.some((capability) => sees(capability));
  if (mayOpen) {
    return (
      <>
        {mayChange ? null : (
          <div data-testid="board-read-only" className="mb-4">
            <Callout tone="info" icon={<Eye className="size-4" />} title="You can look here, not change it">
              Your seat sees this page. Anything you try to save will be refused. The President
              can let you make changes.
            </Callout>
          </div>
        )}
        {children}
      </>
    );
  }

  const names = needed.map((c) => CAPABILITY_LABEL[c].toLowerCase());
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;

  return (
    <div data-testid="board-refusal">
      <Callout tone="warn" icon={<Lock className="size-4" />} title="This is not yours to open">
        You need {list} to see this. The President grants capabilities, so ask them if you
        think you should have it.
      </Callout>
    </div>
  );
}
