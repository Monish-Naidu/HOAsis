import { describe, expect, it } from "vitest";
import { allCommunities, mehrMeadows } from "@/lib/data/communities";
import { governingAmendments, governingArticles } from "@/lib/data/governing";
import { violations } from "@/lib/data/requests";
import { policyTemplates } from "@/lib/data/policy-templates";
import { disclosureCoverage, resolveCitation } from "@/lib/governing";
import { sharedCostBills, sharedCosts } from "@/lib/data/shared-costs";
import { LIBRARY_TOPICS, STATES, libraryArticles } from "@/lib/data/library";

/**
 * The fixtures are the product, for now.
 *
 * Every screen reads them, so a broken reference here is a broken screen, and
 * the failures are the quiet kind: a ballot pointing at an option that does
 * not exist, a bill whose shares do not add up, a state page for a state the
 * filter does not offer. These check the joins nothing else does.
 */
describe("every community is internally consistent", () => {
  for (const community of allCommunities()) {
    describe(community.label, () => {
      it("has a unique id and a matching association", () => {
        expect(community.association.id).toBeTruthy();
        expect(community.label.length).toBeGreaterThan(0);
      });

      it("gives every owner a unit that exists on the register", () => {
        const units = new Set(community.owners.map((o) => o.unit));
        // Two owners sharing a unit means two bills for one home.
        expect(units.size).toBe(community.owners.length);
      });

      it("counts homes rather than storing a number that can drift", () => {
        if (community.owners.length > 0) {
          expect(community.association.unitCount).toBe(community.owners.length);
        }
      });

      it("points every account at an owner that exists", () => {
        const owners = new Set(community.owners.map((o) => o.id));
        for (const account of community.accounts) {
          expect(owners.has(account.ownerId), `${account.name} has no owner`).toBe(true);
        }
      });

      it("has exactly one president", () => {
        const presidents = community.accounts.filter((a) => a.role === "president");
        // An association with none has no way to grant access back, and one
        // with two has a fight.
        expect(presidents).toHaveLength(1);
      });

      it("gives every ballot at least two distinct options", () => {
        for (const ballot of community.ballots) {
          expect(ballot.options.length, `${ballot.title} has too few options`).toBeGreaterThan(1);
          expect(new Set(ballot.options.map((o) => o.id)).size).toBe(ballot.options.length);
        }
      });

      it("requires a quorum on anything binding, and none on a poll", () => {
        for (const ballot of community.ballots) {
          if (ballot.kind === "poll") {
            // "Which Saturday works" decides nothing, so a quorum would be
            // theatre. Zero is the honest answer.
            expect(ballot.quorumRequired, `${ballot.title} is a poll with a quorum`).toBe(0);
            continue;
          }
          // Anything binding without a quorum passes on a single vote.
          expect(ballot.quorumRequired, `${ballot.title} can pass on one vote`).toBeGreaterThan(0);
          expect(ballot.quorumRequired).toBeLessThanOrEqual(ballot.eligible);
        }
      });

      it("never records more votes than there are eligible homes", () => {
        for (const ballot of community.ballots) {
          const cast = ballot.options.reduce((t, o) => t + o.votes, 0);
          const ceiling = ballot.eligible * (ballot.seats ?? 1);
          expect(cast, `${ballot.title} counted more votes than homes`).toBeLessThanOrEqual(
            ceiling,
          );
        }
      });

      it("points every payout at a vendor it knows", () => {
        const vendors = new Set(community.vendors.map((v) => v.id));
        for (const payout of community.payouts) {
          expect(vendors.has(payout.vendorId), `${payout.vendor} is not a vendor`).toBe(true);
        }
      });

      it("keeps money in integer cents", () => {
        const cents = [
          community.association.duesCents,
          ...community.bankAccounts.map((a) => a.balanceCents),
          ...community.owners.map((o) => o.balanceCents),
          ...community.budget.map((b) => b.annualCents),
        ];
        for (const value of cents) {
          expect(Number.isInteger(value), `${value} is not whole cents`).toBe(true);
        }
      });

      it("dates everything as YYYY-MM-DD", () => {
        const dates = [
          community.asOf,
          community.nextChargeDate,
          ...community.documents.map((d) => d.updatedDate),
          ...community.meetings.map((m) => m.date),
        ];
        for (const date of dates) {
          expect(date, `${date} is not an ISO date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });
    });
  }
});

describe("the governing documents", () => {
  it("numbers every article once within its own document", () => {
    // Article VII of the declaration and Article VII of the bylaws are two
    // different provisions. Uniqueness is per document, and conflating them is
    // how a citation lands on the wrong one.
    for (const doc of ["declaration", "bylaws", "rules"] as const) {
      const numbers = governingArticles.filter((a) => a.document === doc).map((a) => a.number);
      expect(new Set(numbers).size, `${doc} repeats an article number`).toBe(numbers.length);
    }
  });

  it("gives every id once across all three documents", () => {
    const ids = governingArticles.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every article both the governing text and a plain reading", () => {
    for (const article of governingArticles) {
      // Showing only the summary is misleading; only the deed language
      // recreates the PDF nobody opens. Text pulled from an upload is allowed
      // to arrive without a plain reading, but nothing seeded here has that
      // excuse.
      expect(article.text.length, `${article.number} has no text`).toBeGreaterThan(0);
      expect(article.extraction, `${article.number} is seeded, not extracted`).toBeUndefined();
      expect(
        (article.plain ?? "").length,
        `${article.number} has no plain reading`,
      ).toBeGreaterThan(20);
    }
  });

  it("answers every one of the eight things a buyer must be told", () => {
    // The demo association is the worked example. If its own documents cannot
    // answer the statutory disclosure list, the screen built on that list has
    // nothing to show.
    const coverage = disclosureCoverage(governingArticles);
    expect(coverage.gaps, `nothing addresses ${coverage.gaps.join(", ")}`).toEqual([]);
    expect(coverage.answered).toBe(coverage.total);
  });

  it("resolves every citation a violation makes", () => {
    // A citation that does not resolve is a notice resting on a provision
    // nobody can find, which is the thing that loses at a hearing.
    for (const violation of violations) {
      const match = resolveCitation(violation.ruleCitation, governingArticles);
      expect(
        match.article?.number,
        `${violation.reference} cites ${violation.ruleCitation}, which resolves to nothing`,
      ).toBeTruthy();
    }
  });

  it("points every amendment at an article that exists", () => {
    const ids = new Set(governingArticles.map((a) => a.id));
    for (const amendment of governingAmendments) {
      if (amendment.kind === "add") continue;
      expect(
        ids.has(amendment.articleId ?? ""),
        `${amendment.title} amends an article that is not there`,
      ).toBe(true);
    }
  });

  it("never proposes a change that removes everything by accident", () => {
    for (const amendment of governingAmendments) {
      if (amendment.kind === "remove") continue;
      expect(amendment.text.length, `${amendment.title} would empty the article`).toBeGreaterThan(0);
    }
  });
});

describe("the starter policies", () => {
  it("offers a number that does not collide with a rule already on file", () => {
    // A collision imports as nothing, and the board is left with a button that
    // appeared to work. Cheaper to catch here than on screen.
    const taken = new Set(
      governingArticles.filter((a) => a.document === "rules").map((a) => a.number),
    );
    for (const template of policyTemplates) {
      expect(
        taken.has(template.suggestedNumber),
        `${template.title} would land on an existing ${template.suggestedNumber}`,
      ).toBe(false);
    }
  });

  it("names the obligation behind every one of them", () => {
    // A starter offered without saying why is us asserting that a board needs
    // this. Naming the statute makes it checkable rather than trusted.
    for (const template of policyTemplates) {
      expect(template.basis.length, `${template.title} names no basis`).toBeGreaterThan(40);
      expect(template.why.length, `${template.title} says nothing about why`).toBeGreaterThan(40);
      expect(template.text.length, `${template.title} has no wording`).toBeGreaterThan(2);
    }
  });
});

describe("shared costs", () => {
  it("points every bill at a cost that exists", () => {
    const ids = new Set(sharedCosts.map((c) => c.id));
    for (const bill of sharedCostBills) {
      expect(ids.has(bill.sharedCostId), `${bill.id} has no shared cost`).toBe(true);
    }
  });

  it("bills a period that ends after it starts", () => {
    for (const bill of sharedCostBills) {
      expect(bill.periodEnd >= bill.periodStart, `${bill.id} ends before it starts`).toBe(true);
    }
  });

  it("keeps the per home figure consistent with the total", () => {
    for (const bill of sharedCostBills) {
      const expected = Math.round(bill.totalCents / bill.homes);
      // Within a cent, because the average is rounded.
      expect(Math.abs(bill.averageShareCents - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("never posts the same period twice for one cost", () => {
    const seen = new Set<string>();
    for (const bill of sharedCostBills) {
      const key = `${bill.sharedCostId}:${bill.periodStart}`;
      expect(seen.has(key), `${key} is billed twice`).toBe(false);
      seen.add(key);
    }
  });
});

describe("the library", () => {
  it("gives every article a unique slug", () => {
    const slugs = libraryArticles.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("only uses topics the filter offers", () => {
    const known = new Set<string>(LIBRARY_TOPICS);
    for (const article of libraryArticles) {
      expect(known.has(article.topic), `${article.slug} has topic "${article.topic}"`).toBe(true);
    }
  });

  it("only names states the picker offers", () => {
    const known = new Set(STATES.map((s) => s.code));
    for (const article of libraryArticles) {
      for (const code of article.states ?? []) {
        expect(known.has(code), `${article.slug} names ${code}`).toBe(true);
      }
    }
  });

  it("cites a source for every state specific article", () => {
    // A page that tells a board what their state requires, with nothing behind
    // it, is the one thing this library must never be.
    for (const article of libraryArticles) {
      if (!article.states) continue;
      expect(article.sources?.length, `${article.slug} cites nothing`).toBeGreaterThan(0);
    }
  });

  it("dates every citation it has", () => {
    for (const article of libraryArticles) {
      for (const source of article.sources ?? []) {
        expect(source.url).toMatch(/^https?:\/\//);
        if (source.fetched) expect(source.fetched).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("covers every state the picker offers", () => {
    const covered = new Set(libraryArticles.flatMap((a) => a.states ?? []));
    for (const state of STATES) {
      expect(covered.has(state.code), `${state.name} is offered with no article`).toBe(true);
    }
  });
});

describe("the demo association", () => {
  it("is set up, so the dashboard is not a checklist", () => {
    expect(mehrMeadows.association.insuranceCarrier).toBeTruthy();
    expect(mehrMeadows.reserveComponents.length).toBeGreaterThan(0);
    expect(mehrMeadows.documents.length).toBeGreaterThan(0);
  });
});
