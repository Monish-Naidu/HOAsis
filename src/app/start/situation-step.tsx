"use client";

import { Building2, Home, Rows3 } from "lucide-react";
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
 * Every one of these is something a board member simply knows. None of them
 * asks what they would like to configure, because a person elected last week
 * has no way to judge whether they need a vendor register, and asking makes our
 * job theirs. We take the facts and work out the rest.
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

const ORIGIN: { id: AssociationOrigin; label: string; detail: string }[] = [
  {
    id: "new",
    label: "Brand new",
    detail: "Just formed, or just taken over from the developer",
  },
  {
    id: "self-managed",
    label: "Already running it ourselves",
    detail: "We have records somewhere, probably a spreadsheet",
  },
  {
    id: "leaving-manager",
    label: "Leaving a management company",
    detail: "They hold our records, our contracts and our bank details",
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
          Tell us about the place
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
        <legend className="text-[15px] font-semibold text-fg">Where are you today?</legend>
        <p className="mt-1 text-[13px] text-fg-muted">
          A board leaving a manager has a different first week to one starting from nothing.
        </p>
        <div className="mt-3 space-y-2">
          {ORIGIN.map(({ id, label, detail }) => (
            <button
              key={id}
              type="button"
              aria-pressed={draft.origin === id}
              onClick={() => patch({ origin: id })}
              className={cn(
                "flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors",
                draft.origin === id
                  ? "border-brand bg-brand-soft"
                  : "border-border-2 hover:bg-surface-2",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 size-4 shrink-0 rounded-full border-2",
                  draft.origin === id ? "border-brand bg-brand" : "border-border-2",
                )}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-fg">{label}</span>
                <span className="block text-[13px] leading-snug text-fg-muted">{detail}</span>
              </span>
            </button>
          ))}
        </div>
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
