import { Compass } from "lucide-react";
import { ButtonLink, Card, IconTile } from "@/components/ui/primitives";
import { Wordmark } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5">
        <Wordmark size={32} />
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-5 pb-20">
        <Card className="w-full max-w-md p-6">
          <IconTile icon={Compass} tint="blue" size="md" className="mb-4" />
          <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">
            There is nothing here
          </h1>
          <p className="mt-1.5 text-body leading-relaxed text-fg-muted">
            That page does not exist, or it belongs to an association you are not signed in to.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/" variant="primary" size="lg">
              Home
            </ButtonLink>
            <ButtonLink href="/signin" variant="ghost" size="lg">
              Sign in
            </ButtonLink>
          </div>
        </Card>
      </main>
    </div>
  );
}
