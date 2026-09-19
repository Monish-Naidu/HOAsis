"use client";

import { useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Camera, Check, ChevronDown, Plus } from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { cn, pluralize } from "@/lib/utils";
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
export function CommunityName() {
  const { settings, community, communities, setCommunity } = useAppState();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  if (communities.length < 2) {
    return (
      <span className="hidden items-center px-2 py-1 text-[15px] font-medium text-fg sm:inline-flex">
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
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[15px] font-medium text-fg hover:bg-surface-2"
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
                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[15px] transition-colors hover:bg-surface-2"
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
              <p className="text-[13px] leading-snug text-fg-subtle">
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
 * The community's own identity, sitting under the product bar and above
 * everything else. The photo and the name are admin owned.
 */
export function CommunityHero({
  subtitle,
  className,
  compact,
  withLocation,
  overlay,
}: {
  subtitle?: string;
  className?: string;
  compact?: boolean;
  /** Derives the subtitle from the association rather than taking one. */
  withLocation?: boolean;
  /**
   * A card inlaid on the photo, bottom left. The name moves to the top so the
   * two never collide, and the banner grows to give the card room.
   */
  overlay?: ReactNode;
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
        overlay ? "flex-col justify-between" : "items-end",
        // Taller per the 2026-09-01 huddle: the banner was leaving too much
        // white space beneath it, so it carries more of the viewport now.
        // Taller again with an overlay, which needs its own band of photo.
        compact ? "h-28" : overlay ? "h-64 sm:h-72" : "h-44 sm:h-56",
        className,
      )}
      aria-label={settings.displayName}
    >
      <div
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
          compact ? "pb-3" : overlay ? "pt-4 pr-16 sm:pt-5" : "pb-3.5",
          // On a phone the app header above already says the name, and the
          // home card below says it again. Three times is two too many.
          overlay && "max-lg:sr-only",
        )}
      >
        <h1
          className={cn(
            "font-semibold tracking-[-0.03em] text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.35),0_8px_24px_rgb(0_0_0/0.25)]",
            compact ? "text-[22px]" : "text-[30px] sm:text-[36px]",
          )}
        >
          {settings.displayName}
        </h1>
        {line ? (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[12px] font-medium text-white/95 backdrop-blur-md sm:text-[13px]">
            <Building2 className="size-3" strokeWidth={2.2} />
            {line}
          </p>
        ) : null}
      </div>
      {overlay ? <div className="w-full px-4 pb-4 sm:px-6 sm:pb-5">{overlay}</div> : null}

      <CoverPhotoButton />
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

function CoverPhotoButton() {
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
        className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/65 disabled:opacity-60 sm:right-6"
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
 * The banner, on the dashboard only.
 *
 * It rode above every board page, which meant every page opened with the
 * same photo, the same name and the same home count before its own title.
 * The name is already in the top bar. The dashboard is the front door and
 * keeps the photo; every other page gets its title at the top.
 */
export function BoardHero() {
  const pathname = usePathname();
  if (pathname !== "/board") return null;
  return <CommunityHero withLocation compact />;
}
