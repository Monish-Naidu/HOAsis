"use client";

import { useState } from "react";
import { Send, Users, Wand2 } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { renderTemplate, TEMPLATE_TOKENS } from "@/lib/data";
import type { MessageTemplate } from "@/lib/data/templates";
import type { Owner } from "@/lib/types";
import { cn, money, todayIsoDate } from "@/lib/utils";

/**
 * Compose to a group from a saved template.
 *
 * Collections letters carry legal weight and set the tone of a relationship,
 * so the board writes the wording once and every send reuses it. Tokens are
 * filled from the owner record at send time, which is the only way a balance
 * in a letter is guaranteed to match the balance in the ledger.
 */
export function TemplateComposer({
  recipients,
  onClose,
  defaultTrigger = "past-due",
}: {
  recipients: Owner[];
  onClose: () => void;
  defaultTrigger?: MessageTemplate["trigger"];
}) {
  const { templates, saveTemplate, settings, community } = useAppState();
  const association = community.association;
  const { notify } = useToast();
  const [templateId, setTemplateId] = useState(
    templates.find((t) => t.trigger === defaultTrigger)?.id ?? templates[0]?.id,
  );
  const [editing, setEditing] = useState(false);

  const template = templates.find((t) => t.id === templateId);
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");

  function select(id: string) {
    const next = templates.find((t) => t.id === id);
    setTemplateId(id);
    setSubject(next?.subject ?? "");
    setBody(next?.body ?? "");
    setEditing(false);
  }

  /** The first recipient, filled in, so the board reads what an owner reads. */
  const preview = recipients[0]
    ? renderTemplate(body, {
        owner: recipients[0].displayName,
        unit: recipients[0].unit,
        balance: money(recipients[0].balanceCents),
        days_past_due: String(recipients[0].daysPastDue),
        association: settings.displayName,
        dues: money(association.duesCents),
        portal_link: `${settings.displayName.toLowerCase().replace(/\s+/g, "")}.hoasis.app/pay`,
      })
    : body;

  if (!template) return null;

  return (
    <Card className="mt-5">
      <CardHeader
        title="Message past due households"
        subtitle={`${recipients.length} recipients, each one filled in from their own record`}
        icon={<Users className="size-4" />}
        action={
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        }
      />

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => select(t.id)}
            aria-pressed={t.id === templateId}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
              t.id === templateId
                ? "border-navy-700 bg-brand-soft text-brand-soft-fg dark:border-navy-300"
                : "border-border text-fg-muted hover:bg-surface-2",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="px-5 py-4">
        <p className="text-[12px] text-fg-muted">{template.description}</p>

        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            Subject
          </span>
          <input
            value={editing ? subject : preview.split("\n")[0] && subject}
            onChange={(e) => setSubject(e.target.value)}
            readOnly={!editing}
            aria-label="Subject"
            className={cn(
              "h-9 w-full rounded-lg border border-border px-2.5 text-[13px] text-fg outline-none",
              editing ? "bg-surface-2" : "bg-surface",
            )}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
            {editing ? "Template" : "Preview for the first recipient"}
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-[11px] font-medium normal-case tracking-normal text-accent"
            >
              {editing ? "Show preview" : "Edit template"}
            </button>
          </span>
          <textarea
            rows={12}
            value={editing ? body : preview}
            onChange={(e) => setBody(e.target.value)}
            readOnly={!editing}
            aria-label={editing ? "Template body" : "Preview"}
            className={cn(
              "w-full resize-none rounded-lg border border-border px-3 py-2 font-mono text-[12px] leading-relaxed text-fg outline-none",
              editing ? "bg-surface-2" : "bg-surface",
            )}
          />
        </label>

        {editing ? (
          <div className="mt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              <Wand2 className="size-3" />
              Tokens
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_TOKENS.map((t) => (
                <button
                  key={t.token}
                  type="button"
                  title={t.meaning}
                  onClick={() => setBody((current) => `${current}${t.token}`)}
                  className="rounded-md border border-border px-2 py-0.5 font-mono text-[11px] text-fg-muted hover:bg-surface-2 hover:text-fg"
                >
                  {t.token}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        <Badge tone="neutral">{recipients.length} recipients</Badge>
        {editing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              saveTemplate({ ...template, subject, body, updatedDate: todayIsoDate() });
              setEditing(false);
              notify(`Saved "${template.name}"`);
            }}
          >
            Save template
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          disabled={recipients.length === 0}
          onClick={() => {
            notify(`Sent to ${recipients.length} households, each personalised`);
            onClose();
          }}
        >
          <Send className="size-3.5" />
          Send to {recipients.length}
        </Button>
      </div>
    </Card>
  );
}
