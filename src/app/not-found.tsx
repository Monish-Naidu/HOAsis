import { Compass } from "lucide-react";
import { ButtonLink, Card, IconTile } from "@/components/ui/primitives";
import { Wordmark } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5">
        <Wordmark size={32} />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-20">
        <Card className="w-full max-w-md p-6">
          <IconTile icon={Compass} tint="blue" size="md" className="mb-4" />
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-fg">
            There is nothing here
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">
            The link may be old, or the record may belong to a different account.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ButtonLink href="/signin" variant="primary" size="lg">
              Back to sign in
            </ButtonLink>
            <ButtonLink href="/" variant="ghost" size="lg">
              Home
            </ButtonLink>
          </div>
        </Card>
      </main>
    </div>
  );
}
