# Express HOA — UI change spec from 9/1/26 huddle

Source: Slack huddle transcript, Monish + Arya. Timestamps reference the transcript. Everything below is a decision unless marked *open*.

## 1. Global: sidebar (resident and board views) — [46:12–47:33], [51:24–51:48], [58:19–58:51]

- Sidebar spans the full viewport height, left edge, top to bottom. It is fixed/static; it does not scroll with page content.
- Nav items are evenly spaced vertically. Button styling stays as-is (Monish and Arya both fine with current buttons).
- Remove the property/community label from the sidebar ("Mor Meadow Unit 7" in resident view, "Springfield Estates" in board view). That info already appears in the top banner, so the sidebar copy is redundant.
- Nav order for now: Dashboard, Payments, Requests, Documents, Community, Meetings, Voting, Vendors, Account. [1:04:56–1:05:09]
- Note from Arya: he could not get ChatGPT to produce the full-height sidebar; expect a couple of iterations. Monish says it existed in an earlier version and was lost in an AI refactor — check git history for the old implementation.

## 2. Resident dashboard — [47:46–57:33]

Goal: a resident logs in to pay. The center of the screen should answer "what do I owe and how do I pay" without scrolling.

- Top banner/hero image: increase its height ("thicker"); currently too much white space below it. Fill more of the viewport without looking crowded. [47:46–48:04]
- Account summary card stretches full width of the content area (left edge to right edge, where the Community card used to end). It carries: current balance / amount due, a prominent Pay Now button, autopay status, next payment date. This is the visual focal point. [48:20–49:28], [53:31–54:18]
- Remove the Open Requests section from the dashboard. Architectural-review requests will instead surface as line items in Recent Activity (e.g. "Request #1257 updated"). *Open:* Monish to think about whether requests need any clearer signal than an activity line. [54:19–55:06]
- Quick Actions bar moves directly beneath the account summary and spans the same full width. [53:48–54:08]
- Recent Activity moves into the slot previously occupied by Community (the large card). [56:51–57:05]
- Remove the Community card from the dashboard entirely. Community remains its own sidebar tab and gets built out there; revisit adding it back to the dashboard once there is a network effect. Reason: small first communities (5–22 homes) and a single adopter in another state would see an empty card. [55:15–56:49]
- Keep Upcoming Events and Announcements on the dashboard (HOA meetings, pool opening, etc.). [57:06–57:19]
- Resulting layout, top to bottom: banner → full-width Account Summary + Pay Now → full-width Quick Actions → Recent Activity (large) alongside Upcoming Events / Announcements. No vertical scroll needed at desktop size; mobile stacks these as scrollable blocks.
- Avatars: show a default avatar for users with no uploaded photo. [1:04:45–1:04:56]

## 3. Board dashboard — [58:06–1:04:25]

- Terminology: "Admin/Admins" → "Board" everywhere (board president, board treasurer, etc.). This is the contract for admin-level roles. [58:10]
- Sidebar: same full-height static treatment as resident view; remove "Springfield Estates" from sidebar. [58:19–58:51]
- Keep the financial visuals: Spending by Category and the Monthly Financial Overview (income vs. expense per month, so winner/loser months are visible). [58:54–59:48]
- Add a year dropdown to the monthly overview to pull prior years. *Open (later):* a way to compare years / show deltas and trends. [59:48–1:00:14]
- Remove from the board dashboard: Recent Activity, Community Updates, Announcements, Upcoming Meetings/Events. Board view is admin-level only; board members switch to the resident view for resident-facing content. [1:00:23–1:02:34]
- Keep Quick Actions, cleaned up. Confirmed actions: Create Vote, Create/Schedule Meeting (meetings are created by the board, not residents), Review Requests, Send Announcement. Layout is Monish's call; Arya flagged that a 5-item column under the 5 stat tiles (total accounts, past due, open requests, export, etc.) may look awkward, so consider a different arrangement. Monish will send a couple of screenshots/wire options via Slack. [1:02:34–1:04:25]
- Vendors tab stays. Backlog item (this iteration, not dashboard): vendor emails invoice to an inbox → auto-categorized by vendor/amount → board approves → ACH payout from the HOA bank. [1:05:09–1:05:56]
- Reserve study: keep it simple for v1. Board uploads/saves the study PDF, manually enters the line items and years, app tracks them. AI-parsing the PDF is deferred. Consider a short "how to read a reserve study" help doc in the library. [1:06:09–1:07:52]
- Announcement preview/staging before publishing: P2, ~6 months out. Not now. [1:01:14–1:02:11]

## 4. Homepage — [1:08:07–1:21:21]

Hero
- Keep the hummingbird logo and the AI-generated hero image with its fade; do not go full-bleed. [1:08:21–1:09:17]
- Shift the hero text block up roughly an inch or two so more of the image shows. [1:09:06–1:10:18]
- Tagline breaks as two lines: line 1 "Moving your community", line 2 "Forward". [1:09:32–1:10:10]
- Subhead: "Everything your community needs" → "Everything your HOA needs". The word HOA should appear in the hero. [1:10:22–1:10:38]
- CTAs: remove "See how it works". Keep "Get started" as the primary block button and keep "Log in" next to it, but give Log in an outline so it is visible. [1:10:39–1:11:15]

Setup strip (the "set up in minutes / no card / cancel anytime" bar)
- Light mode: the bar is too dark against the white page. Make it a lighter gray with blue text/icons for contrast. [1:11:15–1:12:20]

Product image
- Replace the current Mac mockup with the silver Mac image Arya uploaded; the current dark one loses its border in dark mode. (Arya: the silver one is the newer model, not an older one.) [1:12:23–1:13:36]
- Directional idea from PayHOA's site: show the actual dashboard screenshot larger, possibly without the device frame, and use a few big feature sections rather than one grid of check marks. Monish to take a stab. [1:19:51–1:21:06]

Value props section
- Keep "Save time, save money, stay compliant". [1:13:36–1:13:48]
- Remove the subtext "Express HOA gives your board the tools…". Move the three tiles up to close the gap. [1:13:48–1:14:03]
- Add a "Get started today" CTA at the bottom of this section (every scroll stop should have a clickable action, not just a title). [1:14:03–1:14:14]

"Sound familiar?" / Greg section
- Keep the AI-generated Greg image and the copy as-is for now (real-person photo considered and rejected for now). [1:14:33–1:17:05]

Features section
- Too noisy at 8 tiles. Reduce to 4 main tiles plus a fifth "…and more" tile. Remove the Knowledge Center tile; the Board Transitions tile becomes "and more" and lists the remaining features as a simple text list: payments & dues, violations, architectural requests, documents, communication, meetings, voting, reporting, directory, knowledge center, board transitions. [1:17:05–1:19:04]
- No testimonials/reviews section (none to show yet). [1:21:07–1:21:16]
- Integrations row: mirror PayHOA's (Plaid, Stripe, etc.) as logos. [1:21:21–1:21:41]

## 5. Deferred / not in this pass

- Mobile app: website first; React code translates later. Offer as free beta to first customers. [43:03–44:03]
- Animated Fiverr video: on hold until there is revenue; product quality first. [1:16:04–1:16:49]
- Announcement preview (P2), reserve-study PDF parsing (v2), year-over-year financial comparison.

## 6. Delivery

- Monish to code the UI changes, then run a functional pass (buttons actually wired) and deliver an update to Arya by tomorrow (9/2); larger updates through the week, sent by Saturday when Arya is back. [1:22:00–1:22:36]
