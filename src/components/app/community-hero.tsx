"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/**
 * The association name, and the switcher between associations.
 *
 * Changing community signs you out on purpose: an account belongs to one
 * association, so carrying a session across would leave a President of one
 * holding capabilities in another.
 */
export function CommunityName() {
  const { settings, community, communities, setCommunity } = useAppState();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (communities.length < 2) {
    return (
      <span className="hidden items-center px-2 py-1 text-[13px] font-medium text-fg sm:inline-flex">
        {settings.displayName}
      </span>
    );
  }

  return (
    <div className="relative hidden sm:block">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-fg hover:bg-surface-2"
      >
        {settings.displayName}
        <ChevronDown className={cn("size-3.5 text-fg-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute left-0 z-50 mt-1 w-64 overflow-hidden rounded-card border border-border bg-surface shadow-float"
          >
            {communities.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === community.id}
                  onClick={() => {
                    setOpen(false);
                    if (option.id === community.id) return;
                    setCommunity(option.id);
                    router.push("/signin");
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] transition-colors hover:bg-surface-2"
                >
                  <Building2 className="size-3.5 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">
                    {option.label}
                  </span>
                  {option.id === community.id ? (
                    <Check className="size-3.5 shrink-0 text-ok" />
                  ) : null}
                </button>
              </li>
            ))}
            <li className="border-t border-border px-3 py-2">
              <p className="text-[11px] leading-snug text-fg-subtle">
                Switching signs you out. Accounts belong to one association.
              </p>
            </li>
          </ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * The community's own identity, sitting under the HOAsis bar and above
 * everything else. The photo and the name are admin owned.
 */
export function CommunityHero({
  subtitle,
  className,
  compact,
  withLocation,
}: {
  subtitle?: string;
  className?: string;
  compact?: boolean;
  /** Derives the subtitle from the association rather than taking one. */
  withLocation?: boolean;
}) {
  const { settings, community } = useAppState();
  const line =
    subtitle ??
    (withLocation
      ? `${community.association.addressLine} · ${community.association.unitCount} homes`
      : undefined);

  return (
    <section
      className={cn(
        "relative isolate flex items-end overflow-hidden",
        compact ? "h-28" : "h-36 sm:h-44",
        className,
      )}
      aria-label={settings.displayName}
    >
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${settings.photoUrl})` }}
        aria-hidden
      />
      {/* Scrim so white type stays legible on any photo the admin uploads. */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10"
        aria-hidden
      />
      <div className={cn("w-full px-4 pb-3.5 sm:px-6", compact && "pb-3")}>
        <h1
          className={cn(
            "font-semibold tracking-[-0.03em] text-white drop-shadow-sm",
            compact ? "text-[20px]" : "text-[26px] sm:text-[32px]",
          )}
        >
          {settings.displayName}
        </h1>
        {line ? <p className="mt-0.5 text-[12px] text-white/85 sm:text-[13px]">{line}</p> : null}
      </div>
    </section>
  );
}
