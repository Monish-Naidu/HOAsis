import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * A filter that lives in the address bar.
 *
 * A view a board member narrowed ("past due, autopay failed") can be
 * bookmarked, pasted to another officer and survives a reload, which state
 * held in a component cannot. Every list screen reads its filters through
 * this one hook so they all behave the same: an unknown value falls back
 * instead of breaking the page, the default is kept out of the URL so a clean
 * link stays clean, and changing a filter replaces the history entry rather
 * than stacking one per click.
 */

/** The value a raw param stands for: itself when allowed, else the fallback. `allowed` null accepts any text. */
export function readFilter<T extends string>(
  raw: string | null,
  allowed: readonly T[] | null,
  fallback: T,
): T {
  if (raw === null) return fallback;
  if (allowed === null) return raw as T;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

/**
 * The query string after setting one key. The fallback removes the key, and
 * every other param is kept as it was.
 */
export function withFilter(current: string, key: string, value: string, fallback: string): string {
  const next = new URLSearchParams(current);
  if (value === fallback || value === "") next.delete(key);
  else next.set(key, value);
  return next.toString();
}

/**
 * Read and write one `?key=value` filter.
 *
 * The value shown is the one just chosen, not the one the router has caught
 * up to, so a chip reacts on the click. When the URL changes underneath
 * (back, a link, another filter's write) the URL wins again.
 */
export function useUrlFilter<T extends string>(
  key: string,
  allowed: readonly T[] | null,
  fallback: T,
): [T, (next: T) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const fromUrl = readFilter(params.get(key), allowed, fallback);
  const [chosen, setChosen] = useState<{ seen: T; value: T }>({ seen: fromUrl, value: fromUrl });

  // Adjusting state during render, the supported way to resync from a prop:
  // an effect here is what the lint rule against setState in effects forbids.
  let value = chosen.value;
  if (chosen.seen !== fromUrl) {
    value = fromUrl;
    setChosen({ seen: fromUrl, value: fromUrl });
  }

  const query = params.toString();
  const set = useCallback(
    (next: T) => {
      setChosen({ seen: fromUrl, value: next });
      const search = withFilter(query, key, next, fallback);
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [fromUrl, query, key, fallback, router, pathname],
  );
  return [value, set];
}

/**
 * Drop several filters from the URL in one write. Calling each filter's own
 * setter in a row would not do: every one builds its query from the same
 * snapshot, so the last write wins and the others come back.
 */
export function useUrlClear(): (keys: readonly string[]) => void {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  return useCallback(
    (keys) => {
      const next = new URLSearchParams(params.toString());
      for (const key of keys) next.delete(key);
      const search = next.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
}
