"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Copy, FileText, Download } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { portingPlan, recordsDemandLetter } from "@/lib/porting";
import { profileFromCommunity } from "@/lib/setup-plan";
import { formatDate, todayIsoDate } from "@/lib/utils";

/**
 * Bringing an existing association across.
 *
 * Shown only when the board told us they have something to bring. A brand new
 * association gets the constituting steps instead, and one that answered
 * nothing sees this not at all rather than a generic import prompt.
 */
export function PortingCard() {
  const { community } = useAppState();
  const profile = profileFromCommunity(community);
  const plan = portingPlan(profile.origin);
  const [letterOpen, setLetterOpen] = useState(false);

  if (!plan) return null;

  return (
    <section className="mt-8">
      <Card>
        <CardHeader
          icon={<ArrowRight className="size-4" />}
          title={plan.title}
          subtitle={plan.lede}
        />
        <ol className="divide-y divide-border">
          {plan.steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3 px-5 py-4">
              <span className="tnum mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[13px] font-semibold text-fg-muted">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-fg">{step.title}</p>
                <p className="mt-0.5 text-[15px] leading-relaxed text-fg-muted">{step.detail}</p>
                {/* Order is the whole argument in the manager case, so the
                    reason it sits here is stated rather than implied. */}
                {step.because ? (
                  <p className="mt-1.5 border-l-2 border-border-2 pl-3 text-[13px] leading-relaxed text-fg-muted">
                    {step.because}
                  </p>
                ) : null}

                {step.action === "records-letter" ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-3"
                    onClick={() => setLetterOpen((v) => !v)}
                  >
                    <FileText className="size-4" />
                    {letterOpen ? "Hide the letter" : "Write the letter"}
                  </Button>
                ) : step.href ? (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
                  >
                    Open
                    <ArrowRight className="size-3" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {letterOpen ? <RecordsLetter onClose={() => setLetterOpen(false)} /> : null}
    </section>
  );
}

/**
 * The demand itself, filled in and ready to sign.
 *
 * Not a template with blanks. A board asked to fill in blanks writes a worse
 * letter than the one we would have written, or does not send it at all.
 */
function RecordsLetter({ onClose }: { onClose: () => void }) {
  const { community, account } = useAppState();
  const { notify } = useToast();
  const [manager, setManager] = useState("");

  const text = recordsDemandLetter({
    associationName: community.association.name,
    stateName: community.association.stateName,
    managerName: manager,
    boardMemberName: account?.name ?? "[your name]",
    boardRole: account?.role
      ? account.role.charAt(0).toUpperCase() + account.role.slice(1)
      : "Board member",
    today: formatDate(todayIsoDate(), "long"),
  });

  return (
    <Card className="mt-4">
      <CardHeader
        icon={<FileText className="size-4" />}
        title="Demand for association records"
        subtitle="Send it by a method that produces a receipt, and keep the receipt"
        action={
          <Badge tone="warn">Send before you give notice</Badge>
        }
      />
      <div className="px-5 py-4">
        <label className="block max-w-sm">
          <span className="text-[13px] font-semibold text-fg-muted">
            Your management company
          </span>
          <input
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            placeholder="Cascade Community Management"
            className="mt-1.5 h-10 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none focus:border-brand"
          />
        </label>

        <pre className="mt-4 max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-card border border-border bg-surface-2 p-4 font-mono text-[13px] leading-relaxed text-fg">
          {text}
        </pre>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(text);
              notify("Letter copied. Paste it into your email or letterhead.");
            }}
          >
            <Copy className="size-4" />
            Copy the letter
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `records-demand-${community.association.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              notify("Downloaded");
            }}
          >
            <Download className="size-4" />
            Download
          </Button>
          <Button variant="ghost" onClick={onClose}>
            <Check className="size-4" />
            Done
          </Button>
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
          The letter states the obligation rather than quoting a statute number, because the
          deadline differs in every state and is the kind of detail that is wrong two sessions
          later. Your state&apos;s own page carries the citation.
        </p>
      </div>
    </Card>
  );
}
