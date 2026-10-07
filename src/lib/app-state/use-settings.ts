import { useCallback, useMemo } from "react";
import type { Community } from "@/lib/data/community";
import { DUES_HIGH_MESSAGE, MAX_DUES_CENTS } from "@/lib/input-checks";
import { todayIsoDate } from "@/lib/utils";
import { type AppDeps, communityStore, destructive, dismissStore, isUuid, latest, MUTABLE_SLICES, newId, remoteWrite, resetCommunity, sessionStore, sessionUserId, sliceStore } from "./core";
import { saveCreatedCommunity } from "@/lib/data/created-communities";
import { loadRemote, NOTHING_CHANGED, preferRemoteAssociation, reportRemoteError } from "@/lib/data/remote-store";
import { setHomeDues as writeHomeDues } from "@/lib/roster/apply";
import { supabaseBrowser } from "@/lib/supabase/client";
import { buildCommunity, type CommunityDraft, draftCollectionPolicy, reservableSpaceNames } from "@/lib/data/new-community";
import { isRecord } from "@/lib/core/guards";
import type { SettingsPatch } from "./types";

/**
 * The association itself: its settings and profile row, amenities, forms and
 * templates, creating an association, and the setup plan's skipped tasks.
 */
export function useSettingsActions(deps: AppDeps) {
  const { remote, communityId, localDismissals } = deps;

  const updateSettings = useCallback(
    (patch: SettingsPatch) => {
      if (!remote.community) {
        sliceStore(communityId, "settings").update((current) => ({
          ...current,
          ...patch,
          banner: patch.banner ? { ...current.banner, ...patch.banner } : current.banner,
        }));
        return true;
      }
      // Columns where there are columns; the jsonb patch for the rest.
      const rc = remote.community;
      const columns: Record<string, unknown> = {};
      const extras: Record<string, unknown> = {};
      const COLUMN: Record<string, string> = {
        displayName: "name",
        photoUrl: "photo_url",
        photoCredit: "photo_credit",
        autopayLateAfterDay: "late_after_day",
        paymentFeeCents: "payment_fee_cents",
        paymentFeePaidBy: "payment_fee_paid_by",
        paymentFeeWaivedOnAch: "payment_fee_waived_on_ach",
      };
      for (const [key, value] of Object.entries(patch)) {
        if (COLUMN[key]) columns[COLUMN[key]] = value;
        else extras[key] = value;
      }
      return remoteWrite("Saving settings", async () => {
        const supabase = supabaseBrowser();
        const next: Record<string, unknown> = { ...columns };
        if (Object.keys(extras).length) {
          // Read under the queue, so two quick toggles merge instead of the
          // second writing over the first. A failed read stops here: merging
          // the patch into nothing would replace every other setting with it.
          const { data, error } = await supabase
            .from("associations")
            .select("settings")
            .eq("id", rc.id)
            .single();
          if (error) throw new Error(error.message);
          const stored = (data?.settings as Record<string, unknown> | null) ?? {};
          const settings: Record<string, unknown> = { ...stored, ...extras };
          // The banner is two fields saved one at a time. Merged one level
          // down onto what is stored, so a patch that names only the title
          // cannot put an old copy of the detail over the one saved a moment
          // before it. An association with no banner stored yet starts from
          // the one on screen, so the row is never left with half of one.
          if (isRecord(extras.banner)) {
            settings.banner = {
              ...latest(rc).settings.banner,
              ...(isRecord(stored.banner) ? stored.banner : {}),
              ...extras.banner,
            };
          }
          next.settings = settings;
        }
        return supabase.from("associations").update(next, { count: "exact" }).eq("id", rc.id);
      });
    },
    [remote.community, communityId],
  );

  const setAmenities = useCallback(
    (next: Community["amenities"]) => {
      if (!remote.community) {
        sliceStore(communityId, "amenities").set(next);
        return;
      }
      const rc = remote.community;
      void remoteWrite("Saving amenities", async () => {
        const supabase = supabaseBrowser();
        // What is there now, read when the write runs. `next` and `rc` are
        // the list as the screen drew it, and a row taken away a moment ago
        // stays on screen until the re-read lands. Updating or deleting it
        // again matches nothing, which read as a refusal and dropped the
        // edit made to the row beside it.
        const there = new Set(latest(rc).amenities.map((a) => a.id));
        const keep = new Set<string>();
        for (const amenity of next) {
          if (isUuid(amenity.id) && !there.has(amenity.id)) continue;
          const row = {
            association_id: rc.id,
            name: amenity.name,
            detail: amenity.detail,
            reservable: amenity.reservable,
            status: amenity.status,
            max_hours: amenity.rules?.maxHours ?? amenity.maxHours ?? null,
            rules: amenity.rules ?? null,
          };
          // A screen invents an id for a new item; the database gets to pick
          // the real one, and the row is told apart by whether it is a uuid.
          const id = isUuid(amenity.id) ? amenity.id : newId();
          keep.add(id);
          // An update is aimed at a row that exists, so it is counted: one
          // that row level security hid matches nothing and says nothing.
          const { error, count } = isUuid(amenity.id)
            ? await supabase.from("amenities").update(row, { count: "exact" }).eq("id", id)
            : await supabase.from("amenities").insert({ id, ...row });
          if (error) throw new Error(error.message);
          if (count === 0) throw new Error(NOTHING_CHANGED);
        }
        // Only what the screen listed and left out, and only if it is still
        // there. A row added since the screen drew is not this save's to take.
        const gone = rc.amenities
          .filter((a) => !keep.has(a.id) && there.has(a.id))
          .map((a) => a.id);
        if (gone.length) {
          return supabase.from("amenities").delete({ count: "exact" }).in("id", gone);
        }
      });
    },
    [remote.community, communityId],
  );

  const setForms = useCallback(
    (next: Community["forms"]) => {
      if (!remote.community) {
        sliceStore(communityId, "forms").set(next);
        return;
      }
      // The stock forms ship in code and are not rows, so only what the board
      // uploaded is written, and only it can be taken away.
      const rc = remote.community;
      void remoteWrite("Saving forms", async () => {
        const supabase = supabaseBrowser();
        // As in `setAmenities`: a form removed a moment ago is skipped
        // rather than written to, and is not deleted a second time.
        const there = new Set(latest(rc).forms.map((f) => f.id));
        const keep = new Set<string>();
        for (const form of next) {
          if (form.source !== "uploaded") continue;
          if (isUuid(form.id) && !there.has(form.id)) continue;
          const row = {
            association_id: rc.id,
            label: form.label,
            description: form.description,
            file_name: form.fileName,
            size_label: form.size,
            updated_on: form.updatedDate,
            fields: form.fields ?? null,
            governed_by: form.governedBy ?? null,
            decision_days: form.decisionDays ?? null,
          };
          const id = isUuid(form.id) ? form.id : newId();
          keep.add(id);
          const { error, count } = isUuid(form.id)
            ? await supabase.from("forms").update(row, { count: "exact" }).eq("id", id)
            : await supabase.from("forms").insert({ id, ...row });
          if (error) throw new Error(error.message);
          if (count === 0) throw new Error(NOTHING_CHANGED);
        }
        const gone = rc.forms
          .filter((f) => f.source === "uploaded" && !keep.has(f.id) && there.has(f.id))
          .map((f) => f.id);
        if (gone.length) return supabase.from("forms").delete({ count: "exact" }).in("id", gone);
      });
    },
    [remote.community, communityId],
  );

  const removeForm = useCallback(
    (formId: string) => {
      if (!remote.community) {
        return destructive(sliceStore(communityId, "forms"), (all) =>
          all.filter((f) => f.id !== formId),
        );
      }
      const form = remote.community.forms.find((f) => f.id === formId);
      if (!form || form.source !== "uploaded") {
        reportRemoteError("The stock forms cannot be removed, only the ones you uploaded");
        return () => {};
      }
      const rc = remote.community;
      const row = {
        id: form.id,
        association_id: rc.id,
        label: form.label,
        description: form.description,
        file_name: form.fileName,
        size_label: form.size,
        updated_on: form.updatedDate,
        fields: form.fields ?? null,
        governed_by: form.governedBy ?? null,
        decision_days: form.decisionDays ?? null,
      };
      void remoteWrite("Removing the form", () =>
        supabaseBrowser().from("forms").delete({ count: "exact" }).eq("id", formId),
      );
      return () => {
        void remoteWrite("Restoring the form", () => supabaseBrowser().from("forms").insert(row));
      };
    },
    [remote.community, communityId],
  );

  const removeAmenity = useCallback(
    (amenityId: string) => {
      if (!remote.community) {
        return destructive(sliceStore(communityId, "amenities"), (all) =>
          all.filter((a) => a.id !== amenityId),
        );
      }
      const rc = remote.community;
      const amenity = rc.amenities.find((a) => a.id === amenityId);
      void remoteWrite("Removing the amenity", () =>
        supabaseBrowser().from("amenities").delete({ count: "exact" }).eq("id", amenityId),
      );
      return () => {
        if (!amenity) return;
        void remoteWrite("Restoring the amenity", () =>
          supabaseBrowser().from("amenities").insert({
            id: amenity.id,
            association_id: rc.id,
            name: amenity.name,
            detail: amenity.detail,
            reservable: amenity.reservable,
            status: amenity.status,
            max_hours: amenity.rules?.maxHours ?? amenity.maxHours ?? null,
            rules: amenity.rules ?? null,
          }),
        );
      };
    },
    [remote.community, communityId],
  );

  const resetDemo = useCallback(() => resetCommunity(communityId), [communityId]);

  /**
   * Founds an association for a signed in person, in Postgres.
   *
   * Distinct from `createCommunity`, which builds one in this browser for
   * somebody evaluating the product. Keeping them apart is deliberate: a demo
   * must never write to the database, and a real association must never be
   * something one browser knows about.
   */
  const createRemoteAssociation = useCallback(async (draft: CommunityDraft) => {
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.rpc("create_association", {
      p_name: draft.name,
      p_city: draft.city,
      p_state: draft.state,
      p_dues_cents: draft.duesCents,
      p_dues_cadence: draft.duesCadence,
      p_due_day: draft.dueDay,
      p_founder_name: draft.founder.name,
      p_founder_unit: draft.founder.unit,
      p_households: draft.households,
      // The three answers, kept. They were being asked and then discarded on
      // this path, so a real board got the generic plan, which is the one
      // outcome the questions exist to prevent.
      p_property_type: draft.propertyType ?? null,
      p_origin: draft.origin ?? null,
      p_collects: draft.collects,
      p_shared_spaces: draft.sharedSpaces,
      p_previously: draft.previously ?? undefined,
      p_founder_address: draft.founder.address?.trim() || undefined,
      // Every kind of home, each home's kind, and what each kind pays.
      p_home_types: draft.homeTypes?.length ? draft.homeTypes : undefined,
      p_dues_by_type: draft.duesByType ?? undefined,
      p_founder_home_type: draft.founder.homeType ?? undefined,
    });
    if (error) throw new Error(error.message);

    const associationId = data as string;

    // The late fee the founder chose, or none, as the collections policy.
    // Written here rather than through `updateSettings`, which acts on the
    // association already open and this one is not yet. The association
    // exists by now, so a failure is said and not thrown.
    {
      const { data: row, error: readError } = await supabase
        .from("associations")
        .select("settings")
        .eq("id", associationId)
        .single();
      const stored = (row?.settings as Record<string, unknown> | null) ?? {};
      const { error: policyError } = readError
        ? { error: readError }
        : await supabase
            .from("associations")
            .update({ settings: { ...stored, collectionPolicy: draftCollectionPolicy(draft) } })
            .eq("id", associationId);
      if (policyError) {
        reportRemoteError(
          `Your association is set up, but its late fee setting was not saved (${policyError.message}). No late fee is charged until you set one in Finances, Past due.`,
        );
      }
    }

    // The shared spaces named during setup become the amenities owners can
    // reserve. Without this the plan asked for them a second time.
    const spaces = reservableSpaceNames(draft.sharedSpaces, draft.customSpaces);
    // The association exists by now, so a failure below is said and the
    // founder still lands in it; throwing would send them back into the
    // wizard to found the same association a second time.
    if (spaces.length) {
      const { error: spacesError } = await supabase.from("amenities").insert(
        spaces.map((name) => ({
          association_id: associationId,
          name,
          detail: "",
          reservable: true,
          status: "open",
        })),
      );
      if (spacesError) {
        reportRemoteError(
          `Your association is set up, but its shared spaces were not saved (${spacesError.message}). Add them from your setup steps.`,
        );
      }
    }

    // The account the books are kept against. The wizard stopped asking for
    // a bank on 2026-10-04, which left a new association with nowhere for a
    // recorded check to land and no account to give a starting balance. It
    // gets a plainly named one; it is a ledger, not a connection, and online
    // money still goes through Stripe.
    {
      const { error: bankError } = await supabase.from("bank_accounts").insert({
        association_id: associationId,
        kind: "operating",
        institution: draft.bankAccount?.institution ?? "Operating account",
        mask: draft.bankAccount?.mask ?? "",
      });
      if (bankError) {
        reportRemoteError(
          `Your association is set up, but its operating account was not created (${bankError.message}). Add it on Finances.`,
        );
      }
    }

    // Each home's own dues amount, now the homes exist. create_association
    // takes none, so they follow it through set_home_dues, the way balances
    // follow an import. The association exists, so a failure is said and the
    // founder still lands in it; Change dues on a household finishes the job.
    {
      const own = [
        ...(draft.founder.duesCents
          ? [{ unit: draft.founder.unit, duesCents: draft.founder.duesCents }]
          : []),
        ...draft.households
          .filter((h) => h.duesCents && h.duesCents > 0)
          .map((h) => ({ unit: h.unit, duesCents: h.duesCents as number })),
      ];
      if (draft.duesByHome && own.length) {
        try {
          await writeHomeDues(associationId, own);
        } catch (duesError) {
          reportRemoteError(
            `Your association is set up, but some homes were not given their own dues (${
              duesError instanceof Error ? duesError.message : "it was not saved"
            }). Open Homeowners and use Change dues on those homes. Until then they pay the usual amount.`,
          );
        }
      }
    }

    // Land in the one just founded, not in whichever this browser had open.
    preferRemoteAssociation(associationId);
    await loadRemote(sessionUserId());
    return associationId;
  }, []);

  /**
   * Setup tasks a board has declared do not apply to them.
   *
   * Kept in the database for a real association and in a local store for a
   * demo, because a checklist that forgets what you told it is worse than one
   * that never asked.
   */
  const dismissedSetupTasks = useMemo(
    () => new Set(remote.community ? remote.dismissals : localDismissals),
    [remote.community, remote.dismissals, localDismissals],
  );

  const dismissSetupTask = useCallback(
    (key: string) => {
      if (!remote.community) {
        dismissStore(communityId).update((all) =>
          all.includes(key) ? all : [...all, key],
        );
        return;
      }
      // Through the same door as every other write, so a refusal is said.
      // Fired straight at the table, a skip the database would not take
      // looked taken until the next load brought the task back.
      const rc = remote.community;
      void remoteWrite("Skipping the step", () =>
        supabaseBrowser()
          .from("setup_dismissals")
          .upsert(
            { association_id: rc.id, task_key: key },
            { onConflict: "association_id,task_key" },
          ),
      );
    },
    [remote.community, communityId],
  );

  const restoreSetupTask = useCallback(
    (key: string) => {
      if (!remote.community) {
        dismissStore(communityId).update((all) => all.filter((k) => k !== key));
        return;
      }
      const rc = remote.community;
      void remoteWrite("Bringing the step back", () =>
        supabaseBrowser()
          .from("setup_dismissals")
          .delete({ count: "exact" })
          .eq("association_id", rc.id)
          .eq("task_key", key),
      );
    },
    [remote.community, communityId],
  );

  /**
   * Builds an association from onboarding and signs the founder into it.
   *
   * Dated from the real calendar rather than the pinned demo clock, because a
   * board setting up today should see today. The date is captured once, here,
   * and stored on the community, so nothing downstream reads a wall clock
   * during render.
   */
  const createCommunity = useCallback((draft: CommunityDraft) => {
    const asOf = new Date().toISOString().slice(0, 10);
    const built = buildCommunity(draft, asOf);
    saveCreatedCommunity(built);
    // Seed each slice from the new community so its stores exist before any
    // screen reads them.
    for (const slice of MUTABLE_SLICES) sliceStore(built.id, slice).set(built[slice]);
    communityStore.set(built.id);
    sessionStore.set({ accountId: built.accounts[0].id, view: "board" });
    return built;
  }, []);

  const updateAssociation = useCallback(
    (patch: Partial<Community["association"]>) => {
      // The same ceiling the database holds (0102), for the demo too.
      const rates = [patch.duesCents, ...Object.values(patch.duesByType ?? {})];
      if (rates.some((c) => c !== undefined && c > MAX_DUES_CENTS)) {
        reportRemoteError(DUES_HIGH_MESSAGE);
        return false;
      }
      if (remote.community) {
        const rc = remote.community;
        const COLUMN: Record<string, string> = {
          name: "name",
          duesCents: "dues_cents",
          duesByType: "dues_by_type",
          duesCadence: "dues_cadence",
          fiscalYearStart: "fiscal_year_start",
          insuranceCarrier: "insurance_carrier",
          // Not null in the table, so a cleared field is a blank string, below.
          contactEmail: "contact_email",
          billsByEmail: "bills_by_email",
          insurancePolicyNo: "insurance_policy_no",
          insuranceExpiresOn: "insurance_expires_on",
          ein: "ein",
          state: "state",
        };
        const row: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(patch)) {
          if (COLUMN[key]) row[COLUMN[key]] = value ?? null;
        }
        // A cleared date picker hands back "", which a date column refuses.
        if (row.insurance_expires_on === "") row.insurance_expires_on = null;
        if ("contact_email" in row) row.contact_email = row.contact_email ?? "";
        if (!Object.keys(row).length) return true;
        return remoteWrite("Saving the association", () =>
          supabaseBrowser().from("associations").update(row, { count: "exact" }).eq("id", rc.id),
        );
      }
      sliceStore(communityId, "association").update((current) => ({ ...current, ...patch }));
      return true;
    },
    [remote.community, communityId],
  );

  const saveTemplate = useCallback(
    (template: Community["templates"][number]) => {
      if (remote.community) {
        const rc = remote.community;
        const row = {
          association_id: rc.id,
          name: template.name,
          description: template.description,
          subject: template.subject,
          body: template.body,
          trigger: template.trigger,
          updated_on: todayIsoDate(),
        };
        void remoteWrite("Saving the template", () =>
          isUuid(template.id)
            ? supabaseBrowser()
                .from("message_templates")
                .update(row, { count: "exact" })
                .eq("id", template.id)
            : // A stock template, edited: the row replaces it, keyed by its id.
              supabaseBrowser()
                .from("message_templates")
                .upsert({ ...row, baseline_id: template.id }, { onConflict: "association_id,baseline_id" }),
        );
        return;
      }
      sliceStore(communityId, "templates").update((all) =>
        all.some((t) => t.id === template.id)
          ? all.map((t) => (t.id === template.id ? template : t))
          : [...all, template],
      );
    },
    [remote.community, communityId],
  );

  /**
   * The community every screen sees, with the live slices laid over the seed.
   *
   * Without this overlay `community.ballots` is the fixture while `ballots` is
   * the store, and the two disagree the moment anyone changes anything. It also
   * keeps the pure selectors in metrics.ts honest, since they take a community
   * and read vendors, payouts and ballots straight off it.
   */

  return {
    updateSettings,
    setAmenities,
    setForms,
    removeForm,
    removeAmenity,
    resetDemo,
    createRemoteAssociation,
    dismissedSetupTasks,
    dismissSetupTask,
    restoreSetupTask,
    createCommunity,
    updateAssociation,
    saveTemplate,
  };
}
