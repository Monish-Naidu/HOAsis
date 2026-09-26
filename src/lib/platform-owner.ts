/**
 * Who runs the service, as distinct from who runs an association.
 *
 * `PLATFORM_OWNER_EMAILS` is a comma separated list of sign-in addresses.
 * The ops page at /admin is for these people and answers 404 to everyone
 * else, so its existence is not advertised. Unset means nobody.
 */
export function platformOwnerEmails(source = process.env.PLATFORM_OWNER_EMAILS): string[] {
  return (source ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformOwner(email: string | null | undefined, source?: string): boolean {
  if (!email) return false;
  return platformOwnerEmails(source).includes(email.trim().toLowerCase());
}
