import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/app/logo";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyUnsubscribe } from "@/lib/email/tokens";

export const metadata = { title: "Email preferences" };

const LABEL: Record<string, string> = {
  community: "community updates",
  newsletter: "the newsletter",
  message: "messages from the board",
  request: "updates on your requests",
  invite: "invitations",
};

/**
 * One click, no login.
 *
 * CAN-SPAM does not accept "sign in to unsubscribe", and neither would anyone
 * reasonable, so the link carries a signature proving whose preference it is.
 * Acting on GET is deliberate here: a person who clicked unsubscribe has
 * already made the request, and a confirmation button is one more chance for
 * it not to happen.
 *
 * Statutory notices never carry one of these links, and the check constraint
 * on the table means one could not be honored even if a link were forged.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; c?: string; t?: string }>;
}) {
  const { p: profileId, c: category, t: token } = await searchParams;

  const valid =
    profileId && category && token && verifyUnsubscribe(profileId, category, token);

  let done = false;
  let failure: string | null = null;

  if (valid) {
    const admin = supabaseAdmin();
    const { error } = await admin
      .from("email_optouts")
      .upsert({ profile_id: profileId, category }, { onConflict: "profile_id,category" });
    if (error) {
      // The check constraint refusing a statutory category is the interesting
      // case, and saying so is more useful than "something went wrong".
      failure = error.message.includes("statutory_cannot_be_declined")
        ? "That kind of notice is about your account, so it cannot be switched off."
        : "We could not record that. Try the link again in a moment.";
    } else {
      done = true;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/">
          <Wordmark size={32} />
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-5 pb-20">
        <div className="w-full max-w-md rounded-card border border-border bg-surface p-7">
          {done ? (
            <>
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-ok-soft text-ok">
                <Check className="size-5" strokeWidth={2.5} />
              </span>
              <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">
                You are unsubscribed
              </h1>
              <p className="mt-2 text-body leading-relaxed text-fg-muted">
                You will no longer receive {LABEL[category!] ?? "those emails"} from your
                association.
              </p>
              <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-footnote leading-snug text-fg-muted">
                <ShieldCheck className="mt-px size-4 shrink-0 text-fg-subtle" />
                Notices about your account, such as an assessment coming due or a balance
                past due, will still reach you. Your board is required to send those.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-title3 font-semibold tracking-[-0.02em] text-fg">
                {failure ? "That did not work" : "This link is not valid"}
              </h1>
              <p className="mt-2 text-body leading-relaxed text-fg-muted">
                {failure ??
                  "It may have been altered on the way here. Open the most recent email and use the link at the bottom of it."}
              </p>
            </>
          )}
          <Link
            href="/resident/account"
            className="mt-6 inline-flex h-10 items-center rounded-lg border border-border-2 px-4 text-body font-semibold text-fg hover:bg-surface-2"
          >
            Manage all email preferences
          </Link>
        </div>
      </main>
    </div>
  );
}
