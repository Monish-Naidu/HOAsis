"use client";

import { useAppState } from "@/lib/app-state";
import { ROLE_LABEL } from "@/lib/types";
import { homeLabel } from "@/lib/wording";
import { Avatar } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/app/theme";

/**
 * Who is signed in, pinned to the foot of the rail.
 *
 * A frosted card on the navy: avatar, name, role and home, and the theme
 * toggle, so the one control everybody reaches for sits by the one thing
 * everybody recognises. The header keeps the avatar and sign out; this is
 * the card that says whose desk this is.
 */
export function RailYou() {
  const { account, community } = useAppState();
  if (!account) return null;
  return (
    <div className="relative px-3 pb-3 pt-1">
      <div className="rail-you flex items-center gap-2.5 rounded-2xl p-2.5">
        <Avatar name={account.name} className="rail-you-avatar shrink-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-footnote font-semibold text-white">{account.name}</p>
          {/* Wraps at the dot rather than truncating: "Vice President · Lo…"
              hid the one part that says which home. */}
          <p className="text-caption text-navy-300">
            <span className="whitespace-nowrap">{ROLE_LABEL[account.role]}</span>
            {" · "}
            <span className="whitespace-nowrap">{homeLabel(community, account.unit)}</span>
          </p>
        </div>
        <ThemeToggle className="size-10 shrink-0 text-navy-200 hover:bg-white/10 hover:text-white" />
      </div>
    </div>
  );
}
