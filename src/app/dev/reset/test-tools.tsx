"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Card } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

/**
 * Clearing test data.
 *
 * Two scopes, because they are different jobs. Deleting one association is
 * what somebody does twenty times a day while working on onboarding. Deleting
 * everything is what somebody does once, before a demo, and should feel
 * heavier than a click.
 *
 * Neither uses the product's own deletion flow, which is soft, reversible and
 * President only. That is correct for a board and useless for tidying up.
 */

interface Association {
  id: string;
  name: string;
  city: string;
  state: string;
  created_at: string;
  deleted_at: string | null;
  homes: number;
  payments: number;
}

const noopSubscribe = () => () => {};

export function TestTools() {
  // Fetched once on mount without an effect, which this repo's lint rule
  // forbids. `useSyncExternalStore` gives a stable server snapshot and the
  // load is kicked off by the first render on the client.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const [state, setState] = useState<{
    loading: boolean;
    enabled: boolean;
    reason?: string;
    associations: Association[];
  }>({ loading: true, enabled: false, associations: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [keepEmail, setKeepEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const response = await fetch("/api/dev/associations");
      const body = await response.json();
      setState({
        loading: false,
        enabled: Boolean(body.enabled),
        reason: body.reason,
        associations: body.associations ?? [],
      });
    } catch {
      setState({
        loading: false,
        enabled: false,
        reason: "Could not reach the server.",
        associations: [],
      });
    }
  }, []);

  if (mounted && !loadedOnce) {
    setLoadedOnce(true);
    void load();
  }

  async function deleteOne(association: Association) {
    setBusy(association.id);
    try {
      const response = await fetch(`/api/dev/associations?id=${association.id}`, {
        method: "DELETE",
      });
      const body = await response.json();
      setNote(response.ok ? `Deleted ${association.name}` : body.error);
      if (response.ok) await load();
    } finally {
      setBusy(null);
    }
  }

  async function nuke() {
    setBusy("all");
    try {
      const response = await fetch("/api/dev/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm, keepEmail: keepEmail.trim() }),
      });
      const body = await response.json();
      if (!response.ok) {
        setNote(body.error);
        return;
      }
      setNote(
        `Cleared. ${body.removed.associations ?? 0} associations and ${
          body.removed.accounts ?? 0
        } accounts removed.`,
      );
      setConfirm("");
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (state.loading) {
    return <div className="h-40 animate-pulse rounded-card bg-surface-2" />;
  }

  if (!state.enabled) {
    return (
      <Callout tone="warn" title="Test tools are switched off">
        {state.reason ??
          "Set ALLOW_TEST_RESET=true on the server to enable them. Never do that in production."}
      </Callout>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-fg">Test data</h1>
        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
          Deletes real rows, permanently, with none of the product&apos;s usual guards. It exists
          because clearing up after a test run should not require the ceremony a board needs.
        </p>
      </div>

      {note ? <Callout tone="info" title={note} /> : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
            Associations
          </h2>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>

        {state.associations.length ? (
          <div className="divide-y divide-border">
            {state.associations.map((association) => (
              <div key={association.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[15px] font-medium text-fg">
                      {association.name}
                    </p>
                    {association.deleted_at ? <Badge tone="warn">Soft deleted</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-[13px] text-fg-muted">
                    {association.city}, {association.state} · {association.homes}{" "}
                    {association.homes === 1 ? "home" : "homes"} · {association.payments}{" "}
                    {association.payments === 1 ? "payment" : "payments"} · created{" "}
                    {formatDate(association.created_at.slice(0, 10))}
                  </p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy === association.id}
                  onClick={() => void deleteOne(association)}
                >
                  <Trash2 className="size-3.5" />
                  {busy === association.id ? "Deleting" : "Delete"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-[15px] text-fg-muted">
            No associations. The database is empty.
          </p>
        )}
      </Card>

      <Card className="overflow-hidden border-danger/30">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em] text-fg">
            <AlertTriangle className="size-4 text-danger" />
            Clear everything
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
            Every association, every account, and every uploaded photo. Name one address
            below to spare it, so you keep a way back in.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-fg">
              Keep this account, optional
            </span>
            <input
              value={keepEmail}
              onChange={(e) => setKeepEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-fg">
              Type <span className="font-mono font-semibold">DELETE EVERYTHING</span>
            </span>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE EVERYTHING"
              autoComplete="off"
              className="h-10 w-full rounded-lg border border-border bg-surface px-3 font-mono text-[15px] text-fg outline-none focus:border-danger"
            />
          </label>
          <Button
            variant="danger"
            size="md"
            className="self-start"
            disabled={busy === "all" || confirm !== "DELETE EVERYTHING"}
            onClick={() => void nuke()}
          >
            {busy === "all" ? "Clearing" : "Clear the database"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
