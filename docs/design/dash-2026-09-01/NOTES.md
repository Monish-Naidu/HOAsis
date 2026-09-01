# Dashboard redesign, 2026-09-01

Monish brought seven images on 2026-08-31: three dashboard designs (the PNGs in
this folder), two lakeside neighborhood renders (day and night), a monitor
render, and a leaning phone render. The designs are the reference for the board
dashboard (`/admin`) and the resident home (`/resident`); the renders went to
`public/marketing/` as the landing hero and the device frames.

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

- `device-monitor.jpg` (1536x1024): screen is the rectangle from (174, 55) to
  (1359, 675) — as fractions: left 11.33%, top 5.37%, width 77.21%, height
  60.64%. Aspect 1.91:1, which is why `product-shots.mjs` clips the dashboard
  capture at 1180x618.
- `device-phone.png` (1086x1448): the screen is a quad, corners TL (296.5,
  125.5), TR (808.6, 41.3), BR (772.6, 1371.6), BL (217.3, 1367.9), found by
  fitting lines to the dark-pixel edges. The landing page maps a flat 430x1030
  capture onto it with a `matrix3d` computed for a 340px render width (corners
  inset 0.6% toward the centroid so the overlay never spills onto the body).
  Change the render width, or the artwork, and the matrix must be recomputed:
  scale the corners by `width / 1086`, then solve the 8x8 DLT system mapping
  (0,0)/(430,0)/(430,1030)/(0,1030) onto them.
