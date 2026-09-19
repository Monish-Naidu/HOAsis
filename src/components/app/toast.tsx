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

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "ok", action?: ToastAction) => {
      const id = nextId.current++;
      // Long enough to read a sentence. An undo gets longer, because deciding
      // you did not mean it takes a moment longer than reading a confirmation.
      const ms = action ? 8000 : 4000;
      setToasts((current) => [...current, { id, tone, message, action, ms }]);
      setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
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
              style={{ "--toast-ms": `${toast.ms}ms` } as React.CSSProperties}
              className={cn(
                "toast-in pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-card border px-3.5 py-2.5 shadow-float backdrop-blur-md",
                toast.tone === "ok" && "border-ok/25 bg-ok-soft text-ok",
                toast.tone === "info" && "border-border bg-surface/95 text-fg",
                toast.tone === "warn" && "border-warn/30 bg-warn-soft text-warn",
              )}
            >
              <span
                className={cn(
                  "pop-in mt-px flex size-5 shrink-0 items-center justify-center rounded-full",
                  toast.tone === "ok" && "bg-ok text-white",
                  toast.tone === "info" && "bg-primary text-primary-fg",
                  toast.tone === "warn" && "bg-warn text-white",
                )}
                style={{ animationDelay: "120ms" }}
              >
                <Icon className="size-3" strokeWidth={3} />
              </span>
              <p className="flex-1 text-[15px] leading-snug">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="press shrink-0 rounded-md border border-current/30 px-2 py-0.5 text-[13px] font-semibold hover:bg-current/10"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="press shrink-0 opacity-60 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
              <span
                aria-hidden
                className="toast-drain absolute inset-x-0 bottom-0 h-0.5 bg-current opacity-40"
              />
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
