import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/app/marketing-chrome";
import { Badge, Callout } from "@/components/ui/primitives";
import { articleBySlug, LIBRARY_REDIRECTS, libraryArticles, STATES } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return [
    ...libraryArticles.map((article) => ({ slug: article.slug })),
    ...Object.keys(LIBRARY_REDIRECTS).map((slug) => ({ slug })),
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articleBySlug(slug);
  return article
    ? { title: article.title, description: article.summary }
    : { title: "Not found" };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Four state articles were superseded by researched replacements. A board
  // that bookmarked one lands on the corrected page rather than a 404.
  const moved = LIBRARY_REDIRECTS[slug];
  if (moved) redirect(`/library/${moved}`);

  const article = articleBySlug(slug);
  if (!article) notFound();

  const related = libraryArticles
    .filter((other) => other.slug !== article.slug && other.topic === article.topic)
    .slice(0, 3);

  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
        <Link
          href="/library"
          className="inline-flex items-center gap-1.5 text-body font-medium text-fg-muted hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          Library
        </Link>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{article.topic}</Badge>
            {article.states?.map((code) => (
              <Badge key={code} tone="brand">
                {STATES.find((s) => s.code === code)?.name ?? code}
              </Badge>
            ))}
          </div>
          <h1 className="mt-3 text-[34px] font-semibold leading-[1.12] tracking-[-0.035em] text-fg sm:text-[40px]">
            {article.title}
          </h1>
          <p className="mt-3 text-headline leading-relaxed text-fg-muted">{article.summary}</p>
          <p className="mt-4 text-footnote text-fg-subtle">
            {formatDate(article.publishedDate, "long")} · {article.readMinutes} minute read
          </p>
        </header>

        <article className="mt-8">
          {article.body.split("\n\n").map((block, index) =>
            block.startsWith("## ") ? (
              <h2
                key={index}
                className="mt-8 text-title3 font-semibold tracking-[-0.02em] text-fg"
              >
                {block.replace("## ", "")}
              </h2>
            ) : (
              <p key={index} className="mt-4 text-headline leading-[1.75] text-fg-muted">
                {block}
              </p>
            ),
          )}
        </article>

        {article.states ? (
          <Callout tone="warn" className="mt-10" title="This one is state specific">
            Statutes change and the details turn on your own governing documents. Treat this as
            orientation, then confirm anything consequential with an attorney in your state.
          </Callout>
        ) : null}

        {article.sources?.length ? (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-headline font-semibold tracking-[-0.015em] text-fg">
              Where this comes from
            </h2>
            <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
              Every statute number, deadline and threshold above was read on the page linked
              here, on the date shown. Statutes change, so check the date before you rely on
              one.
            </p>
            <ol className="mt-4 space-y-2.5">
              {article.sources.map((source, index) => (
                <li key={source.url} className="flex gap-3">
                  <span className="tnum shrink-0 text-footnote font-semibold text-fg-subtle">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      // Inline, not inline-flex, and break-all: a long statute
                      // URL has no spaces to wrap at and ran off a 320px phone.
                      className="break-all text-body font-medium text-primary hover:underline"
                    >
                      {sourceLabel(source.url)}
                      <ExternalLink className="ml-1 inline size-3 align-[-1px]" />
                    </a>
                    {source.note ? (
                      <span className="block text-footnote leading-snug text-fg-muted">
                        {source.note}
                        {/* The year matters. A citation read date without one
                            cannot be compared against a statute's amendment
                            history, which is the only reason to print it. */}
                        {source.fetched ? ` · read ${formatDate(source.fetched, "long")}` : ""}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {related.length ? (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-footnote font-semibold text-fg-muted">
              More on {article.topic.toLowerCase()}
            </h2>
            <div className="mt-4 space-y-3">
              {related.map((other) => (
                <Link
                  key={other.slug}
                  href={`/library/${other.slug}`}
                  className="block rounded-card border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
                >
                  <p className="text-body font-medium text-fg">{other.title}</p>
                  <p className="mt-1 text-body text-fg-muted">{other.summary}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <MarketingFooter />
    </div>
  );
}

/**
 * A readable name for a citation.
 *
 * The full URL of a statute page is unreadable and the important part, which
 * host it came from, is buried in the middle of it. A reader scanning a
 * citation list wants to know whether it is the legislature or a law firm, and
 * the host answers that in one glance.
 */
function sourceLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^www\./, "");
    const tail = pathname.split("/").filter(Boolean).slice(-2).join("/");
    return tail ? `${host}/${tail}` : host;
  } catch {
    return url;
  }
}
