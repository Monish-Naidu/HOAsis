"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

const STORAGE_KEY = "hoasis-theme";

/**
 * Runs before paint so the navy never flashes white on a dark-mode reload.
 */
export const themeScript = `(function(){try{var m=localStorage.getItem("${STORAGE_KEY}")||"system";var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

/* -------------------------------------------------------------------------- */
/* A tiny external store. The theme lives in localStorage and on <html>, not   */
/* in React, so useSyncExternalStore is the honest way to read it.            */
/* -------------------------------------------------------------------------- */

let listeners: (() => void)[] = [];
let cached: Mode | null = null;

function read(): Mode {
  try {
    return (localStorage.getItem(STORAGE_KEY) as Mode) || "system";
  } catch {
    return "system";
  }
}

function getSnapshot(): Mode {
  if (cached === null) cached = read();
  return cached;
}

function getServerSnapshot(): Mode {
  return "system";
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
  return () => {
    listeners = listeners.filter((l) => l !== onChange);
    mq.removeEventListener("change", onSystemChange);
  };
}

function applyToDocument(mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
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

const options: { value: Mode; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5",
        className,
      )}
      role="radiogroup"
      aria-label="Color theme"
    >
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={mode === value}
          aria-label={label}
          title={label}
          onClick={() => setMode(value)}
          className={cn(
            "flex size-7 items-center justify-center rounded-md transition-colors",
            mode === value ? "bg-surface-3 text-fg" : "text-fg-subtle hover:text-fg-muted",
          )}
        >
          <Icon className="size-3.5" strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
