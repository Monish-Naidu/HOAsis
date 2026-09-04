"use client";

import { Building2, HardHat, Home, KeyRound, Rows3 } from "lucide-react";
import type {
  AssociationOrigin,
  CommunityDraft,
  ExtraCollection,
  PreviousSetup,
  PropertyType,
  SharedSpace,
} from "@/lib/data/new-community";
import { cn } from "@/lib/utils";

/**
 * Four questions of fact, one to a screen, which decide what the plan
 * contains.
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
 * Three situations, said plainly.
 *
 * A builder standing the association up; owners taking it over from the
 * builder; or owners who already run it. The third door has one more answer
 * inside it, because "we run it ourselves" is three different first months:
 * a manager ran it until now, another platform held the books, or nothing
 * did because the association is new.
 *
 * The line that matters on each card is `changes`: it says what picking it
 * will actually do, so the choice is made on consequences rather than on
 * which description sounds most like them.
 */
const ORIGINS: {
  id: AssociationOrigin;
  label: string;
  detail: string;
  changes: string;
  icon: typeof Home;
}[] = [
  {
    id: "builder",
    label: "We are building the community",
    detail:
      "You are the builder or developer. The association has to exist before the first home closes.",
    changes:
      "Homes come straight from your site plan, the ones that have not sold are billed to you, and reserves get funded from the first assessment. When the owners elect their board, you hand them the presidency from Settings. Nothing is set up twice.",
    icon: HardHat,
  },
  {
    id: "handover",
    label: "We are taking over from the builder",
    detail: "The owners have elected a board. The builder still owns homes here, or left within the last year.",
    changes:
      "You get the turnover checklist: what to check before you sign a release, and what the builder owed on the lots it still held.",
    icon: KeyRound,
  },
  {
    id: "existing",
    label: "We already run our association",
    detail: "The owners run it. Whether a manager did until now, another platform held the books, or it is brand new.",
    changes:
      "Nothing has to be exported. You set what each home owed on the day you switch, and you are correct from there.",
    icon: Home,
  },
];

const PREVIOUSLY: { id: PreviousSetup; label: string; detail: string }[] = [
  { id: "manager", label: "A management company", detail: "You are taking the work in house" },
  { id: "platform", label: "Another platform", detail: "PayHOA, a spreadsheet, whatever held the books" },
  { id: "fresh", label: "Nothing yet", detail: "The association is new and you are starting it" },
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

type Patch = (next: Partial<CommunityDraft>) => void;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** What kind of homes. One answer, and it changes the plan the most. */
export function PropertyPicker({ draft, patch }: { draft: CommunityDraft; patch: Patch }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
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
          <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{detail}</span>
        </button>
      ))}
    </div>
  );
}

/** Anything shared. Legitimately empty for plenty of associations. */
export function SpacesPicker({ draft, patch }: { draft: CommunityDraft; patch: Patch }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SPACES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={draft.sharedSpaces.includes(id)}
          onClick={() => patch({ sharedSpaces: toggle(draft.sharedSpaces, id) })}
          className={cn(
            "rounded-full border px-4 py-2 text-[15px] font-medium transition-colors",
            draft.sharedSpaces.includes(id)
              ? "border-brand bg-brand text-brand-fg"
              : "border-border-2 text-fg-muted hover:text-fg",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Who is setting this up. Three doors, one of them with a follow-up inside. */
export function OriginPicker({ draft, patch }: { draft: CommunityDraft; patch: Patch }) {
  return (
    <div className="space-y-2">
      {ORIGINS.map((option) => (
        <div key={option.id}>
          <OriginCard
            option={option}
            picked={draft.origin === option.id}
            onPick={() => patch({ origin: option.id })}
          />
          {/* The follow-up, shown only once the third door is picked, so the
              three cards stay comparable until then. */}
          {option.id === "existing" && draft.origin === "existing" ? (
            <div className="animate-rise mt-2 rounded-card border border-border-2 bg-surface-2/60 p-4 sm:ml-12">
              <p className="text-[15px] font-semibold text-fg">Where are you coming from?</p>
              <div className="mt-2.5 space-y-2">
                {PREVIOUSLY.map(({ id, label, detail }) => {
                  const picked = draft.previously === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={picked}
                      onClick={() => patch({ previously: id })}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-card border px-3.5 py-2.5 text-left transition-colors",
                        picked
                          ? "border-brand bg-brand-soft"
                          : "border-border-2 bg-surface hover:bg-surface-2",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-fg">{label}</span>
                        <span className="block text-[13px] leading-snug text-fg-muted">{detail}</span>
                      </span>
                      <span
                        className={cn(
                          "size-4 shrink-0 rounded-full border-2",
                          picked ? "border-brand bg-brand" : "border-border-2",
                        )}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Anything billed besides dues. "Just dues" is the first card rather than a
 * way past the question, because for most associations it is the answer,
 * and an answer should look like one.
 */
export function CollectsPicker({ draft, patch }: { draft: CommunityDraft; patch: Patch }) {
  const justDues = draft.collects.length === 0;
  const card = (picked: boolean) =>
    cn(
      "flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors",
      picked ? "border-brand bg-brand-soft" : "border-border-2 hover:bg-surface-2",
    );
  const box = (picked: boolean) =>
    cn(
      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border-2",
      picked ? "border-brand bg-brand text-brand-fg" : "border-border-2",
    );
  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-pressed={justDues}
        onClick={() => patch({ collects: [] })}
        className={card(justDues)}
      >
        <span className={cn(box(justDues), "rounded-full")} aria-hidden>
          {justDues ? <span className="block size-1.5 rounded-full bg-current" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-fg">Just dues</span>
          <span className="block text-[13px] leading-snug text-fg-muted">
            One flat amount per home, and nothing else
          </span>
        </span>
      </button>
      {COLLECTS.map(({ id, label, detail }) => {
        const picked = draft.collects.includes(id);
        return (
          <button
            key={id}
            type="button"
            aria-pressed={picked}
            onClick={() => patch({ collects: toggle(draft.collects, id) })}
            className={card(picked)}
          >
            <span className={box(picked)} aria-hidden>
              {picked ? <span className="block size-1.5 rounded-[1px] bg-current" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-fg">{label}</span>
              <span className="block text-[13px] leading-snug text-fg-muted">{detail}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OriginCard({
  option,
  picked,
  onPick,
  compact = false,
}: {
  option: { id: AssociationOrigin; label: string; detail: string; changes: string; icon: typeof Home };
  picked: boolean;
  onPick: () => void;
  compact?: boolean;
}) {
  const Icon = option.icon;
  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        "flex w-full items-start gap-3.5 rounded-card border text-left transition-colors",
        compact ? "p-3" : "p-4",
        picked ? "border-brand bg-brand-soft" : "border-border-2 bg-surface hover:bg-surface-2",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-lg",
          compact ? "size-8" : "size-9",
          picked ? "bg-brand text-brand-fg" : "bg-surface-3 text-fg-muted",
        )}
        aria-hidden
      >
        <Icon className={compact ? "size-4" : "size-4.5"} strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-fg">{option.label}</span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-fg-muted">
          {option.detail}
        </span>
        {/* What picking it does, shown only once picked, so the cards stay
            comparable and the consequence is confirmed rather than competing
            for attention. */}
        {picked ? (
          <span className="mt-2 block border-t border-brand/25 pt-2 text-[13px] leading-relaxed text-brand-soft-fg">
            <span className="font-semibold">What that changes: </span>
            {option.changes}
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
}
