import { LibraryBrowser } from "./library-browser";
import { MarketingFooter, MarketingHeader } from "@/components/app/marketing-chrome";
import { libraryArticles } from "@/lib/data";

export const metadata = {
  title: "Library, free guidance for HOA boards",
  description:
    "How to run a meeting, read a budget, collect a late assessment, and what your state actually requires. Free, no account needed.",
};

export default function LibraryPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:py-16">
        <header className="mb-8">
          <h1 className="max-w-3xl text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[48px]">
            Everything we know about running an HOA, free.
          </h1>
          <p className="mt-4 max-w-2xl text-headline leading-relaxed text-fg-muted">
            No account, no email gate. Most of this applies wherever you are. The state specific
            pieces are marked, because that is the part boards most often get wrong and least
            often find written down.
          </p>
        </header>
        <LibraryBrowser articles={libraryArticles} />
      </main>
      <MarketingFooter />
    </div>
  );
}
