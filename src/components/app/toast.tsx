"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Action feedback.
 *
 * Some actions change something visible on screen and need no announcement.
 * Plenty do not: sending a notice, requesting a document, exporting a file.
 * Without a toast those read as broken buttons, which is the single most
 * common way a working feature feels unfinished.
 *
 * The toast springs up from the bottom edge, the icon pops in a beat after,
 * and a hairline along the bottom drains for as long as the toast will stay,
 * so nobody has to guess whether they still have time to press Undo.
 * A pointer or finger resting on a toast holds it, drain and all, and a
 * warning stays until it is closed: it is the one a slow reader must not miss.
 */

type ToastTone = "ok" | "info" | "warn";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
  /** 0 for a warning, which waits to be closed. */
  ms: number;
}

interface ToastApi {
  notify: (message: string, tone?: ToastTone, action?: ToastAction) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const ICON: Record<ToastTone, typeof Check> = {
  ok: Check,
  info: Info,
  warn: TriangleAlert,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, { handle: number; due: number; held: number | null }>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t.handle);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const start = useCallback(
    (id: number, ms: number) => {
      const handle = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { handle, due: Date.now() + ms, held: null });
    },
    [dismiss],
  );

  /** Stops the clock and remembers what was left. */
  const hold = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t || t.held !== null) return;
    window.clearTimeout(t.handle);
    t.held = Math.max(t.due - Date.now(), 0);
  }, []);

  const release = useCallback(
    (id: number) => {
      const t = timers.current.get(id);
      if (!t || t.held === null) return;
      // A couple of seconds at least, so moving away is not an instant close.
      start(id, Math.max(t.held, 2500));
    },
    [start],
  );

  const notify = useCallback(
    (message: string, tone: ToastTone = "ok", action?: ToastAction) => {
      const id = nextId.current++;
      // Long enough to read a sentence. An undo gets longer, because deciding
      // you did not mean it takes a moment longer than reading a confirmation.
      // Paced for a slower reader: four seconds was gone before some looked up.
      const ms = tone === "warn" ? 0 : action ? 12000 : 7000;
      setToasts((current) => [...current, { id, tone, message, action, ms }]);
      if (ms) start(id, ms);
    },
    [start],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICON[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "warn" ? "alert" : undefined}
              style={{ "--toast-ms": `${toast.ms}ms` } as React.CSSProperties}
              onPointerEnter={() => hold(toast.id)}
              onPointerLeave={() => release(toast.id)}
              onFocus={() => hold(toast.id)}
              onBlur={() => release(toast.id)}
              className={cn(
                "toast-in pointer-events-auto relative flex items-center gap-2.5 overflow-hidden rounded-card border py-1.5 pl-3.5 pr-1.5 shadow-float backdrop-blur-md hover:[&_.toast-drain]:[animation-play-state:paused] focus-within:[&_.toast-drain]:[animation-play-state:paused]",
                toast.tone === "ok" && "border-ok/25 bg-ok-soft text-ok",
                toast.tone === "info" && "border-border bg-surface/95 text-fg",
                toast.tone === "warn" && "border-warn/30 bg-warn-soft text-warn",
              )}
            >
              <span
                className={cn(
                  "pop-in flex size-5 shrink-0 items-center justify-center rounded-full",
                  toast.tone === "ok" && "bg-ok text-white",
                  toast.tone === "info" && "bg-primary text-primary-fg",
                  toast.tone === "warn" && "bg-warn text-white",
                )}
                style={{ animationDelay: "120ms" }}
              >
                <Icon className="size-3" strokeWidth={3} />
              </span>
              <p className="flex-1 py-1 text-body leading-snug">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="press min-h-10 shrink-0 rounded-md border border-current/30 px-3 text-footnote font-semibold hover:bg-current/10"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="press flex size-10 shrink-0 items-center justify-center rounded-md opacity-70 hover:bg-current/10 hover:opacity-100"
              >
                <X className="size-4" />
              </button>
              {toast.ms ? (
                <span
                  aria-hidden
                  className="toast-drain absolute inset-x-0 bottom-0 h-0.5 bg-current opacity-40"
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

/**
 * Returns a no-op outside a provider rather than throwing. A missing toast is
 * never a reason to blank a page.
 */
export function useToast(): ToastApi {
  return useContext(Ctx) ?? { notify: () => {} };
}
