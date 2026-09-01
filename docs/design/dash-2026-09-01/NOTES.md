# Dashboard redesign, 2026-09-01

Monish brought seven images on 2026-08-31: three dashboard designs (the PNGs in
this folder), two lakeside neighborhood renders (day and night), a monitor
render, and a leaning phone render. The designs are the reference for the board
dashboard (`/admin`) and the resident home (`/resident`); the renders went to
`public/marketing/` as the landing hero and the device frames.

## Second pass, same day

Monish asked for the renders followed almost exactly, deviating only where a
card had nothing real behind it or the copy was jargon. That pass:

- Sidebar takes the design's names and order: Finances, Violations (its own
  page now, out of Requests), Vendors, Requests, Reserve Study (its own line
  again), Compliance, Community (the forum), Meetings (its own page, out of
  Voting), Voting, Documents, Settings. Homeowners and Communications are not
  in the render but are real work, so they keep rows.
- Dashboard: title card ("Board Dashboard" + the holder's role), Monthly
  Financial Overview across the full calendar year with a working year
  filter, Spending by Category with the legend at the right and a "View full
  financial report" link, the five tiles with icon-left layout and blue
  action links, then the render's five bottom cards: Recent Activity,
  Community Updates (the forum), Announcements, Upcoming Meetings & Events,
  Quick Actions (Create Vote, Join Meeting, Review Requests, Send
  Announcement, Review Invoices, Message Owners).
- Reconciliation left the dashboard entirely, and the Finances page now says
  "Match transactions" / "Matched through" instead of "Reconcile" — the
  concept stays, the accounting word goes.
- A notifications bell with a live badge sits top right in both shells; every
  line in its panel is derived from a record, so the count is never invented.
- Spending by Category now shows "Reserve contributions" as its own slice
  (the render's Reserve Contributions), counted from the operating side of
  the transfer only. The money in/out bars still exclude transfers.
- Resident: My Home card with the owner's own photo (browser-stored,
  community photo as the fallback), design-cased quick actions, mixed
  activity feed, "View all community updates" footer. Sidebar reads
  Dashboard / Payments / Requests / Documents / Community / Meetings /
  Voting / Account. The phone preview is labeled "Mobile app" and wears an
  iOS status bar.
- The whole /admin tree became /board (redirects kept), and "admin" is now
  "board" through the code; stored sessions with the old view value still
  sign in.

Deviations kept, and why: "ARC Requests" stays "Requests" (ours also carries
maintenance, records and amenity asks, so the render's label would be wrong);
there is no Reports line (nothing behind it yet); Community Updates carries
the forum rather than a synthesized safety feed.

## What the designs changed

- Board dashboard: money in/out bars and a spending donut (selectors
  `monthlyFlows` and `spendingByCategory` in `src/lib/metrics.ts`; pixels in
  `src/components/app/board-charts.tsx`), five stat tiles, meetings and quick
  actions. The tie-out banner, review queue, clocks and approvals stayed:
  they are the product's decisions, and the design's "Violations / Safety
  feed / Community Updates" cards had no records behind them.
- Resident home: account summary with autopay state, five round quick
  actions, activity from the owner's own charge ledger, forum threads as the
  community card. Laid out against the container (`@3xl`), so one markup
  serves the website, the phone frame, and a phone.
- Both sidebars became the design's fixed navy rail.
- Chart series colors are the `chart-*` tokens in `globals.css` /
  `src/lib/tokens.ts`, taken from the dataviz reference palette and validated
  for color-vision separation on both surfaces (2026-09-01). Gray is reserved
  for "Other".

## Device screen geometry (measured off the renders)

- The monitor render (1536x1024) had its screen at (174, 55) to (1359, 675),
  aspect 1.91:1, which is why `product-shots.mjs` clips the dashboard capture
  at 1180x618. The render itself was retired on 2026-09-01: its baked-in
  studio backdrop read as a white slab on the dark theme, so the landing page
  draws an Apple-style display in code and keeps only the capture. The clip
  aspect stays, because it is a good shape for a display.
- `device-phone.png` (1086x1448): the screen is a quad, corners TL (296.5,
  125.5), TR (808.6, 41.3), BR (772.6, 1371.6), BL (217.3, 1367.9), found by
  fitting lines to the dark-pixel edges. The landing page maps a flat 430x1030
  capture onto it with a `matrix3d` computed for a 340px render width (corners
  inset 0.6% toward the centroid so the overlay never spills onto the body).
  Change the render width, or the artwork, and the matrix must be recomputed:
  scale the corners by `width / 1086`, then solve the 8x8 DLT system mapping
  (0,0)/(430,0)/(430,1030)/(0,1030) onto them.
