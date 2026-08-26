import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/app/marketing-chrome";
import { Badge, Callout } from "@/components/ui/primitives";
import { articleBySlug, libraryArticles, STATES } from "@/lib/data";
import { formatDate } from "@/lib/utils";

export function generateStaticParams() {
  return libraryArticles.map((article) => ({ slug: article.slug }));
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
          className="inline-flex items-center gap-1.5 text-[15px] font-medium text-fg-muted hover:text-fg"
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
          <p className="mt-3 text-[17px] leading-relaxed text-fg-muted">{article.summary}</p>
          <p className="mt-4 text-[13px] text-fg-subtle">
            {formatDate(article.publishedDate, "long")} · {article.readMinutes} minute read
          </p>
        </header>

        <article className="mt-8">
          {article.body.split("\n\n").map((block, index) =>
            block.startsWith("## ") ? (
              <h2
                key={index}
                className="mt-8 text-[20px] font-semibold tracking-[-0.02em] text-fg"
              >
                {block.replace("## ", "")}
              </h2>
            ) : (
              <p key={index} className="mt-4 text-[17px] leading-[1.75] text-fg-muted">
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

        {related.length ? (
          <section className="mt-12 border-t border-border pt-8">
            <h2 className="text-[13px] font-semibold text-fg-muted">
              More on {article.topic.toLowerCase()}
            </h2>
            <div className="mt-4 space-y-3">
              {related.map((other) => (
                <Link
                  key={other.slug}
                  href={`/library/${other.slug}`}
                  className="block rounded-card border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
                >
                  <p className="text-[15px] font-medium text-fg">{other.title}</p>
                  <p className="mt-1 text-[15px] text-fg-muted">{other.summary}</p>
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
