"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { ROLE_LABEL } from "@/lib/types";
import { homeLabel } from "@/lib/wording";
import { Avatar } from "@/components/ui/primitives";
import { ThemeToggle } from "@/components/app/theme";
import { AccountPopover } from "@/components/app/account-menu";
import { cn } from "@/lib/utils";

/**
 * Who is signed in, pinned to the foot of the rail, and their menu.
 *
 * A frosted card on the navy: avatar, name, role and home, and the theme
 * toggle, so the one control everybody reaches for sits by the one thing
 * everybody recognises. Pressing the name opens help and sign out here,
 * which is why the bar above no longer draws the same person again at lg.
 */
export function RailYou() {
  const { account, community, signOut } = useAppState();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; bottom: number } | null>(null);
  if (!account) return null;

  function toggle(button: HTMLButtonElement) {
    if (open) {
      setOpen(false);
      return;
    }
    const r = button.getBoundingClientRect();
    // Opens beside the card, bottoms aligned, so it never covers the rail.
    setPlace({ left: r.right + 12, bottom: Math.max(12, window.innerHeight - r.bottom) });
    setOpen(true);
  }

  return (
    <div className="relative px-3 pb-3 pt-1">
      <div className="rail-you flex items-center gap-2.5 rounded-2xl p-2.5">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`${account.name}, account menu`}
          onClick={(e) => toggle(e.currentTarget)}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl text-left transition-colors hover:bg-white/10",
            open && "bg-white/10",
          )}
        >
          <Avatar name={account.name} className="rail-you-avatar shrink-0" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-footnote font-semibold text-white">{account.name}</span>
            {/* Wraps at the dot rather than truncating: "Vice President · Lo…"
                hid the one part that says which home. */}
            <span className="block text-caption leading-snug text-navy-300">
              <span className="whitespace-nowrap">{ROLE_LABEL[account.role]}</span>
              {" · "}
              <span className="whitespace-nowrap">{homeLabel(community, account.unit)}</span>
            </span>
          </span>
        </button>
        <ThemeToggle className="size-10 shrink-0 text-navy-200 hover:bg-white/10 hover:text-white" />
      </div>
      {/* A door people can see. The menu above has Sign out too, but a card
          with no word on it was a door nobody would find (Monish, 2026-09-26). */}
      <button
        type="button"
        onClick={() => {
          signOut();
          router.push("/signin");
        }}
        className="mt-1.5 flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl text-caption font-medium text-navy-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="size-3.5" aria-hidden />
        Sign out
      </button>
      {open && place ? <AccountPopover place={place} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
