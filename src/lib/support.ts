/**
 * How to reach a person.
 *
 * One address, used everywhere the product says "write to us": the Help
 * item in the account menu, the error page, the Terms and Privacy pages,
 * the footer. A mailbox rather than a chat widget because a mailbox is
 * easier to keep honest at one person's scale, and a locked-out president
 * needs somewhere to write that does not need a session.
 *
 * Routing: support@yourhoasis.com is a Cloudflare Email Routing address on
 * the domain (see docs/customer-onboarding.md); it forwards to Monish.
 */
export const SUPPORT_EMAIL = "support@yourhoasis.com";

/** What we promise on the Terms page. Kept here so the page and the docs agree. */
export const SUPPORT_RESPONSE = "one business day, the same day when money moved wrong";

/** A mailto with the subject filled in, so the reply already knows what it is about. */
export function supportMailto(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString().replace(/\+/g, "%20");
  return `mailto:${SUPPORT_EMAIL}${query ? `?${query}` : ""}`;
}
