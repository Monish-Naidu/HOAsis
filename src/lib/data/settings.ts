import type { ArchitecturalForm, CommunityAmenity, CommunitySettings } from "@/lib/types";

/**
 * Everything on this page is admin owned. In the prototype these are the
 * seeded defaults; the settings screen edits them in local state so you can
 * see the resident side react.
 */
export const communitySettings: CommunitySettings = {
  displayName: "Mehr Meadows",
  photoUrl: "/community/mehr-meadows.jpg",
  photoCredit: "Alex Reynolds, Unsplash",
  homeLayout: "calendar",
  banner: {
    enabled: true,
    title: "Quarterly meeting, October 21 at 7:00 PM",
    detail: "Clubhouse and video call. Budget ratification is on the agenda.",
    updatedDate: "2026-08-19",
  },
  showFundsToResidents: true,
  showLiveVoteResults: false,
  autopayLateAfterDay: 15,
  forumEnabled: true,
};

/** The amenities the admin has chosen to offer. Reservable ones reach the resident dropdown. */
export const communityAmenities: CommunityAmenity[] = [
  {
    id: "am-clubhouse",
    name: "Clubhouse",
    reservable: true,
    detail: "Main room and kitchen, seats 40",
    status: "reserved",
    maxHours: 6,
  },
  {
    id: "am-pool",
    name: "Pool",
    reservable: false,
    detail: "Open until 10 PM, closes Sep 8 for resurfacing",
    status: "open",
  },
  {
    id: "am-tennis",
    name: "Tennis court",
    reservable: true,
    detail: "Two hour blocks, no lights after 9 PM",
    status: "open",
    maxHours: 2,
  },
  {
    id: "am-fitness",
    name: "Fitness room",
    reservable: false,
    detail: "Open 24h with fob",
    status: "open",
  },
  {
    id: "am-green",
    name: "Oak Green picnic shelter",
    reservable: true,
    detail: "Covered shelter and grills",
    status: "open",
    maxHours: 5,
  },
];

/**
 * Architectural request forms. HOAsis ships a baseline set so a new board is
 * not staring at an empty dropdown; the admin can upload and label their own.
 */
export const architecturalForms: ArchitecturalForm[] = [
  {
    id: "form-paint",
    label: "Exterior paint color request",
    description: "Approved palette, color chips, and the sample photo requirement",
    fileName: "exterior-paint-request.pdf",
    size: "180 KB",
    source: "baseline",
    updatedDate: "2026-01-15",
  },
  {
    id: "form-fence",
    label: "Fence or wall installation",
    description: "Height, material, setback, and survey requirements",
    fileName: "fence-request.pdf",
    size: "210 KB",
    source: "baseline",
    updatedDate: "2026-01-15",
  },
  {
    id: "form-solar",
    label: "Rooftop solar installation",
    description: "Plan set, structural letter, and installer license",
    fileName: "solar-request.pdf",
    size: "245 KB",
    source: "baseline",
    updatedDate: "2026-01-15",
  },
  {
    id: "form-landscape",
    label: "Landscaping and hardscape change",
    description: "Plant list, irrigation impact, and drainage notes",
    fileName: "landscape-request.pdf",
    size: "165 KB",
    source: "baseline",
    updatedDate: "2026-01-15",
  },
  {
    id: "form-adu",
    label: "Detached structure or shed",
    description: "Uploaded by the board after the 2026 rules update",
    fileName: "detached-structure-2026.pdf",
    size: "320 KB",
    source: "uploaded",
    updatedDate: "2026-06-02",
  },
  {
    id: "form-driveway",
    label: "Driveway resurfacing or expansion",
    description: "Uploaded by the board, includes the county permit checklist",
    fileName: "driveway-request-v2.pdf",
    size: "295 KB",
    source: "uploaded",
    updatedDate: "2026-04-18",
  },
];
