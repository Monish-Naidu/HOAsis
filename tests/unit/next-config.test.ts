import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The redirects in next.config.ts, read as text.
 *
 * /admin is the owner's ops page. The redirect that keeps old /admin/...
 * deep links working was written with `:path*`, which also matches no
 * segments at all, so the bare page answered 308 to /board and was never
 * rendered. The file is read rather than imported because the config is
 * wrapped by Sentry's build plugin, which has no business loading in a unit
 * test.
 */
const source = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
const redirectSources = [...source.matchAll(/source:\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]);

describe("next.config redirects", () => {
  it("still sends old deep links under /admin to the board", () => {
    expect(redirectSources).toContain("/admin/:path+");
    expect(source).toContain('destination: "/board/:path+"');
  });

  it("never swallows the bare /admin page", () => {
    const underAdmin = redirectSources.filter((s) => s === "/admin" || s.startsWith("/admin/") || s.startsWith("/admin("));
    expect(underAdmin.length).toBeGreaterThan(0);
    for (const pattern of underAdmin) {
      // Zero-or-more and optional segments both match /admin itself.
      expect(pattern).not.toMatch(/\*$/);
      expect(pattern).not.toMatch(/\?$/);
      expect(pattern).not.toBe("/admin");
    }
  });
});
