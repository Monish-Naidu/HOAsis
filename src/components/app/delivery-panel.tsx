"use client";

import { useState } from "react";
import { AlertTriangle, Mail, MessageSquare, Monitor, Send, Smartphone } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import {
  NOTICE_RULES,
  audienceFor,
  noticeRule,
  smsReadiness,
  type Channel,
  type NoticeKind,
} from "@/lib/delivery";
import { cn, pluralize } from "@/lib/utils";

const CHANNEL: Record<Channel, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  sms: { label: "Text", icon: Smartphone },
  portal: { label: "In the portal", icon: Monitor },
  mail: { label: "Post", icon: Send },
};

/**
 * How this notice actually reaches people, before it is written.
 *
 * The question nobody asks and the one that decides whether a fine survives:
 * does sending this electronically discharge the duty, or is the email a
 * courtesy on top of a letter that still has to go? A board that believes it
 * gave notice is in a worse position than one that knows it did not, so where
 * paper is the notice this says so first and loudest.
 *
 * The channel counts are the other half. "Forty households, one message" hides
 * that nine of them have no email and two asked not to be texted, and those
 * eleven are exactly the ones who later say they were never told.
 */
export function DeliveryPanel() {
  const { community } = useAppState();
  const [kind, setKind] = useState<NoticeKind>("dues-reminder");

  const rule = noticeRule(kind);
  // Nothing has been registered with the carriers, which is the honest state
  // and the reason text is offline rather than offered and silently dropped.
  const sms = smsReadiness({ ein: community.association.ein });
  const audience = audienceFor(community.owners, kind, {}, sms);

  return (
    <Card>
      <CardHeader
        icon={<MessageSquare className="size-4" />}
        title="How a notice reaches people"
        subtitle="Pick what you are sending. Not every notice may go every way."
      />

      <div className="border-b border-border px-5 py-4">
        <div className="flex flex-wrap gap-1.5">
          {NOTICE_RULES.map((r) => (
            <button
              key={r.kind}
              type="button"
              onClick={() => setKind(r.kind)}
              aria-pressed={kind === r.kind}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                kind === r.kind
                  ? "border-brand bg-brand-soft text-brand-soft-fg"
                  : "border-border-2 bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Said before the channel counts, because it changes what they mean. */}
      {rule.mailIsTheNotice ? (
        <div className="border-b border-border bg-warn-soft/40 px-5 py-4">
          <p className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <AlertTriangle className="size-4 text-warn" />
            For this one, the letter is the notice
          </p>
          <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{rule.why}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
            Send the email or portal copy as well if you like. It does not discharge the duty,
            and the association should not record it as though it had.
          </p>
        </div>
      ) : (
        <div className="border-b border-border px-5 py-4">
          <p className="text-[15px] leading-relaxed text-fg-muted">{rule.why}</p>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        {(Object.keys(CHANNEL) as Channel[]).map((channel) => {
          const { label, icon: Icon } = CHANNEL[channel];
          const count = audience.byChannel[channel];
          const allowed = rule.electronic.includes(channel) || channel === "mail";
          return (
            <div key={channel} className="px-5 py-4">
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-fg-muted">
                <Icon className="size-3.5" />
                {label}
              </p>
              <p
                className={cn(
                  "tnum mt-1 text-[24px] font-semibold leading-none tracking-[-0.02em]",
                  allowed && count > 0 ? "text-fg" : "text-fg-subtle",
                )}
              >
                {allowed ? count : "—"}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-fg-subtle">
                {!allowed
                  ? "Not for this notice"
                  : count === audience.total
                    ? "Every household"
                    : `of ${audience.total}`}
              </p>
            </div>
          );
        })}
      </div>

      {!sms.registered ? (
        <div className="border-t border-border px-5 py-4">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-fg">
            <Smartphone className="size-4 text-fg-muted" />
            Text is off
            <Badge tone="neutral">Not registered</Badge>
          </p>
          {/* A gate, not a maybe. Unregistered application to person traffic
              is filtered by the carriers without an error anybody sees. */}
          <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">
            Carriers filter unregistered traffic silently, so a reminder would look sent and
            never arrive. Three things unlock it:
          </p>
          <ul className="mt-2 space-y-1">
            {sms.missing.map((item) => (
              <li key={item} className="text-[13px] text-fg-muted">
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-subtle">
            Owners are asked separately whether they want texts at all. Having a number is not
            agreement, and an opt out stops it that day.
          </p>
        </div>
      ) : null}

      {audience.unreachable > 0 ? (
        <p className="border-t border-border px-5 py-3 text-[13px] leading-relaxed text-warn">
          {pluralize(audience.unreachable, "household")} cannot be reached any way at all.
          Those are the ones who later say they were never told.
        </p>
      ) : null}
    </Card>
  );
}
