# Photo credits

## The hero illustration

`hero-day.jpg` and `hero-night.jpg` are the same lakeside neighborhood rendered
twice, and they are the one set of images here that is not photography and is
not pretending to be: an illustration says "this is how we see it" where a fake
photograph says "this is a place", and only the second one is a lie. Monish
brought them on 2026-08-31 (generated renders, made for this page); the day
version carries the light theme, the night version the dark one. They replaced
`hero-community.jpg`, the upscaled screenshot crop that stood in from
2026-08-27, and with it the CSS filter that faked a daylight version.

## The devices

`device-phone.png` is a rendered device study with a dark screen, from the
same 2026-08-31 delivery as the heroes; the real resident capture is mapped
onto its leaning glass with a measured projective transform (the numbers live
in `src/app/page.tsx`). A matching monitor render arrived too, but it carried
its own studio backdrop, which read as a white slab on the dark theme; the
desktop display is drawn in code instead, Apple-style, with the capture on
the glass. The screen content is always a real capture from
`scripts/product-shots.mjs`, never drawn.

## Clarence

`clarence-story.jpg` is Clarence, the board member on slide three. Until
2026-09-03 this was a render lifted from the deck ("Greg"), with a play button
painted out. Monish asked for a real, free photograph of a real person who
looks the way a new board member feels, so it is now
[Pexels photo 7926668](https://www.pexels.com/photo/stressed-old-man-reading-paperwork-at-home-7926668/)
by Nicola Barts, under the [Pexels license](https://www.pexels.com/license/)
(free to use, no attribution required, credited anyway). Cropped to 4:5 and
resized to 1200px wide.

## Photographs

Every photograph here is a photograph. Nothing is generated, and each one was
looked at before it went in: a render or a composite reads as fake to exactly
the audience we are asking to trust us with their money.

Marketing photography from [Unsplash](https://unsplash.com), used under the
[Unsplash License](https://unsplash.com/license), which permits commercial use
without attribution. Credited anyway, because the photographers did the work.

| File | Source |
| --- | --- |
| `neighborhood.jpg` | unsplash.com/photos/1592595896551-12b371d546d5 |
| `aerial.jpg` | unsplash.com/photos/1524813686514-a57563d77965 |
| `evening.jpg` | unsplash.com/photos/1494526585095-c41746248156 |

Two of these are copied into `public/community` as the seeded photos of two
homes, so the attribution above covers them too:
`community/home-1428-mehr-meadows-lane.jpg` is `evening.jpg`, and
`community/home-1302-mehr-meadows-lane.jpg` is `homes.jpg`.

Library photography, one per group rather than one per article. A photograph
for each of thirty-three pages would be filler on the twenty-four state
reference pages, and filler reads as filler.

| File | Shows | Source |
| --- | --- | --- |
| `library/getting-started.jpg` | Books and a calendar, planning a first month | unsplash.com/photos/1507831228884-93d43e81a99d |
| `library/money.jpg` | Tax forms, a calculator and a pen | unsplash.com/photos/1554224155-6726b3ff858f |
| `library/reserves.jpg` | Shingles being stripped from a roof | unsplash.com/photos/1633759593085-1eaeb724fc88 |
| `library/records.jpg` | A long table set for a meeting | unsplash.com/photos/1503423571797-2d2bb372094a |
| `library/rules.jpg` | A white picket fence on a residential street | unsplash.com/photos/1717206438385-d9196506f00d |
| `library/buying.jpg` | A for sale sign | unsplash.com/photos/1725379448168-e33c5e09d47e |
| `library/state-law.jpg` | A state capitol dome | unsplash.com/photos/1573181759662-1c146525b21f |

`product-*.png` are screenshots of this application, captured by
`scripts/product-shots.mjs`. Re-run it after a design change; an old shot is
the thing that quietly starts advertising a screen that no longer exists.
`founder-*.jpg` are supplied by the founders.
