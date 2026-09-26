import { CommunityEntry } from "@/components/app/community-entry";

export const metadata = { title: "Opening your association" };

/**
 * /c/<slug> and /c/<slug>/<board or resident page>.
 *
 * The canonical link to an association. It chooses the association for a
 * signed in member and sends them on to the page named, sends a stranger to
 * sign in with the link kept, and sends a signed in non-member to join.
 * The pages themselves live where they always did, so nothing else moves.
 */
export default async function CommunityPage({
  params,
}: {
  params: Promise<{ slug: string; rest?: string[] }>;
}) {
  const { slug, rest } = await params;
  return <CommunityEntry slug={slug} path={rest?.length ? `/${rest.join("/")}` : ""} />;
}
