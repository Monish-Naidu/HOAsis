import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, HeartHandshake, ShieldCheck } from "lucide-react";
import { MarketingFooter, MarketingHeader, Reveal } from "@/components/app/marketing-chrome";
import { Card } from "@/components/ui/primitives";

export const metadata = {
  title: "About",
  description: "Why HOAsis exists, what we believe about running an association, and who it is for.",
};

/**
 * The founders.
 *
 * Placeholder copy, written to be replaced. Swap `bio` freely; the layout does
 * not care how long it runs. A founder without a `photo` falls back to their
 * initials, so adding the second headshot later is a one line change.
 */
const FOUNDERS = [
  {
    name: "Arya Mehr",
    role: "Co-founder",
    focus: "Property management and carpentry",
    photo: "/marketing/founder-arya.jpg",
    bio: "A handsome gentleman who is genuinely good with his hands, and can fix a home from the studs up. His wife Nina makes him a better man.",
  },
  {
    name: "Monish Naidu",
    role: "Co-founder",
    focus: "Product and engineering",
    photo: "/marketing/founder-monish.jpg",
    bio: "Product manager, former software engineer, failed pharmacist. Learning to chop wood under Arya's mentorship, and measurably less dangerous with an axe than last spring.",
  },
];

const BELIEFS = [
  {
    icon: ShieldCheck,
    title: "No one person should move money alone",
    body: "The scandal that ends self-management is almost never a bad decision. It is one person with sole control of the account. Dual approval is the default here, and the treasurer is not an exception to it.",
  },
  {
    icon: Building2,
    title: "A number you cannot stand behind is worse than no number",
    body: "Transactions that need a human decision are held out of every report until they get one. A dashboard that quietly averages in an uncertain figure is lying politely.",
  },
  {
    icon: HeartHandshake,
    title: "The next board inherits whatever you leave",
    body: "Volunteers turn over every January. Requests, decisions, and the reasons behind them stay on the record, because otherwise the only institutional memory is whoever happens to still live there.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <MarketingHeader />
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
        <Reveal>
          <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-fg sm:text-[44px]">
            Built for the person who did not want the job.
          </h1>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-6 space-y-4 text-[15px] leading-[1.75] text-fg-muted">
            <p>
              Roughly two in five American community associations manage themselves. That work
              falls to volunteers who did not run for office so much as fail to leave the room
              fast enough, and who are now personally responsible for a few hundred thousand
              dollars of other people&apos;s money.
            </p>
            <p>
              The software built for them mostly assumes a professional manager sits in the
              middle. It expects someone who knows what accrual accounting is, who has run an
              election before, and who reads statutes for a living. Volunteers have none of that
              and the same liability.
            </p>
            <p>
              HOAsis is the other assumption. It assumes the person using it is competent,
              busy, unpaid, and slightly afraid of getting something wrong. So it shows its work,
              refuses to guess on their behalf, and names the deadline before it passes.
            </p>
          </div>
        </Reveal>

        <section className="mt-12">
          <Reveal>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
              What we believe
            </h2>
          </Reveal>
          <div className="mt-4 space-y-4">
            {BELIEFS.map(({ icon: Icon, title, body }, index) => (
              <Reveal key={title} delay={index * 80}>
                <Card className="p-5">
                  <span className="mb-3 inline-flex size-9 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-fg">
                    <Icon className="size-4" strokeWidth={1.9} />
                  </span>
                  <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-fg">{title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-fg-muted">{body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <Reveal>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
              Who we are
            </h2>
            <p className="mt-3 text-[15px] leading-[1.75] text-fg-muted">
              Two people who between them cover the whole job: one who knows what actually breaks
              in a community, and one who knows why the books never quite tie out.
            </p>
          </Reveal>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FOUNDERS.map((founder, index) => (
              <Reveal key={founder.name} delay={index * 90}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-3">
                    {founder.photo ? (
                      <Image
                        src={founder.photo}
                        alt={`${founder.name}, ${founder.role}`}
                        fill
                        sizes="(max-width: 640px) 100vw, 320px"
                        className="object-cover object-top"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-navy-900 text-[48px] font-semibold tracking-[-0.03em] text-navy-50 dark:bg-navy-800">
                        {founder.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-fg">
                      {founder.name}
                    </h3>
                    <p className="mt-0.5 text-[12px] font-medium text-fg-muted">{founder.role}</p>
                    <p className="mt-0.5 text-[12px] text-fg-subtle">{founder.focus}</p>
                    <p className="mt-3 text-[14px] leading-relaxed text-fg-muted">{founder.bio}</p>
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <Reveal>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-fg-subtle">
              Who it is for
            </h2>
            <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-fg-muted">
              <p>
                Self-managed associations, roughly 20 to 400 homes, where a handful of neighbours
                run the whole thing. Single family, townhome, or condo. If you have a professional
                manager and are happy, we are not trying to change your mind.
              </p>
              <p>
                The library is free and always will be, for any board, whether or not they ever
                use the product. Most of what goes wrong in an association goes wrong because
                nobody told the volunteers what was expected of them.
              </p>
            </div>
          </Reveal>
        </section>

        <Reveal delay={120}>
          <div className="mt-12 rounded-card border border-border bg-surface p-6">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-fg">
              Have a look around
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-fg-muted">
              The demo is a fictional 88 home association in Brier, Washington, with a full set of
              books, a live meeting, an open ballot, and a reserve plan that does not quite work.
              Sign in as anyone.
            </p>
            <Link
              href="/signin"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-semibold text-brand-fg"
            >
              Open the demo
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </Reveal>
      </main>
      <MarketingFooter />
    </div>
  );
}
