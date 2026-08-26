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
  paymentFeeCents: 150,
  paymentFeePaidBy: "owner",
  paymentFeeWaivedOnAch: false,
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
    governedBy: "Article X, architectural review",
    decisionDays: 45,
    fields: [
      {
        id: "f-paint-body",
        label: "Body color",
        kind: "text",
        required: true,
        placeholder: "Sherwin Williams 7015, Repose Gray",
        help: "Manufacturer and color number, so the committee can look it up rather than guess from a photo.",
      },
      {
        id: "f-paint-trim",
        label: "Trim color",
        kind: "text",
        required: true,
        placeholder: "Sherwin Williams 7008, Alabaster",
      },
      {
        id: "f-paint-door",
        label: "Front door color",
        kind: "text",
        placeholder: "Leave blank if it is not changing",
      },
      {
        id: "f-paint-palette",
        label: "Is every color from the approved palette",
        kind: "choice",
        required: true,
        options: ["Yes, all from the palette", "No, one or more is outside it"],
        help: "A color outside the palette is not automatically refused. It goes to the full committee rather than to a single reviewer.",
      },
      {
        id: "f-paint-start",
        label: "Planned start date",
        kind: "date",
        required: true,
      },
      {
        id: "f-paint-contractor",
        label: "Who is doing the work",
        kind: "text",
        placeholder: "Yourself, or the contractor's name and license number",
      },
      {
        id: "f-paint-photos",
        label: "Photos of the house today, and the color chips",
        kind: "file",
        required: true,
        help: "One photo of each elevation that is changing. The committee refuses more applications for missing photos than for color.",
      },
      {
        id: "f-paint-notes",
        label: "Anything else the committee should know",
        kind: "long",
      },
    ],
  },
  {
    id: "form-fence",
    label: "Fence or wall installation",
    description: "Height, material, setback, and survey requirements",
    fileName: "fence-request.pdf",
    size: "210 KB",
    source: "baseline",
    updatedDate: "2026-01-15",
    governedBy: "Article X, architectural review",
    decisionDays: 45,
    fields: [
      {
        id: "f-fence-material",
        label: "Material",
        kind: "choice",
        required: true,
        options: ["Cedar", "Vinyl", "Wrought iron", "Composite", "Other"],
      },
      {
        id: "f-fence-height",
        label: "Height",
        kind: "number",
        required: true,
        suffix: "feet",
        help: "Six feet is the maximum on a rear or side line. Front yard fences are limited to four.",
      },
      {
        id: "f-fence-length",
        label: "Total run",
        kind: "number",
        required: true,
        suffix: "feet",
      },
      {
        id: "f-fence-setback",
        label: "Distance from the property line",
        kind: "number",
        required: true,
        suffix: "inches",
        help: "Anything on the line itself needs your neighbor's written agreement as well.",
      },
      {
        id: "f-fence-neighbor",
        label: "Have the adjoining owners been told",
        kind: "choice",
        required: true,
        options: ["Yes", "Not yet", "The fence does not touch a shared line"],
      },
      {
        id: "f-fence-survey",
        label: "Survey or plot plan showing where it goes",
        kind: "file",
        required: true,
        help: "A marked up copy of your plot plan is enough. A new survey is not required.",
      },
      {
        id: "f-fence-start",
        label: "Planned start date",
        kind: "date",
        required: true,
      },
    ],
  },
  {
    id: "form-solar",
    label: "Rooftop solar installation",
    description: "Plan set, structural letter, and installer license",
    fileName: "solar-request.pdf",
    size: "245 KB",
    source: "baseline",
    updatedDate: "2026-01-15",
    governedBy: "Article X, architectural review",
    decisionDays: 45,
    fields: [
      {
        id: "f-solar-installer",
        label: "Installer and license number",
        kind: "text",
        required: true,
      },
      {
        id: "f-solar-panels",
        label: "Number of panels",
        kind: "number",
        required: true,
      },
      {
        id: "f-solar-elevation",
        label: "Which roof faces",
        kind: "choice",
        required: true,
        options: ["Rear only", "Side", "Street facing", "More than one"],
        help: "A street facing array is not refused on looks alone, but the committee may ask about placement.",
      },
      {
        id: "f-solar-structural",
        label: "Structural letter from an engineer",
        kind: "file",
        required: true,
        help: "Your installer normally provides this. It confirms the roof carries the load.",
      },
      {
        id: "f-solar-plan",
        label: "Plan set showing the layout",
        kind: "file",
        required: true,
      },
      {
        id: "f-solar-start",
        label: "Planned start date",
        kind: "date",
        required: true,
      },
    ],
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
