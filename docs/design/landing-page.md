# The landing page redesign

Monish's friend designed a landing page and a logo on 2026-08-27. He wants it
used. This file exists because the design arrived as a screenshot pasted into a
conversation, and a conversation does not survive a session.

**Built on 2026-08-27.** The reference screenshot is now in the repo at
`docs/design/landing-page-reference.png`, the mark is redrawn in
`src/components/app/logo.tsx`, and the hero is the top of `src/app/page.tsx`.
What is still outstanding is at the bottom of this file.

## Decisions already taken

Asked and answered on 2026-08-27:

- **Their look, and as of 2026-08-27 their copy too.** The original decision
  was their look with our new-build positioning, because "the all-in-one
  platform that brings clarity, connection, and calm to HOA management" is
  what every competitor's homepage already says and it drops the wedge in
  `docs/decisions/who-this-is-for.md`. Monish was shown that trade-off with
  three alternatives that kept the wedge and chose the copy exactly as drawn.
  It is his brand voice, and "Your community. Your oasis." is a better line
  than what it replaced. **The cost is real and unpaid**: the homepage no
  longer says anywhere above the fold that this is for new communities. The
  proof band and the showcase sections below still do, which is the only
  reason this is survivable. If the page ever converts badly, this is the
  first thing to test.
- **Self-serve stays.** Their CTA is "Request a Demo". Ours is "Set up a
  community" into a wizard that works end to end. Keep the wizard. A demo
  request needs a lead form and somewhere for leads to land, and it buries the
  thing that already works.
- **Both themes, always.** `CLAUDE.md` requires it and Monish asked for it
  explicitly: he likes the white background too and wants day and night with
  the same imagery.

## What the design looks like, written down

From the screenshot, before it was lost.

**Palette.** Deep navy field, close to the existing `navy-950`, with a subtle
darker vignette toward the corners. Headline white. One accent word in a light
periwinkle blue, noticeably lighter than the CTA. The CTA button is a saturated
royal blue, flatter and more purple than the current `brand`. Body copy sits in
a muted blue-grey, not white.

**Logo.** A thin-stroke circle enclosing a palm tree leaning right, a small
island mound, and two or three horizontal water lines beneath it. White stroke,
no fill, roughly even line weight. Wordmark "HOAsis" to its right in white,
semibold, tight tracking, all one weight with no case or colour break between
"HOA" and "sis". The existing mark in `src/components/app/logo.tsx` is the same
idea more abstractly: its own comment calls it "a waterline over a roofline".

**Nav.** Wordmark hard left. Centre-right links: Features, Solutions, Pricing,
Resources, About. Then a filled royal blue "Request a Demo" button at the far
right. Generous vertical padding, no bottom border, sitting directly on the
hero rather than on its own bar.

**Hero layout.** Roughly 45/55. Copy left, held well away from the edge and
vertically centred. Illustration right, bleeding off the right edge and running
the full height of the section rather than sitting in a box.

**Hero copy, as designed.** Headline on two lines: "Your community." then "Your
oasis.", with "oasis" in the light blue. Sub: "HOAsis is the all-in-one
platform that brings clarity, connection, and calm to HOA management." Then the
CTA, "Request a Demo" with a chevron.

As of 2026-08-27 the headline and sub are used verbatim, with only "oasis."
carrying the accent colour, as drawn. The CTA still points at `/start`.

**Illustration.** A stylised isometric aerial of a subdivision at night. A ring
road circles a lake; a small pavilion sits on an island in the middle, reached
by a footbridge. Houses face inward around the ring with warm lit windows,
trees and hedges between them, and path lights along the roads. Soft, low
contrast, matte, no photographic texture. Reads as an illustration rather than
a render.

## What was built, and from what

The friend's assets never arrived, so both were derived from the screenshot:

- **The mark** is redrawn, not traced. `src/components/app/logo.tsx` is an open
  `currentColor` stroke on a 40 unit box: circle, palm of eight fronds, two
  dune ridges, a shoreline and two water strokes. Geometry was measured off the
  screenshot at 6.7x. It replaces the old filled navy square holding a
  roofline, so the change is everywhere the `Wordmark` appears, which is what
  Monish asked for. Nothing is clipped, so there is no `id` to collide when the
  header mark and the footer mark are on the same page.
- **The hero illustration** is `public/marketing/hero-community.jpg`, cut from
  the text-free right side of the screenshot (x 735, y 145, 801 by 879),
  upscaled 2x and saved at JPEG 90. It is soft at very large sizes. See
  `public/marketing/CREDITS.md`.

Colours were sampled off the screenshot and added to `src/app/globals.css` and
`src/lib/tokens.ts` as required:

| Token | Light | Dark | From |
| --- | --- | --- | --- |
| `--royal` | `#1b3e8c` | `#1b3e8c` | the CTA button, same in both themes |
| `--hero-field` | `#eef2f9` | `#001330` | the hero ground |
| `--hero-accent` | `#2f68d8` | `#7dabf8` | the accent word, darkened for the light theme so it holds contrast |

Layout notes worth keeping:

- The illustration is a 58% wide band pinned to the right of the section,
  bleeding off the edge, dissolved into the field by a gradient painted in the
  field colour itself. That is why one set of markup works in both themes.
- Both themes, resolved. The light theme lifts the night render with
  `brightness-[1.28] saturate-[.82]` rather than dropping it on the page as a
  dark slab. It reads as an overcast morning, which is close enough to day to
  live on a white ground.
- Under `lg` the same image runs full width beneath the copy.
- The header was left alone apart from the CTA colour. The design's nav sits
  borderless on the hero; ours is sticky and needs a background once you
  scroll, and that is a scroll listener for a small gain.
- The design's nav is Features, Solutions, Pricing, Resources, About. Ours is
  Home, Pricing, Library, About, because those are the pages that exist. Do not
  add nav for pages we do not have.

## Still outstanding

1. **The original artwork**, whenever the friend can send it.
   - Logo: an SVG, so the redraw can be checked against it or replaced.
   - Hero: the full-resolution render. The current crop loses the left half of
     the ring road, which is the part of the composition that reads as a
     neighbourhood rather than as a lake.
2. **A day render of the same scene**: identical composition, daylight palette,
   no window glow, at `public/marketing/hero-community-day.png`. The CSS filter
   is a stand-in, not the idea.
3. **The friend's typeface**, if there is one. The wordmark is currently Geist
   semibold, which is close but not obviously the same face.

## The rehaul from the deck, 2026-08-28

Monish brought a five slide deck, `home website.pptx`, and asked for the site
to match it in look and in words: "a rehaul with this as the template". The
slides are in `deck-2026-08-28/`, downsized. Slide three also carries the shot
list for Greg's video, which is a set of generation prompts rather than site
copy. He singled out slides two and four as the look he wants.

What each slide became:

| Slide | Section on the page |
| --- | --- |
| 1, hero | Unchanged layout. CTA is now **Quick Setup**, as the slide's overlay says, into `/start`. The five promises along the bottom of the slide are a navy strip under the hero. |
| 2, "Run your HOA. Not another job." | Copy left, the real dashboard screenshot in a CSS monitor right. The slide's dashboard is a drawing; ours is the product. |
| 3, "Sound familiar? Meet Greg." | The slide had two lines whited out and the button relabelled **Start Today**; the page follows the edited version. The slide drew a video player; Monish decided on 2026-08-28 there is no video to make, so the section is the still in a frame with no play control. |
| 4, "Built for the way HOA boards actually work." | Five cards with a miniature screen each, drawn from the demo's records: the Washington law article, the reserve components, the vendors, the library. Five across on `xl`, a snap-scrolling row below that. "Explore all features" goes to `/pricing#included`. |
| 5, "Your entire community. In your pocket." | The phone with notice cards floating beside it, each derived from a demo record. **No store badges**: there is no native app yet, so the line reads "Works in any browser today. iPhone and Android apps are next." |

After the five slides there is one line of pricing and a closing band, because
the strip promises a free trial and the next question is what comes after it.

Decisions taken in the rehaul, and why:

- **Em dashes are removed** from the deck's copy. Four of its lines have one;
  each is now a comma or a full stop. Everything else is word for word.
- **"90-day free trial" is now a product fact**, `TRIAL_DAYS` in
  `src/lib/pricing.ts`, quoted by the strip, the closing band and the pricing
  page from the one constant. It was not a stated policy before the deck.
- **"Live support"** on the strip is what the board sidebar already
  promises, phone and chat 7am to 11pm. The pricing page said "email
  support"; it now says the same thing as the strip.
- **The nav reads Home, Pricing, Resources, About.** "Resources" is the
  library under the deck's label; the route is unchanged.
- **The header is transparent at the top and solid after eight pixels**,
  read through `useSyncExternalStore`. The hero pulls itself up under the
  header by the header's fixed height so the field runs to the top edge.
- **The footer no longer says "Prototype."** The demo data disclaimer stays.
- **The Greg still** is a crop of slide three with the drawn play button
  painted out. Replaced 2026-09-03 by a real photograph, `public/marketing/clarence-story.jpg`, and the character is now Clarence. See `CREDITS.md`.
- **The reserve card shows the demo's real 41%, "Behind the study".** The
  deck drew 78% "On track". Reserves are the moat, and this card is the one
  place the page shows the product catching an underfunded plan; it also
  agrees with the dashboard screenshot two sections above it.

Still owed, in addition to the list above:

1. **A clean still of Greg** without the play button, if one is ever
   rendered; the painted-out version is close but not original.
2. **Native apps**, before the pocket section can carry store badges.
