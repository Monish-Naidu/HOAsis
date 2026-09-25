"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun, SunMoon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Four ways to pick a theme, and one of them is a clock.
 *
 * - `auto` (the default): light by day, dark from 8pm to 7am on the
 *   reader's own clock, wherever they are. Nobody has to set it.
 * - `system`: follow the operating system, for people whose Mac or phone
 *   already switches at sunset.
 * - `light` and `dark`: fixed.
 */
type Mode = "light" | "dark" | "system" | "auto";

const STORAGE_KEY = "hoasis-theme";
const DEFAULT_MODE: Mode = "auto";

/** Night runs from 8pm up to 7am, local time. */
export const NIGHT_STARTS = 20;
export const NIGHT_ENDS = 7;

/**
 * Runs before paint so the navy never flashes white on a dark-mode reload.
 * Mirrors `resolveDark` below; keep the two in step.
 */
export const themeScript = `(function(){try{var m=localStorage.getItem("${STORAGE_KEY}")||"${DEFAULT_MODE}";var h=new Date().getHours();var n=h>=${NIGHT_STARTS}||h<${NIGHT_ENDS};var d=m==="dark"||(m==="auto"&&n)||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/* -------------------------------------------------------------------------- */
/* A tiny external store. The theme lives in localStorage and on <html>, not   */
/* in React, so useSyncExternalStore is the honest way to read it.            */
/* -------------------------------------------------------------------------- */

let listeners: (() => void)[] = [];
let cached: Mode | null = null;

const MODES: Mode[] = ["light", "dark", "system", "auto"];

function read(): Mode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(stored as Mode) ? (stored as Mode) : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function getSnapshot(): Mode {
  if (cached === null) cached = read();
  return cached;
}

function getServerSnapshot(): Mode {
  return DEFAULT_MODE;
}

export function isNight(date: Date): boolean {
  const h = date.getHours();
  return h >= NIGHT_STARTS || h < NIGHT_ENDS;
}

/** Milliseconds until the clock next crosses 8pm or 7am. */
function msUntilNextBoundary(now: Date): number {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(isNight(now) ? NIGHT_ENDS : NIGHT_STARTS);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function resolveDark(mode: Mode): boolean {
  return (
    mode === "dark" ||
    (mode === "auto" && isNight(new Date())) ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

function applyToDocument(mode: Mode) {
  const dark = resolveDark(mode);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  listeners.push(onChange);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getSnapshot() === "system") {
      applyToDocument("system");
      onChange();
    }
  };
  mq.addEventListener("change", onSystemChange);

  // The schedule. A timer to the next 8pm or 7am, re-armed each time it
  // fires; and a re-check whenever the tab comes back, since a laptop lid
  // closed at six and opened at nine has slept through the timer.
  let timer: number | undefined;
  const arm = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (getSnapshot() === "auto") applyToDocument("auto");
      arm();
    }, msUntilNextBoundary(new Date()) + 1000);
  };
  const onVisible = () => {
    if (document.visibilityState !== "visible") return;
    if (getSnapshot() === "auto") applyToDocument("auto");
    arm();
  };
  arm();
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    listeners = listeners.filter((l) => l !== onChange);
    mq.removeEventListener("change", onSystemChange);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearTimeout(timer);
  };
}

function setMode(mode: Mode) {
  cached = mode;
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private browsing. The toggle still works for this session. */
  }
  applyToDocument(mode);
  listeners.forEach((l) => l());
}

/* -------------------------------------------------------------------------- */

const options: { value: Mode; icon: typeof Sun; label: string; hint: string }[] = [
  { value: "light", icon: Sun, label: "Light", hint: "Always light" },
  { value: "auto", icon: SunMoon, label: "Evenings", hint: "Dark from 8pm to 7am" },
  { value: "system", icon: Monitor, label: "System", hint: "Follow this device" },
  { value: "dark", icon: Moon, label: "Dark", hint: "Always dark" },
];

/**
 * One button, four moods.
 *
 * The four-way radio group sat in every top bar as a row of icons that
 * nobody reads and everybody sees. The default is now a single button
 * showing the current mode; a click moves to the next one and the tooltip
 * names it. The full group is still there for a settings surface that wants
 * to show the choices side by side.
 */
export function ThemeToggle({
  className,
  expanded = false,
}: {
  className?: string;
  expanded?: boolean;
}) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!expanded) {
    const index = options.findIndex((o) => o.value === mode);
    const current = options[index === -1 ? 0 : index];
    const next = options[(index + 1) % options.length];
    const Icon = current.icon;
    return (
      <button
        type="button"
        aria-label={`Theme: ${current.label}. Switch to ${next.label}`}
        title={`${current.label}. Click for ${next.label.toLowerCase()}`}
        onClick={() => setMode(next.value)}
        className={cn(
          "press inline-flex size-10 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:size-9",
          className,
        )}
      >
        <Icon className="size-4" strokeWidth={2} />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {options.map(({ value, icon: Icon, label, hint }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          title={hint}
          onClick={() => setMode(value)}
          className={cn(
            "flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md px-2 text-footnote font-medium transition-colors",
            mode === value ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg",
          )}
        >
          <Icon className="size-4" strokeWidth={2} />
          {/* Words, not only glyphs: a moon and a monitor mean little on their own. */}
          <span className="hidden min-[400px]:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
