import { kindLabel, type RequestGroup } from "@/lib/request-status";

/**
 * The chips on the Requests list: which step a request is at, and what kind
 * it is. They only narrow what is listed; where a request sits is decided by
 * `groupRequests`, and these never move one.
 *
 * The step is the `show` param, not `status`: `?status=closed` already means
 * the history view on this page.
 */
export const REQUEST_STEPS = ["all", "decision", "scheduling", "progress", "done"] as const;
export type RequestStep = (typeof REQUEST_STEPS)[number];

export const REQUEST_STEP_LABEL: Record<RequestStep, string> = {
  all: "All",
  decision: "Needs a decision",
  scheduling: "Needs scheduling",
  progress: "In progress",
  done: "Done",
};

export const REQUEST_TYPES = ["all", "architectural", "maintenance", "records", "amenity", "violation-appeal"] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = { all: "All types", ...kindLabel };

const GROUP_KEYS: RequestGroup[] = ["decision", "scheduling", "progress", "done"];

type Row = { kind: string };

/** The grouped lists with the chosen step and type applied. Other keys pass through. */
export function applyRequestFilters<T extends Row, G extends Record<RequestGroup, T[]>>(
  grouped: G,
  step: RequestStep,
  type: RequestType,
): G {
  const next = { ...grouped };
  for (const key of GROUP_KEYS) {
    next[key] = (step === "all" || step === key ? grouped[key] : []).filter(
      (r) => type === "all" || r.kind === type,
    ) as G[RequestGroup];
  }
  // Requests older than the Done window ride along as `older`; they are done
  // work, so they follow the Done chip.
  const older = (grouped as { older?: T[] }).older;
  if (older) {
    (next as { older?: T[] }).older = (step === "all" || step === "done" ? older : []).filter(
      (r) => type === "all" || r.kind === type,
    );
  }
  return next;
}

/**
 * The number on each chip: what picking it would show. A step's count honours
 * the type chosen, and a type's count honours the step chosen.
 */
export function requestFilterCounts<T extends Row>(
  grouped: Record<RequestGroup, T[]>,
  step: RequestStep,
  type: RequestType,
) {
  const steps = {} as Record<RequestStep, number>;
  steps.all = 0;
  for (const key of GROUP_KEYS) {
    steps[key] = grouped[key].filter((r) => type === "all" || r.kind === type).length;
    steps.all += steps[key];
  }
  const types = {} as Record<RequestType, number>;
  for (const t of REQUEST_TYPES) {
    types[t] = GROUP_KEYS.filter((key) => step === "all" || step === key).reduce(
      (n, key) => n + grouped[key].filter((r) => t === "all" || r.kind === t).length,
      0,
    );
  }
  return { steps, types };
}
