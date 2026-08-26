"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button, Card } from "@/components/ui/primitives";
import { setNewPassword } from "@/lib/auth";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Choosing a new password.
 *
 * Reached only through a reset link, which the callback has already exchanged
 * for a session by the time anybody lands here. That is why there is no old
 * password field: proving you can read the mailbox is the proof.
 */
export function ResetPanel() {
  const auth = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "danger" | "ok"; text: string } | null>(null);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = again.length > 0 && again !== password;
  const ready = password.length >= 8 && password === again;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await setNewPassword(password);
    setBusy(false);
    if (!result.ok) {
      setNotice({ tone: "danger", text: result.message ?? "That did not work." });
      return;
    }
    setNotice({ tone: "ok", text: "Password changed. Taking you in." });
    router.push("/resident");
  }

  if (auth.loading) return <Card className="h-48 animate-pulse bg-surface-2" />;

  if (!auth.user) {
    return (
      <Card className="p-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          This link is not valid
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
          Reset links expire, and each one works once. Ask for another from the sign in page.
        </p>
        <Button
          variant="secondary"
          size="md"
          className="mt-5"
          onClick={() => router.push("/signin")}
        >
          Back to sign in
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
        Choose a new password
      </h1>
      <p className="mt-1.5 text-[13px] text-fg-muted">Signing in as {auth.user.email}.</p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-fg">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
          />
          {tooShort ? (
            <span className="mt-1 block text-[13px] text-danger">
              At least 8 characters.
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-fg">Type it again</span>
          <input
            type="password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            autoComplete="new-password"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
          />
          {mismatch ? (
            <span className="mt-1 block text-[13px] text-danger">
              These do not match.
            </span>
          ) : null}
        </label>

        {notice ? (
          <p
            role="status"
            className={cn(
              "rounded-lg px-3 py-2 text-[13px]",
              notice.tone === "danger" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
            )}
          >
            {notice.text}
          </p>
        ) : null}

        <Button
          variant="primary"
          size="lg"
          type="submit"
          className="w-full"
          disabled={busy || !ready}
        >
          {busy ? "Saving" : "Save the new password"}
          <ArrowRight className="size-4" />
        </Button>
      </form>
    </Card>
  );
}
