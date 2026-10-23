import { describe, expect, it } from "vitest";
import { mailOrigin } from "@/lib/email/mail-origin";

/**
 * Where a token-bearing email link may point. The request's headers never
 * choose it: production names its site, and development keeps only the
 * loopback address the browser used.
 */

const local = (url: string, host: string | null = new URL(url).host) => ({
  nextUrl: new URL(url),
  host,
  siteHost: undefined,
  production: false,
});

describe("mailOrigin", () => {
  it("uses the configured site, over https, whatever the request says", () => {
    for (const host of ["evil.example", "localhost:3000", null]) {
      expect(
        mailOrigin({
          nextUrl: new URL("http://evil.example/api/auth/signup"),
          host,
          siteHost: "yourhoasis.com",
          production: true,
        }),
      ).toBe("https://yourhoasis.com");
    }
    expect(
      mailOrigin({
        nextUrl: new URL("http://localhost:3100/"),
        host: "localhost:3100",
        siteHost: " Staging.YourHOAsis.com ",
        production: false,
      }),
    ).toBe("https://staging.yourhoasis.com");
  });

  it("falls back to the loopback rule in development when the configured site is invalid", () => {
    expect(
      mailOrigin({
        nextUrl: new URL("http://127.0.0.1:3100/api/email/notify"),
        host: "127.0.0.1:3100",
        siteHost: "127.0.0.1:3100",
        production: false,
      }),
    ).toBe("http://127.0.0.1:3100");
    // A foreign request host is still refused, misconfiguration or not.
    expect(
      mailOrigin({
        nextUrl: new URL("http://evil.example/api/email/notify"),
        host: "evil.example",
        siteHost: "127.0.0.1:3100",
        production: false,
      }),
    ).toBeNull();
  });

  it("refuses a configured site that is not a plain public host name", () => {
    for (const siteHost of [
      "https://yourhoasis.com",
      "yourhoasis.com/path",
      "yourhoasis.com:8443",
      "user@yourhoasis.com",
      "evil.example#.yourhoasis.com",
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "yourhoasis",
      "your hoasis.com",
    ]) {
      expect(
        mailOrigin({
          nextUrl: new URL("https://yourhoasis.com/"),
          host: "yourhoasis.com",
          siteHost,
          production: true,
        }),
      ).toBeNull();
    }
  });

  it("sends nothing from a production build with no site configured", () => {
    expect(
      mailOrigin({
        nextUrl: new URL("https://yourhoasis.com/"),
        host: "yourhoasis.com",
        siteHost: "",
        production: true,
      }),
    ).toBeNull();
  });

  it("keeps the loopback address and port a development browser used", () => {
    expect(mailOrigin(local("http://localhost:3100/api/auth/signup"))).toBe(
      "http://localhost:3100",
    );
    // Next.js reports 127.0.0.1 as localhost; the Host header says which.
    expect(mailOrigin(local("http://localhost:3100/api/auth/signup", "127.0.0.1:3100"))).toBe(
      "http://127.0.0.1:3100",
    );
    expect(mailOrigin(local("http://localhost:3100/", "[::1]:3100"))).toBe("http://[::1]:3100");
  });

  it("never lets a development request name another host, port or protocol", () => {
    expect(mailOrigin(local("http://evil.example/api/auth/signup"))).toBeNull();
    expect(mailOrigin(local("http://localhost:3100/", "evil.example"))).toBe(
      "http://localhost:3100",
    );
    expect(mailOrigin(local("http://localhost:3100/", "127.0.0.1:4444"))).toBe(
      "http://localhost:3100",
    );
    expect(mailOrigin(local("https://localhost:3100/"))).toBe("http://localhost:3100");
    expect(mailOrigin(local("http://localhost.evil.example:3100/"))).toBeNull();
  });
});
