"use client";

import { useCallback, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldClass } from "@/components/ui/primitives";

/**
 * A signature, drawn or typed.
 *
 * Both are offered because both are used. Somebody on a phone draws with a
 * finger; somebody on a laptop with a trackpad produces a scrawl they are
 * embarrassed by and types instead. In most states an electronic signature is
 * valid either way, and what actually makes it enforceable is the typed legal
 * name plus a clear statement of what is being agreed, so the typed name is
 * required and the drawing is optional.
 */
export function SignaturePad({
  typedName,
  onTypedName,
  onDrawn,
  statement,
}: {
  typedName: string;
  onTypedName: (value: string) => void;
  onDrawn: (dataUrl: string | undefined) => void;
  statement: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  /** Sizes the backing store to the device, so the line is not blurry. */
  const attach = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (!node) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = node.getBoundingClientRect();
    node.width = rect.width * ratio;
    node.height = rect.height * ratio;
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = pointFrom(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointFrom(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk) setHasInk(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) onDrawn(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onDrawn(undefined);
  }

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-body font-semibold text-fg">
        <PenLine className="size-4" />
        Sign
      </p>
      <p className="mt-1.5 text-footnote leading-relaxed text-fg-muted">{statement}</p>

      <label className="mt-3 block">
        <span className="text-footnote font-semibold text-fg-muted">
          Type your full legal name
        </span>
        <input
          value={typedName}
          onChange={(e) => onTypedName(e.target.value)}
          autoComplete="name"
          placeholder="Rhea Calloway"
          className={cn(fieldClass, "mt-1.5 font-[family-name:var(--font-signature,inherit)] text-title3")}
        />
      </label>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-footnote font-semibold text-fg-muted">
            Draw it, if you would rather
          </span>
          {hasInk ? (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-footnote font-medium text-fg-muted transition-colors hover:text-fg"
            >
              <Eraser className="size-3.5" />
              Clear
            </button>
          ) : null}
        </div>
        <canvas
          ref={attach}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label="Draw your signature"
          className={cn(
            "mt-1.5 h-28 w-full touch-none rounded-lg border border-dashed bg-surface-2",
            hasInk ? "border-brand" : "border-border-2",
          )}
        />
        {!hasInk ? (
          <p className="mt-1 text-footnote text-fg-subtle">
            Optional. The typed name above is what makes this binding.
          </p>
        ) : null}
      </div>
    </div>
  );
}
