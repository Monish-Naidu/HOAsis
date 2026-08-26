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
      setToasts((current) => [...current, { id, tone, message, action }]);
      // Long enough to read a sentence. An undo gets longer, because deciding
      // you did not mean it takes a moment longer than reading a confirmation.
      setTimeout(() => dismiss(id), action ? 8000 : 4000);
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
              className={cn(
                "animate-rise pointer-events-auto flex items-start gap-2.5 rounded-card border px-3.5 py-2.5 shadow-float",
                toast.tone === "ok" && "border-ok/25 bg-ok-soft text-ok",
                toast.tone === "info" && "border-border bg-surface text-fg",
                toast.tone === "warn" && "border-warn/30 bg-warn-soft text-warn",
              )}
            >
              <Icon className="mt-px size-4 shrink-0" />
              <p className="flex-1 text-[15px] leading-snug">{toast.message}</p>
              {toast.action ? (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="shrink-0 rounded-md border border-current/30 px-2 py-0.5 text-[13px] font-semibold hover:bg-current/10"
                >
                  {toast.action.label}
                </button>
              ) : null}
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(toast.id)}
                className="shrink-0 opacity-60 hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
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
