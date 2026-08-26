"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, Paperclip, ScrollText } from "lucide-react";
import { Badge, Button, Callout, Card, EmptyState } from "@/components/ui/primitives";
import { SignaturePad } from "@/components/app/signature-pad";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { FormField, FormSubmission, HomeRequest } from "@/lib/types";
import { addDays, formatDate, todayIsoDate } from "@/lib/utils";

/**
 * Filling in a form on the page rather than printing it.
 *
 * The whole point is that this ends as a request the board can act on, not as
 * a PDF in an inbox. Printing, signing, scanning and emailing is where roughly
 * half of architectural applications die, and the association then has no
 * record of when the clock started, which is the part that gets boards sued.
 *
 * So a completed form produces a reference number, a response deadline read
 * from the association's own bylaws, and a thread. The signature is stored
 * with the statement the signer agreed to, not with a pointer to it.
 */
export function FillForm({ formId }: { formId: string }) {
  const { community, requests, addRequest } = useAppState();
  const owner = useCurrentOwner();
  const { notify } = useToast();
  const router = useRouter();

  const form = community.forms.find((f) => f.id === formId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [typedName, setTypedName] = useState("");
  const [drawn, setDrawn] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState<HomeRequest | null>(null);

  const statement = useMemo(
    () =>
      form
        ? `I am an owner at ${community.association.name}, the information above is accurate, and I will not begin work until the association approves it in writing.`
        : "",
    [form, community.association.name],
  );

  if (!form) {
    return (
      <Card>
        <EmptyState title="No such form" description="It may have been replaced." />
      </Card>
    );
  }

  if (!form.fields || form.fields.length === 0) {
    return (
      <div className="space-y-4">
        <Back />
        <Card className="p-5">
          <p className="text-[17px] font-semibold text-fg">{form.label}</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{form.description}</p>
          <Callout tone="info" className="mt-4" title="This one is still a printed form">
            Download it, fill it in, and attach it to a request. Ask the board to add the
            questions here and you will be able to complete it on your phone instead.
          </Callout>
          <Button variant="secondary" className="mt-4">
            <Download className="size-4" />
            {form.fileName}
          </Button>
        </Card>
      </div>
    );
  }

  const missing = form.fields.filter((field) => {
    if (!field.required) return false;
    if (field.kind === "file") return (files[field.id] ?? []).length === 0;
    if (field.kind === "checkbox") return answers[field.id] !== "Yes";
    return !(answers[field.id] ?? "").trim();
  });
  const canSubmit = missing.length === 0 && typedName.trim().length > 1;

  function submit() {
    if (!owner || !form || !canSubmit) return;
    const seq = 200 + requests.length;
    const reference = `REQ-${todayIsoDate().slice(0, 4)}-${seq}`;

    const submission: FormSubmission = {
      formId: form.id,
      formLabel: form.label,
      answers: form.fields!.map((field) => ({
        fieldId: field.id,
        label: field.label,
        value:
          field.kind === "file"
            ? (files[field.id] ?? []).join(", ")
            : (answers[field.id] ?? ""),
      })),
      signature: {
        drawn,
        typedName: typedName.trim(),
        signedAt: todayIsoDate(),
        statement,
      },
    };

    // The deadline comes from the association's own article, not a default, so
    // an association with a thirty day rule does not see forty-five.
    const dueDate = form.decisionDays
      ? addDays(todayIsoDate(), form.decisionDays)
      : undefined;

    const request: HomeRequest = {
      id: `req-${seq}`,
      reference,
      kind: "architectural",
      title: form.label,
      summary: submission.answers
        .filter((a) => a.value)
        .slice(0, 3)
        .map((a) => `${a.label}: ${a.value}`)
        .join(". "),
      ownerId: owner.id,
      ownerName: owner.displayName,
      unit: owner.unit,
      status: "submitted",
      submittedDate: todayIsoDate(),
      dueDate,
      dueReason: form.governedBy
        ? `${form.governedBy}. Not decided within ${form.decisionDays} days is deemed approved.`
        : undefined,
      attachments: Object.values(files)
        .flat()
        .map((name) => ({ name, size: "attached" })),
      thread: [
        {
          id: `rt-${seq}-1`,
          at: todayIsoDate(),
          actor: owner.members[0],
          actorRole: "resident",
          body: `Submitted ${form.label}, signed by ${typedName.trim()}.`,
          kind: "note",
        },
        {
          id: `rt-${seq}-2`,
          at: todayIsoDate(),
          actor: "HOAsis",
          actorRole: "system",
          body: dueDate
            ? `The committee has until ${formatDate(dueDate, "medium")} to decide.`
            : "Routed to the architectural committee.",
          kind: "status",
        },
      ],
      submission,
    };

    addRequest(request);
    setSubmitted(request);
    notify(`Submitted as ${reference}`);
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Card className="p-5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="mt-3 text-[19px] font-semibold text-fg">Sent to the committee</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
            Your reference is{" "}
            <span className="font-semibold text-fg">{submitted.reference}</span>. A copy of
            what you signed is attached to it.
          </p>
          {submitted.dueDate ? (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-fg-muted">
              They have until {formatDate(submitted.dueDate, "long")} to decide.{" "}
              {submitted.dueReason}
            </p>
          ) : null}
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href={`/resident/requests/${submitted.reference}`}
              className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-[15px] font-semibold text-brand-fg"
            >
              Track it
            </Link>
            <button
              type="button"
              onClick={() => router.push("/resident/documents")}
              className="inline-flex h-10 items-center rounded-lg border border-border-2 bg-surface px-4 text-[15px] font-medium text-fg"
            >
              Documents
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Back />

      <div>
        <h1 className="text-[24px] font-semibold tracking-[-0.025em] text-fg">{form.label}</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{form.description}</p>
        {form.governedBy ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              <ScrollText className="mr-1 inline size-3" />
              {form.governedBy}
            </Badge>
            {form.decisionDays ? (
              <span className="text-[13px] text-fg-muted">
                They have {form.decisionDays} days to answer
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="divide-y divide-border">
        {form.fields.map((field) => (
          <Field
            key={field.id}
            field={field}
            value={answers[field.id] ?? ""}
            files={files[field.id] ?? []}
            onChange={(value) => setAnswers((a) => ({ ...a, [field.id]: value }))}
            onFiles={(names) => setFiles((f) => ({ ...f, [field.id]: names }))}
          />
        ))}
      </Card>

      <SignaturePad
        typedName={typedName}
        onTypedName={setTypedName}
        onDrawn={setDrawn}
        statement={statement}
      />

      {missing.length > 0 ? (
        <Callout tone="warn" title={`${missing.length} still to fill in`}>
          {missing.map((f) => f.label).join(", ")}.
        </Callout>
      ) : null}

      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
        Sign and submit
      </Button>
      <p className="pb-2 text-center text-[13px] text-fg-subtle">
        You will get a reference number and a copy of what you signed.
      </p>
    </div>
  );
}

function Back() {
  return (
    <Link
      href="/resident/documents"
      className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg"
    >
      <ArrowLeft className="size-3.5" />
      Documents
    </Link>
  );
}

function Field({
  field,
  value,
  files,
  onChange,
  onFiles,
}: {
  field: FormField;
  value: string;
  files: string[];
  onChange: (value: string) => void;
  onFiles: (names: string[]) => void;
}) {
  const input =
    "h-11 w-full rounded-lg border border-border-2 bg-surface px-3 text-[15px] text-fg outline-none transition-colors focus:border-brand";

  return (
    <div className="px-4 py-3.5">
      <label className="block">
        <span className="text-[15px] font-medium text-fg">
          {field.label}
          {field.required ? <span className="ml-1 text-danger">*</span> : null}
        </span>

        {field.kind === "long" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={field.placeholder}
            className="mt-1.5 w-full rounded-lg border border-border-2 bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-fg outline-none focus:border-brand"
          />
        ) : field.kind === "choice" ? (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`mt-1.5 ${input}`}
          >
            <option value="">Choose one</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.kind === "checkbox" ? (
          <span className="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === "Yes"}
              onChange={(e) => onChange(e.target.checked ? "Yes" : "No")}
              className="size-4 rounded border-border-2"
            />
            <span className="text-[15px] text-fg-muted">Yes</span>
          </span>
        ) : field.kind === "file" ? (
          <span className="mt-1.5 block">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-2 bg-surface px-3 text-[15px] font-medium text-fg transition-colors hover:bg-surface-2">
              <Paperclip className="size-4" />
              {files.length > 0 ? "Add more" : "Choose files"}
              <input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []).map((f) => f.name);
                  if (picked.length) onFiles([...files, ...picked]);
                  e.target.value = "";
                }}
              />
            </label>
            {files.length > 0 ? (
              <span className="mt-2 block space-y-1">
                {files.map((name) => (
                  <span
                    key={name}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => onFiles(files.filter((f) => f !== name))}
                      className="text-fg-subtle transition-colors hover:text-danger"
                    >
                      Remove
                    </button>
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        ) : (
          <input
            type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={`mt-1.5 ${input}`}
          />
        )}
      </label>

      {field.suffix && field.kind === "number" ? (
        <p className="mt-1 text-[13px] text-fg-subtle">In {field.suffix}.</p>
      ) : null}
      {field.help ? (
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{field.help}</p>
      ) : null}
    </div>
  );
}
