import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fiscalMonth, isIsoDate, periodRange, type PeriodPreset } from "@/lib/metrics";
import { readFilter } from "@/lib/url-filter";
import { useAppState } from "@/lib/app-state";
import { todayIsoDate } from "@/lib/utils";

export interface PeriodValue {
  preset: PeriodPreset;
  from: string;
  to: string;
}

/**
 * The period a finance screen is showing, kept in the address bar as
 * `period`, `from` and `to` (the three the Transactions links already use).
 *
 * One hook rather than three `useUrlFilter` calls because a step or a custom
 * range changes all three at once, and separate writes each build from the
 * same snapshot so the last one would win. The value just chosen shows on the
 * click; when the URL changes underneath, the URL wins again.
 */
export function usePeriod(presets: readonly PeriodPreset[], fallback: PeriodPreset) {
  const { community } = useAppState();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const asOf = todayIsoDate();
  const fyMonth = fiscalMonth(community.association.fiscalYearStart);

  const rawPeriod = params.get("period");
  const rawFrom = params.get("from");
  const rawTo = params.get("to");
  // Older links (the top bar's search, a year on the trends page) name their
  // dates and no period; they open on those dates.
  const legacy = Boolean(rawFrom && rawTo && rawPeriod === null);
  const asked: PeriodPreset = legacy ? "custom" : readFilter(rawPeriod, presets, fallback);
  const customDefault = periodRange("custom", asOf);
  const customFrom = rawFrom ?? customDefault.from;
  const customTo = rawTo ?? customDefault.to;
  // A range that is not two real dates in order would render nothing at all,
  // so it reads as the default period instead of an empty screen.
  const preset: PeriodPreset =
    asked === "custom" && !(isIsoDate(customFrom) && isIsoDate(customTo) && customFrom <= customTo)
      ? fallback
      : asked;
  const fromUrl: PeriodValue =
    preset === "custom"
      ? { preset, from: customFrom, to: customTo }
      : { preset, ...periodRange(preset, asOf, fyMonth) };

  const sig = `${rawPeriod}|${rawFrom}|${rawTo}`;
  const [held, setHeld] = useState<{ seen: string; value: PeriodValue } | null>(null);
  let value = fromUrl;
  if (held) {
    if (held.seen === sig) value = held.value;
    else setHeld(null);
  }

  const query = params.toString();
  const set = useCallback(
    (next: PeriodValue) => {
      setHeld({ seen: sig, value: next });
      const q = new URLSearchParams(query);
      q.delete("period");
      q.delete("from");
      q.delete("to");
      // A custom range keeps its dates in the link; the default preset keeps
      // the link clean; any other preset is the whole story by itself.
      if (next.preset !== fallback) q.set("period", next.preset);
      if (next.preset === "custom") {
        q.set("from", next.from);
        q.set("to", next.to);
      }
      const search = q.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [sig, query, fallback, router, pathname],
  );

  return { value, set, asOf, fyMonth, presets };
}
