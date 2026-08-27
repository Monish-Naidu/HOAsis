# The landing page redesign

Monish's friend designed a landing page and a logo on 2026-08-27. He wants it
used. This file exists because the design arrived as a screenshot pasted into a
conversation, and a conversation does not survive a session. **The image itself
is not in the repo yet.** If `docs/design/landing-page-reference.png` is
missing, ask Monish to re-send it before doing detailed work.

## Decisions already taken

Asked and answered on 2026-08-27:

- **Their look, our positioning.** Take the dark navy hero, the split layout,
  the illustration and the logo. Keep the headline pointed at builders and new
  communities. The friend's copy is positioned at HOA management generally,
  which would drop the wedge in `docs/decisions/who-this-is-for.md` and leave
  the homepage saying what every competitor already says.
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

Per the decision above, the headline and sub get replaced with the new-build
positioning and the CTA points at `/start`. The two-line construction and the
one-accent-word device are worth keeping.

**Illustration.** A stylised isometric aerial of a subdivision at night. A ring
road circles a lake; a small pavilion sits on an island in the middle, reached
by a footbridge. Houses face inward around the ring with warm lit windows,
trees and hedges between them, and path lights along the roads. Soft, low
contrast, matte, no photographic texture. Reads as an illustration rather than
a render.

## What is needed before building it

1. **The asset files.** Nothing can be wired without them.
   - Logo: `public/brand/hoasis-mark.svg`, or PNG at 512px or larger.
   - Hero: `public/marketing/hero-community.png` or `.webp`.
2. **A day render of the same scene**, ideally: identical composition, daylight
   palette, no window glow, at `public/marketing/hero-community-day.png`. The
   supplied illustration is a night scene, and dropped onto the white theme it
   reads as a dark slab rather than as a light-mode hero.
3. **The reference screenshot itself**, at
   `docs/design/landing-page-reference.png`, so this file stops being the only
   record of it.

If no day render is coming, the fallback is to use the night illustration in
both themes and treat it as a deliberately dark panel inset on the white page.
That works. It is not the same idea, and it should be a choice rather than a
default.

## How to build it so a missing file is not a broken page

Build the hero to take both images and fall back to whichever exists, so the
night render can land first and day can follow later without another pass.
Colours come from semantic tokens as always, so the section flips with the
theme rather than being painted navy twice. If the friend's blues do not exist
in the ramp, add them to **both** `src/app/globals.css` and
`src/lib/tokens.ts`, which `CLAUDE.md` requires.
