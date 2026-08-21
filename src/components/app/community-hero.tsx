"use client";

import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/**
 * The community's own identity, sitting under the HOAsis bar and above
 * everything else. The photo and the name are admin owned.
 */
export function CommunityHero({
  subtitle,
  className,
  compact,
}: {
  subtitle?: string;
  className?: string;
  compact?: boolean;
}) {
  const { settings } = useAppState();

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
        {subtitle ? (
          <p className="mt-0.5 text-[12px] text-white/85 sm:text-[13px]">{subtitle}</p>
        ) : null}
      </div>
    </section>
  );
}
