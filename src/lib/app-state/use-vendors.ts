import { useCallback } from "react";
import type { Community } from "@/lib/data/community";
import { type AppDeps, destructive, logDemoActivity, newId, remoteWrite, sliceStore } from "./core";
import { supabaseBrowser } from "@/lib/supabase/client";
import { activityWords } from "@/lib/activity";
import { vendorNameProblem } from "@/lib/vendor-name";

/**
 * Vendors: who the association pays and the paperwork it holds for each.
 */
export function useVendorsActions(deps: AppDeps) {
  const { remote, communityId } = deps;

  const markW9Requested = useCallback(
    (vendorId: string) => {
      if (remote.community) {
        void remoteWrite("Noting the W-9", () =>
          supabaseBrowser()
            .from("vendors")
            .update({ w9_on_file: true }, { count: "exact" })
            .eq("id", vendorId),
        );
        return;
      }
      sliceStore(communityId, "vendors").update((all) =>
        all.map((vendor) => (vendor.id === vendorId ? { ...vendor, w9OnFile: true } : vendor)),
      );
    },
    [remote.community, communityId],
  );

  const addVendor = useCallback(
    (vendor: Community["vendors"][number]) => {
      // The same rule the form shows, held here too: a second call cannot
      // add "cascade grounds co." beside "Cascade Grounds Co.".
      const known = remote.community ? remote.community.vendors : sliceStore(communityId, "vendors").getSnapshot();
      if (vendorNameProblem(vendor.name, known)) return;
      if (remote.community) {
        const rc = remote.community;
        void remoteWrite("Adding the vendor", () =>
          supabaseBrowser().from("vendors").insert({
            id: newId(),
            association_id: rc.id,
            name: vendor.name,
            service: vendor.service,
            ach_enabled: vendor.achEnabled,
            w9_on_file: vendor.w9OnFile,
            coi_expires_on: vendor.coiExpires ?? null,
            default_category: vendor.defaultCategory,
          }),
        );
        return;
      }
      logDemoActivity(communityId, "vendor", activityWords.vendor(vendor.name), { service: vendor.service });
      sliceStore(communityId, "vendors").update((all) => [vendor, ...all]);
    },
    [remote.community, communityId],
  );

  const removeVendor = useCallback(
    (vendorId: string) => {
      if (remote.community) {
        const rc = remote.community;
        const vendor = rc.vendors.find((v) => v.id === vendorId);
        void remoteWrite("Removing the vendor", () =>
          supabaseBrowser().from("vendors").delete({ count: "exact" }).eq("id", vendorId),
        );
        return () => {
          if (!vendor) return;
          void remoteWrite("Restoring the vendor", () =>
            supabaseBrowser().from("vendors").insert({
              id: vendor.id,
              association_id: rc.id,
              name: vendor.name,
              service: vendor.service,
              ach_enabled: vendor.achEnabled,
              w9_on_file: vendor.w9OnFile,
              coi_expires_on: vendor.coiExpires ?? null,
              default_category: vendor.defaultCategory,
            }),
          );
        };
      }
      return destructive(sliceStore(communityId, "vendors"), (all) =>
        all.filter((v) => v.id !== vendorId),
      );
    },
    [remote.community, communityId],
  );

  return {
    markW9Requested,
    addVendor,
    removeVendor,
  };
}
