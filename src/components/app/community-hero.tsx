"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Camera, Check, ChevronDown, Plus } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { cn, pluralize } from "@/lib/utils";
import { sameAssociationName } from "@/lib/community-links";
import { useToast } from "@/components/app/toast";
import { supabaseBrowser } from "@/lib/supabase/client";
import { refreshRemote } from "@/lib/data/remote-store";

/**
 * The association name, and the switcher between associations.
 *
 * Changing community signs you out on purpose: an account belongs to one
 * association, so carrying a session across would leave a President of one
 * holding capabilities in another.
 */
export function CommunityName({ onPhoto }: { onPhoto?: boolean } = {}) {
  const { settings, community, communities, setCommunity, isRemote } = useAppState();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Two of this person's associations with one name: the town tells them
  // apart, in the button and in the list.
  const twins = new Set(
    communities
      .filter((c, i) => communities.some((o, j) => j !== i && sameAssociationName(o.label, c.label)))
      .map((c) => c.id),
  );
  const activePlace = twins.has(community.id)
    ? (communities.find((c) => c.id === community.id)?.place ?? "")
    : "";

  const ink = onPhoto
    ? "text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]"
    : "text-fg";

  if (communities.length < 2) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center truncate px-2 py-1 font-medium",
          onPhoto ? "text-title2 font-semibold tracking-[-0.02em]" : "text-body",
          ink,
        )}
      >
        {settings.displayName}
      </span>
    );
  }

  return (
    // Shown at every width. It was hidden under 640px, which on a phone made
    // a person with two associations unable to find the other one at all.
    <div className="relative min-w-0 max-w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch association, now ${settings.displayName}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 font-medium",
          onPhoto
            ? "text-title2 font-semibold tracking-[-0.02em] hover:bg-white/15"
            : "text-body hover:bg-surface-2",
          ink,
        )}
      >
        {/* Under sm the bar has no room for a name: the building stands in,
            and the photo below says whose it is. */}
        <Building2 className={cn("size-4 shrink-0 sm:hidden", onPhoto ? "text-white/85" : "text-fg-muted")} aria-hidden />
        <span className="hidden truncate sm:inline">{settings.displayName}</span>
        {activePlace ? (
          <span className={cn("hidden truncate text-footnote font-normal sm:inline", onPhoto ? "text-white/80" : "text-fg-subtle")}>{activePlace}</span>
        ) : null}
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", onPhoto ? "text-white/80" : "text-fg-subtle", open && "rotate-180")} />
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
                    // A real member switches in place and lands on the other
                    // association's dashboard. A demo seat is a different
                    // person, so that one goes back to the door. Sending both
                    // to the sign-in page left a President staring at a form
                    // and a demo chip that did nothing.
                    if (setCommunity(option.id) === "switched") {
                      router.push(pathname.startsWith("/resident") ? "/resident" : "/board");
                    } else {
                      router.push("/signin");
                    }
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-body transition-colors hover:bg-surface-2"
                >
                  <Building2 className="size-3.5 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1 truncate font-medium text-fg">
                    {option.label}
                    {twins.has(option.id) && option.place ? (
                      <span className="block truncate text-footnote font-normal text-fg-subtle">{option.place}</span>
                    ) : null}
                  </span>
                  {option.id === community.id ? (
                    <Check className="size-3.5 shrink-0 text-ok" />
                  ) : null}
                </button>
              </li>
            ))}
            {!isRemote ? (
              <li className="border-t border-border px-3 py-2">
                <p className="text-footnote leading-snug text-fg-subtle">
                  Switching signs you out. Accounts belong to one association.
                </p>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}

/**
 * The community's own identity, sitting under the product bar and above
 * everything else. The photo and the name are admin owned.
 */
export function CommunityHero({
  subtitle,
  className,
  compact,
  short,
  nameControl,
  withLocation,
  overlay,
  toolbar,
}: {
  subtitle?: string;
  className?: string;
  compact?: boolean;
  /**
   * The form every page but the dashboard takes at lg: the same photo and
   * the same controls tray, about half the height, so the top of every tab
   * is the top of the dashboard and no white bar repeats the name.
   */
  short?: boolean;
  /** Replaces the plain name with the association switcher, drawn on the photo. */
  nameControl?: ReactNode;
  /** Derives the subtitle from the association rather than taking one. */
  withLocation?: boolean;
  /**
   * A card inlaid on the photo, bottom left. The name moves to the top so the
   * two never collide, and the banner grows to give the card room.
   */
  overlay?: ReactNode;
  /**
   * The page's controls, top right on the photo, for a page that has no bar
   * above the banner. The banner grows again so the photo reads as the top
   * of the page and not as a strip, and the cover button moves to the
   * bottom corner to stay out of the tray's way.
   */
  toolbar?: ReactNode;
}) {
  const { settings, community } = useAppState();
  const line =
    subtitle ??
    (withLocation
      ? `${community.association.addressLine} · ${pluralize(community.association.unitCount, "home")}`
      : undefined);

  return (
    <section
      className={cn(
        "relative isolate flex overflow-hidden",
        // At lg the rail floats 12px in from the edges with rounded corners;
        // the photo takes the same inset and radius so the two read as cards
        // on one gutter rather than a strip butting into a pill (Monish,
        // 2026-09-26). Below lg it runs edge to edge under the bar.
        !compact && "lg:ml-0 lg:mr-3 lg:mt-3 lg:rounded-[26px]",
        overlay ? "flex-col justify-between" : "items-end",
        // Taller per the 2026-09-01 huddle: the banner was leaving too much
        // white space beneath it, so it carries more of the viewport now.
        // Taller again with an overlay, which needs its own band of photo.
        compact
          ? "h-28"
          : short
            ? "h-36 lg:h-40"
          : toolbar && overlay
            ? "h-64 sm:h-72 lg:h-80"
            : toolbar
              ? "h-48 sm:h-56 lg:h-64"
              : overlay
                ? "h-64 sm:h-72"
                : "h-44 sm:h-56",
        className,
      )}
      aria-label={settings.displayName}
    >
      <div
        // Still. It used to push in on arrival, and because the dashboard
        // remounts on every visit the push ran every time, so the photo read
        // as never settling (Monish, 2026-09-25).
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${settings.photoUrl})` }}
        aria-hidden
      />
      {/* Scrim so white type stays legible on any photo the admin uploads:
          navy from the bottom, so the photo and the sidebar share a family,
          with a wash of the brand blue low left so the banner glows a little
          instead of only darkening. */}
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/85 via-navy-950/35 to-navy-950/5"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_0%_100%,rgb(63_130_242/0.35),transparent_70%)]"
        aria-hidden
      />
      <div
        className={cn(
          "w-full px-4 sm:px-6",
          compact ? "pb-3" : overlay ? "pt-4 sm:pt-5" : "pb-3.5",
          // The cover button sits top right unless the toolbar is there.
          overlay && !toolbar && "pr-16",
          // With a card below, the name and the tray share the top row.
          // Without one the name keeps the bottom and the tray takes the
          // corner on its own.
          toolbar && overlay && "flex items-start justify-between gap-4",
          // On a phone the app header above already says the name, and the
          // home card below says it again. Three times is two too many.
          overlay && "max-lg:sr-only",
        )}
      >
        <div className="min-w-0">
          {nameControl ? (
            <div className="-ml-2">{nameControl}</div>
          ) : (
            <h1
              className={cn(
                "font-semibold tracking-[-0.03em] text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35),0_8px_24px_rgb(0_0_0/0.25)]",
                compact || short ? "text-title2" : "text-[30px] sm:text-[36px]",
              )}
            >
              {settings.displayName}
            </h1>
          )}
          {line ? (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-caption font-medium text-white/95 backdrop-blur-md sm:text-footnote">
              <Building2 className="size-3" strokeWidth={2.2} />
              {line}
            </p>
          ) : null}
        </div>
        {toolbar && overlay ? <div className="shrink-0">{toolbar}</div> : null}
      </div>
      {overlay ? <div className="w-full px-4 pb-4 sm:px-6 sm:pb-5">{overlay}</div> : null}
      {toolbar && !overlay ? (
        <div className="absolute right-4 top-4 z-10 sm:right-6">{toolbar}</div>
      ) : null}

      <CoverPhotoButton corner={toolbar ? "bottom" : "top"} />
    </section>
  );
}

/**
 * Changing the cover photograph.
 *
 * Sits on the photograph rather than in Settings, because that is where
 * somebody is standing when they decide they do not like it. Only shown to
 * whoever can change settings; everybody else sees a picture.
 */
/**
 * Uploading a cover photograph, wherever the button lives.
 *
 * On the banner for a board that does not like the picture, and in the setup
 * plan for one that has not chosen yet. The same shrinking, the same storage
 * path, so the two can never disagree about what is on file.
 */
export function useCoverPhotoUpload() {
  const { community, isRemote, updateSettings } = useAppState();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);

  async function choose(file: File) {
    if (!file.type.startsWith("image/")) {
      notify("That is not an image", "warn");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify("Images need to be under 8 MB", "warn");
      return;
    }

    setBusy(true);
    try {
      if (!isRemote) {
        // A demo has nowhere to upload to, so the picture lives in this
        // browser for as long as the demo does.
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        updateSettings({ photoUrl: dataUrl });
        notify("Cover photo updated", "ok");
        return;
      }

      const supabase = supabaseBrowser();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      // The association id is the first path segment, which is what the
      // storage policy checks against.
      const path = `${community.id}/cover-${Date.now()}.${extension}`;

      const { error } = await supabase.storage
        .from("community")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from("community").getPublicUrl(path);
      const { error: saveError } = await supabase
        .from("associations")
        .update({ photo_url: data.publicUrl })
        .eq("id", community.id);
      if (saveError) throw new Error(saveError.message);

      await refreshRemote();
      notify("Cover photo updated", "ok");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Could not upload that image",
        "warn",
      );
    } finally {
      setBusy(false);
    }
  }

  return { busy, choose };
}

function CoverPhotoButton({ corner = "top" }: { corner?: "top" | "bottom" }) {
  const { can, community } = useAppState();
  const { busy, choose } = useCoverPhotoUpload();
  const input = useRef<HTMLInputElement>(null);

  if (!can("settings")) return null;

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void choose(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={
          community.settings.photoUrl ? "Change the cover photo" : "Add a cover photo"
        }
        title={community.settings.photoUrl ? "Change the cover photo" : "Add a cover photo"}
        className={cn(
          "absolute right-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 disabled:opacity-60 sm:right-6",
          corner === "top" ? "top-4" : "bottom-4 sm:bottom-5",
        )}
      >
        {busy ? (
          <span
            className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden
          />
        ) : community.settings.photoUrl ? (
          <Camera className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}
      </button>
    </>
  );
}

/**
 * The board's chrome: the bar on every page, and the banner on the
 * dashboard only.
 *
 * The banner rode above every board page, which meant every page opened
 * with the same photo, the same name and the same home count before its
 * own title. The dashboard is the front door and keeps the photo; every
 * other page gets its title at the top, under the bar.
 *
 * On the dashboard at desktop width the bar is gone too, the same as the
 * resident dashboard: the photo runs to the top and the controls ride on
 * it in a frosted tray (Monish, 2026-09-21). Under `lg` the bar stays,
 * because it carries the horizontal nav.
 *
 * A client component so the server layout can hand it the bar's pieces
 * and let the pathname decide where they go.
 */
export function BoardChrome({
  name,
  controls,
  nav,
}: {
  name: ReactNode;
  controls: ReactNode;
  nav: ReactNode;
}) {
  const pathname = usePathname();
  const dashboard = pathname === "/board";
  return (
    <>
      {/* The bar is for narrow screens. At lg the photo is the top of every
          page, dashboard or not, with the controls in their tray on it. */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
          {name}
          {controls}
        </div>
        {/* Horizontal nav on narrow screens */}
        {/* The right edge fades, so nine sections with three on screen read
            as a row that scrolls rather than a row of three. */}
        <div className="no-scrollbar overflow-x-auto border-t border-border px-3 py-1.5 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)] lg:hidden">
          {nav}
        </div>
      </header>
      <CommunityHero
        withLocation
        short={!dashboard}
        nameControl={dashboard ? undefined : <CommunityName onPhoto />}
        className={dashboard ? undefined : "max-lg:hidden"}
        toolbar={
          <div className="hidden rounded-2xl bg-surface/90 p-1.5 shadow-float ring-1 ring-border/70 backdrop-blur-md lg:block">
            {controls}
          </div>
        }
      />
      {dashboard ? null : <PhotoStrip className="lg:hidden" quietBelowLg={false} />}
    </>
  );
}

/**
 * The community photo on every page that is not the dashboard.
 *
 * The dashboard has the full banner. Everywhere else the same photo runs
 * as a short strip at the top of the content frame, inside the page's own
 * gutters and with the cards' corner radius, so it reads as part of the
 * page rather than a bar bolted above it. No controls, no cover button,
 * no motion: the name and the line sit low left, the way the banner's do.
 * Both shells render it from the same place, above the section tabs.
 */
export function PhotoStrip({
  subtitle,
  className,
  quietBelowLg,
}: {
  subtitle?: string;
  className?: string;
  /** Photo only under lg, where the shell's own header already says the name. */
  quietBelowLg?: boolean;
}) {
  const { settings, community } = useAppState();
  const pathname = usePathname();
  if (pathname === "/board" || pathname === "/resident") return null;
  const line =
    subtitle ??
    `${community.association.addressLine} · ${pluralize(community.association.unitCount, "home")}`;
  return (
    <section
      className={cn(
        "relative isolate mx-4 mt-4 flex h-24 items-end overflow-hidden rounded-card sm:h-28 lg:mx-6",
        className,
      )}
      aria-label={settings.displayName}
    >
      <div
        className="absolute inset-0 -z-10 bg-navy-900 bg-cover bg-center"
        style={settings.photoUrl ? { backgroundImage: `url(${settings.photoUrl})` } : undefined}
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-950/80 via-navy-950/30 to-navy-950/5"
        aria-hidden
      />
      <div className={cn("w-full px-4 pb-3 sm:px-5", quietBelowLg && "max-lg:sr-only")}>
        <p className="truncate text-headline font-semibold tracking-[-0.015em] text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]">
          {settings.displayName}
        </p>
        <p className="truncate text-footnote text-white/85 [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]">{line}</p>
      </div>
    </section>
  );
}
