# Competitive analysis: PayHOA and EasyHOA

Written 26 August 2026. Sources at the bottom; every figure is linked.

---

## Read this part first

**We were priced four to six times our competitors at any normal association
size. Found on 26 August, fixed the same day, before a single customer saw it.**

We charged $4 per home per month. Both direct competitors charge a flat monthly
rate per size band, and the bands are not expensive.

| Homes | EasyHOA | PayHOA | HOAsis at $4/home | We cost |
| ---: | ---: | ---: | ---: | :--- |
| 25 | $49 | $54 | **$100** | 2.0× |
| 50 | $69 | ~$74 | **$200** | 2.9× |
| 100 | $89 | ~$99 | **$400** | 4.5× |
| 150 | $99 | ~$124 | **$600** | 6.1× |
| 250 | custom | custom | **$1,000** | — |

Mehr Meadows, our own demo association, is 88 homes. On the old pricing that
board would have paid **$352 a month** against EasyHOA's **$89**: $3,156 more a
year for software, while the entire pitch is that we save boards money.

The per-door instinct came from management companies, who genuinely charge
$10–$20 per door per month. But we are not competing with management companies
for this buyer. A board evaluating us has already decided to self-manage; they
are comparing us to EasyHOA's $89, not to a manager's $1,200.

**Decided and shipped, 26 August.** We moved to flat bands:

| Band | HOAsis | EasyHOA | PayHOA |
| --- | ---: | ---: | ---: |
| Up to 25 homes | **$39** | $49 | $54 |
| 26–75 homes | **$69** | $69–89 | ~$74–99 |
| 76–150 homes | **$109** | $89–99 | ~$99–124 |
| 151–400 homes | **$179** | custom | custom |
| 400+ | custom | custom | custom |

Cheapest at the small end, where self-management is most common and the buyer
is most price-sensitive. A premium in the middle, where the reserve model
earns it. Revenue per customer is lower than $4 a door, but the deals close.

**The payment fee, by contrast, was already right.** PayHOA charges **$2.45 per
ACH** and **3.50% + $0.50** on cards. We charge **$2.00 per ACH** and pass card
processing through at Stripe's actual **2.9% + $0.30**. On a $285 assessment
paid by card, PayHOA takes $10.48 and we take $8.57.

**This is now a table on /pricing**, including the row where we lose: at 88
homes our software costs $1,308 a year against their $1,068. Showing the
unflattering number alongside the flattering ones is the entire reason anybody
will believe the flattering ones.

---

## Who they are

### PayHOA

Founded 2018, the category incumbent for self-managed associations. Cloud
platform covering dues collection, ACH and card payments, owner portals,
violation tracking, maintenance requests, document management and board
communications. Every tier includes every feature. Payments run on Stripe.

**Pricing:** from $54/month for 0–25 units, banded upward. $2.45 per ACH,
3.50% + $0.50 per card. No American Express.

### EasyHOA

Positions explicitly as "the only affordable software built specifically for
self-managed HOAs." All features at every tier, US-based support, and a wider
product surface than PayHOA: it bundles a **community website** and an
**integrated phone system**, which is unusual.

**Pricing:** $49 (1–25), $69 (26–50), $89 (51–100), $99 (101–150), custom
above. Flat, not per unit.

---

## What they do well, honestly

**Both price for the buyer they actually have.** A volunteer treasurer with a
$40,000 annual budget can approve $69 a month without a board vote. That is the
single most important thing either of them does, and it is why the pricing
change above mattered more than any feature on this list.

**PayHOA's breadth is real.** Violations, requests, documents, broadcast email
and SMS, owner portals. Reviewers consistently call it easy to set up and say
support is responsive. Our violation tracking does not exist and our SMS does
not exist.

**EasyHOA bundles things boards actually ask for.** A community website is a
real ask, because owners expect one and boards do not want to run WordPress.
The phone system is unusual and probably sticky: once a board publishes that
number on a sign, switching costs go up sharply.

**Both have automatic bank transaction import.** EasyHOA advertises it plainly.
Ours is a fixture; we have not integrated a feed.

**Both have a chart of accounts.** Real bookkeeping structure, not a ledger with
category strings. Ours is a category enum, which will not survive contact with
an accountant preparing a review.

---

## Where they are weak, with evidence

### 1. Reserve planning is a hole in the whole category

PayHOA supports reserve categories in the chart of accounts but **has no reserve
study module**. Neither does EasyHOA in any material sense.

This matters more than it sounds. Association Reserves, analysing **over 100,000
reserve studies from 1986 to 2025, found roughly 74% of US HOAs are
underfunded**. Several states mandate reserve studies outright above a unit
count, and many CC&Rs require them regardless of size. The traditional failure
is structural: the annual budget lives in one silo and the reserve study in
another, so boards cannot see the connection until they are levying a special
assessment.

**We already have the answer built.** Thirty-year projection, every component
replaced in the year its life ends at a cost inflated to that year, the first
negative year named, and a solver that works out the contribution which avoids
it. That is not a feature either competitor can add in a quarter, because it
requires a real model rather than a form.

**This should be the headline of our marketing, not a bullet on the fourth
scroll.**

### 2. PayHOA has a payment-application complaint problem

BBB complaints and reviews cite **disputes over how homeowner payments are
applied to outstanding balances**, and difficulty adjusting charges, managing
late fees, and editing balances.

This is a trust failure and it is expensive: it produces angry owners, board
escalation, and churn. **We already solve it structurally.** Every payment
applies oldest-charge-first, and `payment_allocations` records exactly which
charge each dollar cleared. An owner can see it. A board can prove it.

Marketing line: *"Every payment shows which charges it cleared. In writing.
Oldest first, every time."*

### 3. Fee opacity is their second complaint

Reviewers describe PayHOA's transaction and card fees as **"high and confusing."**
They charge 3.50% + $0.50 on a card while Stripe charges them 2.9% + $0.30. The
markup is real and it is not disclosed on the receipt.

**We itemize processor cost and our fee as two separate lines.** That was built
deliberately, and it is a direct answer to a named complaint about the market
leader. As of today it is also on the pricing page, next to theirs.

### 4. Board turnover destroys institutional knowledge

The clearest theme in the research: boards "pass spreadsheets and login
credentials between rotating volunteers" and lose institutional knowledge with
every transition. Nothing in either product addresses succession.

**We are halfway there without meaning to be.** Memberships carry start and end
dates, so the record of who owned and ran what, when, survives a handover. We
just built presidency transfer with a database guarantee that an association can
never be left without an officer.

**Gap to close:** a genuine board-transition flow. Hand over, brief the
successor, and produce a "state of the association" pack. Nobody has this.

### 5. Shared utility costs sit in a gap between two industries

Researched 26 August 2026.

A large share of condominium, townhome and older single-family associations are on
a **master utility meter**. The association is the customer of record for water,
sewer, trash, sometimes gas and bulk internet. It pays one bill and recovers the
cost inside dues. Owners therefore have no bill to look at, no account to log in
to, and no way to check what they are paying for.

Splitting that bill across homes has its own industry. It is called **RUBS**, ratio
utility billing, when the split uses a formula (occupancy, square footage, bedroom
count) and **submetering** when each unit has a real meter. Vendors include
SimpleSUB, AmCoBi, Synergy Utility Billing, Think Utility Services and Guardian.
Properties using a RUBS allocation report **6% to 27% reductions in water usage**
purely from making the cost visible.

Here is the gap:

- **The utility billing vendors do not do the association's books.** They produce an
  allocation file and hand it back. Reconciliation, statements, delinquency and
  reserves are somebody else's problem.
- **The HOA platforms do not do utilities.** PayHOA supports a *separate account*
  for utility expenses and recommends tracking them there, which is bookkeeping
  advice, not a feature. Neither PayHOA nor EasyHOA allocates a provider bill across
  homes, publishes the provider's name to owners, or shows what a utility has cost
  the community over time.

So an association on a master meter runs two systems and reconciles them by hand,
or gives up and buries the cost in dues where nobody can question it.

**We now sit in the middle.** A provider bill is posted once, split by whichever
basis the association chose, and lands on statements as an ordinary charge. Owners
see the provider's name, the community total, and their own share. The board sees
two years of cost per home and the year-on-year change against the same month last
year, because every utility is seasonal and a December-to-January comparison says
nothing.

Two details worth knowing, because they are why this normally goes wrong:

1. **Rounding.** Dividing a bill by 37 homes leaves a remainder. Rounding each share
   independently produces a total a few cents off the bill the association actually
   owes, every month, forever. We use largest-remainder allocation, and it is
   verified across 144 consecutive bills in the three-year test suite.
2. **Markup.** Some boards add an administration percentage, and several states cap
   or forbid it. We store it as a separate recorded field rather than folding it
   into the rate, so what owners are charged is always reproducible from what the
   provider charged.

**Positioning:** this is the only feature in the product that a competitor cannot
copy by adding a screen. It requires the allocation engine, the statement, and the
books to be the same system.

### 6. Compliance is nobody's product

Research repeatedly notes boards fall behind on state-mandated reserve studies
and annual disclosures, and that compliance risk grows because nobody tracks it.
Our compliance register exists but is honestly parked at chapter level pending a
legal pass.

---

## Where we are genuinely behind

Listing these plainly because pretending otherwise wastes our own time.

| Gap | They have it | Severity |
| --- | --- | --- |
| **Price** | Both | **Existential** |
| Live bank feed | Both | High. Our reconciliation story needs it to be true. |
| Chart of accounts | Both | High. An accountant will ask. |
| Violation tracking | PayHOA | Medium. Common board job we do not do. |
| SMS | EasyHOA (unlimited) | Medium. Boards ask for it. |
| Community website | EasyHOA | Medium. We have the pieces. |
| Phone system | EasyHOA | Low. Odd, sticky, expensive to build. |
| Payments actually working | Both | **Existential.** Ours is not wired to Stripe yet. |
| Track record | Both, since 2018 | High and slow to fix. |

---

## Where we already stand apart

Things that are built, tested, and not replicable in a sprint.

1. **A real reserve model.** Thirty years, component-level, inflation-adjusted,
   with a solver. The category's biggest hole.
2. **Provable payment application.** Oldest first, with allocations recorded per
   charge. Directly answers PayHOA's loudest complaint.
3. **Itemized fees.** Processor and platform shown separately, never blended.
4. **Reconciliation discipline.** Anything needing a human decision is held out
   of every report until it gets one, and the dashboard says so rather than
   quietly averaging it in.
5. **Real tenant isolation.** Access decided by the database, not the client. An
   outsider gets zero rows, and we have tests that attack it from the outside.
   Neither competitor makes any claim here, and one leaked balance would be a
   catastrophe for them.
6. **Statutory versus optional email.** An owner cannot unsubscribe from being
   told they owe money, enforced by a constraint. Nobody else distinguishes.
7. **A free, state-specific library** with no email gate.

---

## Game plan

### Before the first customer

1. ~~**Change the pricing to flat tiers.**~~ Done 26 August.
2. **Wire up Stripe.** Bank, card, Apple Pay, Google Pay. Needs a Stripe
   account, a real domain, and Connect onboarding. This is the last thing
   standing between the product and being real.
3. **Buy a domain.** Blocks Apple Pay verification, Resend email, and payment
   links simultaneously.
4. **Put the reserve model on the front page.** It is our best asset and it is
   currently the second showcase panel.
5. ~~**Add the fee comparison table to /pricing.**~~ Done 26 August, including
   the row where we lose.
6. **Build resale certificates.** The best adjacent revenue line we have and
   mostly a report over data we already hold.

### First ninety days

6. **Live bank feed.** Plaid or Stripe Financial Connections. Our whole
   reconciliation pitch assumes it.
7. **Chart of accounts.** Replace the category enum with a real account tree.
8. **Violation tracking.** Table stakes we lack.
9. **Board transition pack.** Nobody has it, and every board needs it annually.
   Hand over, brief the successor, export a state-of-the-association summary.
10. **SMS** via the same provider as email.

### Later

11. Community website generated from association data.
12. Finish the compliance register with a legal pass, starting with Washington.
13. Reserve study import from a professional study PDF.

---

## How else we make money

Subscription alone is a thin business at $39–179 a month. The research on this
category points at several adjacent lines, and they are not equally good.

### 1. Resale and estoppel certificates — the strongest by far

When a home in an association sells, the board must produce a resale package:
current balance, pending violations, governing documents, reserve status,
insurance. Title companies and buyers **pay $200–500 for this**, it is legally
required in most states, and it lands on a volunteer treasurer at the worst
possible moment. Industry reporting describes resale document processing as
raising a manager's revenue **up to 50% without changing their pricing**.

**We can generate the entire package from data we already hold.** Balance,
charge history, documents, reserve percent funded, insurance record. That is a
button, not a product.

Suggested: **$175 per certificate**, association keeps $75, we keep $100. The
board earns money for work they were doing free, and it is billed to the buyer
rather than to the association. At an average 5% annual turnover, a 100 home
association generates five certificates a year: $500 to us, $375 to them.
Roughly a third of the subscription again, from customers we already have.

### 2. Treasury on reserves

Reserves are the largest pile of money an association holds and it usually sits
in a checking account earning nothing. We already model blended yield, interest
earned, and what moving the balance would be worth, and 74% of associations are
underfunded, so the interest is not trivial to them.

Partner with a bank or a cash-management provider offering an association
money-market account, and take a referral fee or a share of the spread.
Mehr Meadows holds $562,860 in reserves. At even 3% that is $16,885 a year the
board is currently leaving on the table, and a 25 basis point share is $1,400 a
year to us from one association.

**This is the one where our interests and theirs point the same way**, which is
the test any of these should pass.

### 3. Reserve study referral

We are the only product in the category that tells a board they need a study
and shows what happens without one. Studies cost $2,000–5,000. A referral fee
of 10% is $200–500 per referral, and the recommendation is credible because it
comes from a model rather than an ad.

### 4. Insurance

Associations must carry property and liability cover, and the annual budget
report has to disclose it. We already record carrier, policy number and renewal
date, so we know when every customer's policy expires. A quote comparison at
renewal is genuinely useful and commissions in this line are large.

Handle carefully: the moment we take a commission, our renewal reminder stops
being neutral advice. Disclose it plainly or do not do it.

### 5. Special assessment financing

When reserves fall short, boards levy a special assessment and owners struggle
to pay it in one go. Lenders finance these. We are the only party who can see
the shortfall coming years ahead.

Genuine tension: we make money when reserves fail, while the product exists to
prevent that. **I would not build this**, or would only offer it after a board
has already voted the assessment.

### What to avoid

**Marking up card processing.** PayHOA charges 3.50% + 50¢ over Stripe's 2.9% +
30¢ and gets called "high and confusing" in public reviews for it. That markup
buys perhaps $2 a payment and costs the trust our whole pitch rests on.

**Advertising to residents.** Some platforms sell local business placements. It
is small money and it makes an association's private portal feel like a
free product, which is the opposite of what a board is paying for.

**Charging for exports or records.** Owners have a statutory right to most of
this. Charging for it would be ugly and possibly unlawful.

### Rough picture, 100 homes

| Line | Annual | Confidence |
| --- | ---: | --- |
| Subscription ($109/mo) | $1,308 | Certain |
| Payment fees (100 homes × 12 × $2, mostly ACH) | ~$1,980 | High |
| Resale certificates (5 sales) | $500 | Medium |
| Treasury share on reserves | $500–1,500 | Speculative |
| Reserve study referral | $0–400 | Speculative |
| **Total** | **$4,300–5,700** | — |

Payments are already the larger half of the business, which is worth
internalising: **we are a payments company with an HOA product attached**, and
the subscription mostly exists to make the payments happen.

---

## Positioning

Current line: *"Everything a management company does. Run from your own website."*

That aims at the wrong opponent. A board looking at us has already left the
management company; they are choosing between three pieces of software.

Suggested: **"The only HOA software that tells you the year the money runs
out."**

It names the thing nobody else does, it speaks to the 74% who are underfunded,
and it is a claim we can demonstrate in ninety seconds.

---

## Sources

- [PayHOA pricing](https://www.payhoa.com/pricing/) and [payment fees](https://intercom.help/payhoa/en/articles/8663819-payment-fees)
- [PayHOA reviews and complaints, Capterra](https://www.capterra.com/p/146693/PayHOA/reviews/)
- [PayHOA reviews, Software Advice](https://www.softwareadvice.com/product/61833-PayHOA/)
- [PayHOA pros, cons and the reserve gap, ManageCasa](https://managecasa.com/articles/payhoa-reviews-features-pros-cons)
- [EasyHOA pricing](https://easyhoa.com/pricing/)
- [EasyHOA features and reviews, Software Finder](https://softwarefinder.com/property-management-software/easyhoa)
- [Easy HOA, GetApp](https://www.getapp.com/real-estate-property-software/a/easy-hoa/)
- [PayHOA vs Easy HOA, Capterra](https://www.capterra.com/compare/146693-237509/PayHOA-vs-Easy-HOA)
- [HOA reserve funds, funding levels and state rules, ManageCasa](https://managecasa.com/articles/hoa-reserve-funds)
- [The HOA software buying mistake boards make in their first 90 days](https://www.streetinsider.com/KeyCrew/The+HOA+Software+Buying+Mistake+Most+Boards+Make+in+Their+First+90+Days/26342337.html)
- [HOA software for self-managed boards, buyer's guide, Solume](https://www.community.solume.com/blog/hoa-software-self-managed-boards-guide)
- [Stripe pricing](https://stripe.com/pricing), for the pass-through card rate

On shared utility billing:

- [RUBS explained, National Center for Housing Management](https://www.nchm.org/rubs-ratio-utility-billing-system-explained/)
- [Water submetering for HOAs, SimpleSUB](https://www.simplesubwater.com/resources/water-submetering-for-hoas-the-complete-guide)
- [Submetering for savings, CooperatorNews](https://fl.cooperatornews.com/article/submetering-for-savings)
- [RUBS billing, Synergy Utility Billing](https://www.synergyutilitybilling.com/services/rubs-billing/)
- [Ratio utility billing systems, Think Utility Services](https://thinkutilityservices.com/rubs-ratio-utility-billing-systems/)
- [PayHOA on utility accounts and budget items](https://www.payhoa.com/budget-items-what-does-an-hoa-need/)
- [PayHOA glossary, special assessment](https://www.payhoa.com/glossary/special-assessment/)

Competitor pricing was read from their own published pages on 26 August 2026 and
should be re-checked before anything here is quoted publicly. Mid-band PayHOA
figures marked "~" are interpolated between published anchors.
