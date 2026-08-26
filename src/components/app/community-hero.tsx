"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
      ? `${community.association.addressLine} · ${pluralize(community.association.unitCount, "home")}`
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
            compact ? "text-[20px]" : "text-[28px] sm:text-[34px]",
          )}
        >
          {settings.displayName}
        </h1>
        {line ? <p className="mt-0.5 text-[13px] text-white/85 sm:text-[15px]">{line}</p> : null}
      </div>

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
function CoverPhotoButton() {
  const { community, can, isRemote, updateSettings } = useAppState();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  if (!can("settings")) return null;

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
