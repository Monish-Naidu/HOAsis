"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { isHoasisError, toError } from "@/lib/core/errors";

interface Props {
  children: ReactNode;
  /** Names the region so a user can tell which part failed. */
  label?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so one broken panel does not blank the whole page.
 *
 * This is a class because React only offers the lifecycle for it on classes.
 * `componentDidCatch` is where a real deployment would forward to Sentry; the
 * hook it calls is left injectable so tests can assert on it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: toError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    const detail = isHoasisError(error) ? error.describe() : error.message;
    console.error(`[hoasis] ${this.props.label ?? "render"} failed: ${detail}`);
  }

  private readonly reset = () => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold text-fg">
              {this.props.label ? `${this.props.label} could not load` : "Something broke here"}
            </p>
            <p className="mt-1 text-footnote leading-relaxed text-fg-muted">
              The rest of the page is fine. Try again, and if it keeps happening the detail
              below is what support needs.
            </p>
            <p className="mt-2 font-mono text-footnote text-fg-subtle">
              {isHoasisError(error) ? error.describe() : error.message}
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={this.reset}>
              <RotateCcw className="size-3.5" />
              Try again
            </Button>
          </div>
        </div>
      </Card>
    );
  }
}
