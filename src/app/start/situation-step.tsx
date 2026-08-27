"use client";

import { Building2, HardHat, Home, KeyRound, Rows3, Truck } from "lucide-react";
import type {
  AssociationOrigin,
  CommunityDraft,
  ExtraCollection,
  PropertyType,
  SharedSpace,
} from "@/lib/data/new-community";
import { cn } from "@/lib/utils";

/**
 * Three questions of fact, which decide what the plan contains.
 *
 * Every one of these is something a builder or a board member simply knows.
 * None of them asks what they would like to configure, because a person
 * elected last week has no way to judge whether they need a vendor register,
 * and asking makes our job theirs. We take the facts and work out the rest.
 *
 * If an answer would not change the plan, it is not on this screen.
 */

const PROPERTY: { id: PropertyType; label: string; detail: string; icon: typeof Home }[] = [
  {
    id: "single-family",
    label: "Detached homes",
    detail: "Each owner owns their house and their lot",
    icon: Home,
  },
  {
    id: "townhomes",
    label: "Townhomes",
    detail: "Attached homes, shared walls, often shared roofs",
    icon: Rows3,
  },
  {
    id: "condos",
    label: "Condominiums",
    detail: "Owners own the interior, the association owns the building",
    icon: Building2,
  },
];

/**
 * The three situations this product is built for, said plainly.
 *
 * Each one is a different first month, not a different set of words for the
 * same one, so the answer decides what gets set up and what plan comes back.
 * The line that matters on each card is `changes`: it says what picking it
 * will actually do, because a person choosing between three cards should be
 * choosing on consequences rather than on which description sounds most like
 * them.
 */
const ORIGIN: {
  id: AssociationOrigin;
  label: string;
  /** Who this is, in their own words. */
  detail: string;
  /** What picking it changes about the next few screens. */
  changes: string;
  icon: typeof Home;
}[] = [
  {
    id: "builder",
    label: "We are building the community",
    detail:
      "You are the builder or developer. The association has to exist before the first home closes.",
    changes:
      "Homes come straight from your site plan, the ones that have not sold are billed to you, and reserves get funded from the first assessment.",
    icon: HardHat,
  },
  {
    id: "handover",
    label: "We are taking over from the builder",
    detail:
      "Owners have elected their own board and control of the association is passing across.",
    changes:
      "You get the turnover checklist: what to check before you sign a release, and what the builder owed on the lots it still held.",
    icon: KeyRound,
  },
  {
    id: "existing",
    label: "We already run our association",
    detail:
      "An established community moving here. However long you have been going, and whoever you were using.",
    changes:
      "Nothing has to be exported. You set what each home owed on the day you switch, and you are correct from there.",
    icon: Truck,
  },
];

const SPACES: { id: SharedSpace; label: string }[] = [
  { id: "pool", label: "Pool" },
  { id: "clubhouse", label: "Clubhouse" },
  { id: "gym", label: "Gym" },
  { id: "playground", label: "Playground" },
  { id: "gate", label: "Gate" },
  { id: "elevator", label: "Elevator" },
];

const COLLECTS: { id: ExtraCollection; label: string; detail: string }[] = [
  {
    id: "special-assessment",
    label: "A special assessment",
    detail: "A one off cost being paid down over time",
  },
  {
    id: "utilities",
    label: "Utilities we pass on",
    detail: "Water, trash or gas the association pays and splits between homes",
  },
];

export function SituationStep({
  draft,
  patch,
}: {
  draft: CommunityDraft;
  patch: (next: Partial<CommunityDraft>) => void;
}) {
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
          Tell us about the community
        </h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
          Three questions. They decide what we set up, so you are never handed a list of
          things that do not apply to you.
        </p>
      </div>

      <fieldset>
        <legend className="text-[15px] font-semibold text-fg">What kind of homes?</legend>
        <p className="mt-1 text-[13px] text-fg-muted">
          This decides whether the association insures the buildings and whether a reserve
          study is a legal duty rather than good practice.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {PROPERTY.map(({ id, label, detail, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={draft.propertyType === id}
              onClick={() => patch({ propertyType: id })}
              className={cn(
                "rounded-card border p-4 text-left transition-colors",
                draft.propertyType === id
                  ? "border-brand bg-brand-soft"
                  : "border-border-2 hover:bg-surface-2",
              )}
            >
              <Icon className="size-5 text-fg-muted" />
              <span className="mt-2 block text-[15px] font-semibold text-fg">{label}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">
                {detail}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-[13px] font-medium text-fg-muted">
          Anything shared that owners use?
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SPACES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={draft.sharedSpaces.includes(id)}
              onClick={() => patch({ sharedSpaces: toggle(draft.sharedSpaces, id) })}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                draft.sharedSpaces.includes(id)
                  ? "border-brand bg-brand text-brand-fg"
                  : "border-border-2 text-fg-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-[15px] font-semibold text-fg">Which of these is you?</legend>
        {/* Named as the complete list rather than as three examples. A person
            who does not see themselves here should find that out now, not four
            screens in. */}
        <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
          These are the three we support, and each one gets a different first month rather
          than the same checklist reworded. None of them asks you to export anything from
          wherever you are now.
        </p>
        <div className="mt-3 space-y-2">
          {ORIGIN.map(({ id, label, detail, changes, icon: Icon }) => {
            const picked = draft.origin === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={picked}
                onClick={() => patch({ origin: id })}
                className={cn(
                  "flex w-full items-start gap-3.5 rounded-card border p-4 text-left transition-colors",
                  picked ? "border-brand bg-brand-soft" : "border-border-2 hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg",
                    picked ? "bg-brand text-brand-fg" : "bg-surface-3 text-fg-muted",
                  )}
                  aria-hidden
                >
                  <Icon className="size-4.5" strokeWidth={1.9} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-fg">{label}</span>
                  <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
                    {detail}
                  </span>
                  {/* What picking it does, shown only once picked, so the three
                      cards stay comparable and the consequence is confirmed
                      rather than competing for attention. */}
                  {picked ? (
                    <span className="mt-2 block border-t border-brand/25 pt-2 text-[13px] leading-relaxed text-brand-soft-fg">
                      <span className="font-semibold">What that changes: </span>
                      {changes}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "mt-1 size-4 shrink-0 rounded-full border-2",
                    picked ? "border-brand bg-brand" : "border-border-2",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-fg-subtle">
          Not sure between the last two? If the builder still owns homes here, you are taking
          over. If they left years ago, you already run it.
        </p>
      </fieldset>

      <fieldset>
        <legend className="text-[15px] font-semibold text-fg">
          Anything billed besides dues?
        </legend>
        <p className="mt-1 text-[13px] text-fg-muted">
          Most associations bill one flat amount. Pick nothing if that is you.
        </p>
        <div className="mt-3 space-y-2">
          {COLLECTS.map(({ id, label, detail }) => (
            <button
              key={id}
              type="button"
              aria-pressed={draft.collects.includes(id)}
              onClick={() => patch({ collects: toggle(draft.collects, id) })}
              className={cn(
                "flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors",
                draft.collects.includes(id)
                  ? "border-brand bg-brand-soft"
                  : "border-border-2 hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2",
                  draft.collects.includes(id)
                    ? "border-brand bg-brand text-brand-fg"
                    : "border-border-2",
                )}
                aria-hidden
              >
                {draft.collects.includes(id) ? (
                  <span className="block size-1.5 rounded-[1px] bg-current" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-fg">{label}</span>
                <span className="block text-[13px] leading-snug text-fg-muted">{detail}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
