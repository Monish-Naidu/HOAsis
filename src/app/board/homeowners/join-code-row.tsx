"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/app/toast";

/**
 * The association's join code where the board works, with the two things
 * done with it: hand over the code, or hand over a link that carries it.
 * The code itself is set in Settings; this only shows it.
 */
export function JoinCodeRow({ code }: { code: string }) {
  const { notify } = useToast();

  function copy(text: string, said: string) {
    void navigator.clipboard?.writeText(text).then(
      () => notify(said, "ok"),
      () => notify(text, "info"),
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-footnote font-semibold text-fg-muted">Join code</span>
      <span className="tnum rounded-lg border border-border bg-surface-2 px-2.5 py-1 font-mono text-body font-semibold tracking-[0.2em] text-fg">
        {code}
      </span>
      <Button variant="ghost" size="sm" onClick={() => copy(code, "Join code copied")}>
        <Copy className="size-3.5" />
        Copy code
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => copy(`${window.location.origin}/join?code=${code}`, "Join link copied")}
      >
        <Copy className="size-3.5" />
        Copy link
      </Button>
    </div>
  );
}
