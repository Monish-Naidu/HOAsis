"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Paperclip, ScrollText } from "lucide-react";
import { Badge, Button, Callout, Card, EmptyState, Select, fieldClass, textareaClass } from "@/components/ui/primitives";
import { SignaturePad } from "@/components/app/signature-pad";
import { useAppState, useCurrentOwner } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import type { FormField, FormSubmission, HomeRequest } from "@/lib/types";
import { cn, addDays, formatDate, todayIsoDate } from "@/lib/utils";
import { confirmedReference } from "@/lib/request-reference";

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
  const { community, requests, addRequest, isRemote } = useAppState();
  const owner = useCurrentOwner();
  const { notify } = useToast();
  const router = useRouter();

  const form = community.forms.find((f) => f.id === formId);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [typedName, setTypedName] = useState("");
  const [drawn, setDrawn] = useState<string | undefined>();
  const [submitted, setSubmitted] = useState<HomeRequest | null>(null);
  // The number to show once it is sent, or null when only the database
  // knows it (see `confirmedReference`).
  const [reference, setReference] = useState<string | null>(null);
  // True while the write is being waited on, so a second press cannot send
  // the application twice.
  const [sending, setSending] = useState(false);
  // The write came back refused. Said on the form, which is still filled in.
  const [failed, setFailed] = useState(false);

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
          <p className="text-headline font-semibold text-fg">{form.label}</p>
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">{form.description}</p>
          {/* There is no file behind a form, so nothing here offers one. */}
          <Callout tone="info" className="mt-4" title="This one is still a printed form">
            Ask the board for a copy, fill it in, and attach it to a request. Ask them to add
            the questions here and you will be able to complete it on your phone instead.
          </Callout>
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

  async function submit() {
    if (!owner || !form || !canSubmit || sending) return;
    const seq = 200 + requests.length;
    // The form's own number. Right for the demo; a guess for a real
    // association, where the database numbers the request.
    const guessed = `REQ-${todayIsoDate().slice(0, 4)}-${seq}`;

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
      reference: guessed,
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
          actor: "Your HOAsis",
          actorRole: "system",
          body: dueDate
            ? `The committee has until ${formatDate(dueDate, "medium")} to decide.`
            : "Routed to the architectural committee.",
          kind: "status",
        },
      ],
      submission,
    };

    // Same as the new request form: when the state layer answers with a
    // promise of the stored number (null for a write that failed), wait for
    // it, and stay on the form on a failure instead of saying it was sent.
    const answer: unknown = addRequest(request);
    let stored: unknown;
    if (answer instanceof Promise) {
      setSending(true);
      setFailed(false);
      stored = await answer;
      setSending(false);
      if (stored === null || stored === false) {
        setFailed(true);
        return;
      }
    }
    const shown = confirmedReference({ isRemote, guessed, stored });
    setReference(shown);
    setSubmitted(request);
    notify(shown ? `Submitted as ${shown}` : "Submitted");
  }

  if (submitted) {
    return (
      <div className="space-y-4">
        <Card className="p-5 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-soft text-ok">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="mt-3 text-title3 font-semibold text-fg">Sent to the committee</p>
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
            {reference ? (
              <>
                Your reference is <span className="font-semibold text-fg">{reference}</span>.
              </>
            ) : (
              "Its number is in your requests."
            )}{" "}
            A copy of what you signed is attached to it.
          </p>
          {submitted.dueDate ? (
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-footnote leading-relaxed text-fg-muted">
              The committee decides by {formatDate(submitted.dueDate, "long")}.{" "}
              {submitted.dueReason}
            </p>
          ) : null}
          <div className="mt-4 flex justify-center gap-2">
            {/* A real association's request is stored under the database's
                number, not the form's, so the form's number is no address
                for it. The list is where it is found. */}
            <Link
              href={isRemote ? "/resident/requests" : `/resident/requests/${submitted.reference}`}
              className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-body font-semibold text-brand-fg"
            >
              Track it
            </Link>
            <button
              type="button"
              onClick={() => router.push("/resident/documents")}
              className="inline-flex h-10 items-center rounded-lg border border-border-2 bg-surface px-4 text-body font-medium text-fg"
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
        <h1 className="text-title2 font-semibold tracking-[-0.025em] text-fg">{form.label}</h1>
        <p className="mt-1 text-body leading-relaxed text-fg-muted">{form.description}</p>
        {form.governedBy ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              <ScrollText className="mr-1 inline size-3" />
              {form.governedBy}
            </Badge>
            {form.decisionDays ? (
              <span className="text-footnote text-fg-muted">
                The committee answers within {form.decisionDays} days
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

      <Button
        size="lg"
        className="w-full"
        disabled={!canSubmit || sending}
        onClick={() => void submit()}
      >
        Sign and submit
      </Button>
      {failed ? (
        <p role="alert" className="text-center text-footnote text-danger">
          That did not send. Nothing was submitted. Try again.
        </p>
      ) : null}
      <p className="pb-2 text-center text-footnote text-fg-subtle">
        You will get a reference number and a copy of what you signed.
      </p>
    </div>
  );
}

function Back() {
  return (
    <Link
      href="/resident/documents"
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-body font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
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
    fieldClass;

  return (
    <div className="px-4 py-3.5">
      <label className="block">
        <span className="text-body font-medium text-fg">
          {field.label}
          {field.required ? <span className="ml-1 text-danger">*</span> : null}
        </span>

        {field.kind === "long" ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            placeholder={field.placeholder}
            className={cn(textareaClass, "mt-1.5")}
          />
        ) : field.kind === "choice" ? (
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="mt-1.5 w-full [&>select]:h-11 [&>select]:text-body"
          >
            <option value="">Choose one</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        ) : field.kind === "checkbox" ? (
          <span className="mt-1.5 flex items-center gap-2">
            <input
              type="checkbox"
              checked={value === "Yes"}
              onChange={(e) => onChange(e.target.checked ? "Yes" : "No")}
              className="size-4 rounded border-border-2"
            />
            <span className="text-body text-fg-muted">Yes</span>
          </span>
        ) : field.kind === "file" ? (
          <span className="mt-1.5 block">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-2 bg-surface px-3 text-body font-medium text-fg transition-colors hover:bg-surface-2">
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
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-footnote text-fg"
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
        <p className="mt-1 text-footnote text-fg-subtle">In {field.suffix}.</p>
      ) : null}
      {field.help ? (
        <p className="mt-1.5 text-footnote leading-relaxed text-fg-muted">{field.help}</p>
      ) : null}
    </div>
  );
}
