"use client";

import { useState } from "react";
import { resendConfirmation } from "./resend-confirmation";

/**
 * "Send it again" under a message that says to check an inbox.
 *
 * One line wherever an unconfirmed address is the only thing between a
 * person and their account: the join page, the sign-in page's create-account
 * notice and the setup wizard's two waiting states. Says "Sent again" when
 * the email went, or the refusal in the route's own words, such as the
 * limiter's "Too many attempts".
 */
export function ResendLine({ email }: { email: string }) {
  const [state, setState] = useState<
    { kind: "idle" | "sending" | "sent" } | { kind: "refused"; message: string }
  >({
    kind: "idle",
  });
  return (
    <p className="mt-4 text-footnote text-fg-muted">
      Nothing yet? Check your spam folder, or{" "}
      <button
        type="button"
        disabled={state.kind === "sending"}
        onClick={async () => {
          setState({ kind: "sending" });
          const result = await resendConfirmation(email);
          setState(result.ok ? { kind: "sent" } : { kind: "refused", message: result.message });
        }}
        className="font-medium text-accent hover:underline disabled:opacity-60"
      >
        {state.kind === "sending" ? "Sending" : "Send it again"}
      </button>
      .{" "}
      {state.kind === "sent" || state.kind === "refused" ? (
        // Only once there is something to say: an empty live region beside
        // another one (the notice this line sits under) says nothing twice.
        <span role="status" className={state.kind === "refused" ? "text-danger" : undefined}>
          {state.kind === "refused" ? state.message : "Sent again"}
        </span>
      ) : null}
    </p>
  );
}
