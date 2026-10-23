import { CommunityEntry } from "@/components/app/community-entry";

export const metadata = { title: "Opening your association" };

/**
 * /c/<slug> and /c/<slug>/<board or resident page>.
 *
 * The canonical link to an association. It chooses the association for a
 * signed in member and sends them on to the page named, sends a stranger to
 * sign in with the link kept, and sends a signed in non-member to join.
 * The pages themselves live where they always did, so nothing else moves.
 *
 * The query is part of the link: a bill email names the home it is for and
 * a message notice names the thread. It travels with the redirect, through
 * the sign-in and onto the page, so a remembered home or thread never
 * replaces the one the email was about.
 */
export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, rest } = await params;
  const query = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      search.append(key, v);
    }
  }
  const qs = search.toString();
  return (
    <CommunityEntry
      slug={slug}
      path={rest?.length ? `/${rest.join("/")}` : ""}
      search={qs ? `?${qs}` : ""}
    />
  );
}
