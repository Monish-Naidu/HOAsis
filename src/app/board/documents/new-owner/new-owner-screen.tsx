"use client";

import Link from "next/link";
import { ArrowLeft, Copy, FileText, Scale } from "lucide-react";
import {
  Button,
  Callout,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { DisclosureSummary } from "@/components/app/disclosure-summary";
import { useAppState } from "@/lib/app-state";
import { useToast } from "@/components/app/toast";
import { DISCLOSURE_TOPICS, disclosureFindings } from "@/lib/governing";
import { publicRecordsUrl } from "@/lib/metrics";

/**
 * What a new owner is told, and whether the documents can tell them.
 *
 * Every state researched except one puts this duty on the selling homeowner,
 * who has the least incentive to do it and the worst records. Florida
 * § 720.303(15)(b) puts it on the association: "An association shall provide a
 * physical or digital copy of the association's rules and covenants to every
 * new member." That is the version that works, because the association is the
 * only party that holds the documents and stays put between sales.
 *
 * Arizona goes further and makes every buyer sign that they have read and
 * understood the documents within fourteen days. Nobody has. A product that
 * makes that signature true rather than merely collected is the point of this
 * screen.
 */
export function NewOwnerScreen() {
  const { community } = useAppState();
  const { notify } = useToast();
  const articles = community.governingDocs;
  const findings = disclosureFindings(articles);
  const answered = findings.filter((f) => f.status === "answered").length;
  const unconfirmed = findings.filter((f) => f.status === "unconfirmed");
  const silent = findings.filter((f) => f.status === "silent");

  /**
   * The welcome letter, with the eight answered inline.
   *
   * Copyable rather than sent, because a board sends this from its own address
   * at closing and every association's escrow arrangement is different. What
   * the product supplies is the content, which is the part they get wrong.
   */
  const letter = [
    `Welcome to ${community.association.name}.`,
    "",
    "You now own a home in a community association. That comes with rules that bind you because you bought here, not because you signed them, and most new owners never read them. These are the eight that catch people out. Each one names the provision it comes from so you can read the exact words.",
    "",
    ...findings.flatMap((finding) => {
      if (finding.status === "answered") {
        return [
          `${finding.meta.question}`,
          ...finding.confirmed.map(
            (a) => `  ${a.number}. ${a.plain ?? a.text[0] ?? ""}`,
          ),
          "",
        ];
      }
      if (finding.status === "silent") {
        return [`${finding.meta.question}`, "  Our documents do not address this.", ""];
      }
      return [
        `${finding.meta.question}`,
        "  Ask the board. Our documents mention this but no provision has been confirmed as settling it.",
        "",
      ];
    }),
    `The full documents are at ${publicRecordsUrl(community)}, and you can search them in plain words once you have an account.`,
  ].join("\n");

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="What a new owner is told"
        description="The eight things a buyer must be warned about, answered from your own documents or left blank."
        action={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(letter);
              notify("Welcome letter copied. Paste it into your email or letterhead.");
            }}
          >
            <Copy className="size-3.5" />
            Copy the welcome letter
          </Button>
        }
      />

      <Callout tone="info" icon={<Scale className="size-4" />} title="Where the eight came from">
        Virginia, Colorado and Washington wrote buyer disclosure requirements separately and
        landed on the same short list. It is what statute says a buyer must be told, rather
        than what we found interesting, which is what makes it worth building a screen on.
        Florida is the one state that puts the duty on the association rather than the
        seller.
      </Callout>

      {articles.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<FileText className="size-6" />}
            title="Your documents are files, not text"
            description="Nothing here can be answered until the text of your declaration and rules has been imported, because every answer has to name the provision it came from."
            action={
              <Link
                href="/board/documents/import"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-[15px] font-medium text-brand-fg transition-opacity hover:opacity-90"
              >
                Import the text
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mt-5">
            <CardHeader
              title={
                answered === DISCLOSURE_TOPICS.length
                  ? "All eight can be answered from a confirmed provision"
                  : `${DISCLOSURE_TOPICS.length - answered} of the eight have no confirmed answer`
              }
              subtitle={
                unconfirmed.length > 0
                  ? `${unconfirmed.length} have articles that mention them and nobody has confirmed which one governs. Tag them where you know the answer.`
                  : silent.length > 0
                    ? "The rest are genuinely not addressed by your documents, which is a fine answer to give a buyer."
                    : "Nothing outstanding. A buyer's agent can be answered the same day."
              }
              action={
                <span className="tnum text-[15px] font-semibold text-fg">
                  {answered} / {DISCLOSURE_TOPICS.length}
                </span>
              }
            />
          </Card>

          <div className="mt-5">
            <DisclosureSummary articles={articles} showUnconfirmed />
          </div>
        </>
      )}

      <p className="mt-8 text-[13px] text-fg-subtle">
        <Link href="/board/documents" className="text-brand hover:underline">
          <ArrowLeft className="mr-1 inline size-3" />
          Back to documents
        </Link>
      </p>
    </>
  );
}
