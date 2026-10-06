import { placeLabel } from "@/lib/wording";
import { money } from "@/lib/utils";
/**
 * The emails themselves.
 *
 * Two rules run through all of them.
 *
 * The money is the subject line. An owner scanning a phone should know what
 * they owe and by when without opening anything, because the open rate on a
 * dues notice is not the metric that matters; the payment rate is.
 *
 * And there is exactly one link. Every extra choice between the notice and the
 * payment screen loses somebody, so "Pay $285.00" is the only thing to click,
 * and it lands on the payment screen already signed in rather than on a login
 * form that asks for a password nobody remembers.
 */

export interface DuesEmailInput {
  associationName: string;
  ownerName: string;
  unitLabel: string;
  balanceCents: number;
  dueDate: string;
  /** A magic link that signs them in and lands on the payment screen. */
  payUrl: string;
  /** Null for statutory notices, which carry no opt out. */
  unsubscribeUrl: string | null;
  /** Days past due, when this is a reminder rather than a first notice. */
  daysPastDue?: number;
  /**
   * True only when the association has set a contact address, which is what a
   * reply goes to. Without one a reply lands nowhere, so the email must not
   * invite it. Left out means false.
   */
  canReply?: boolean;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The shell every message shares.
 *
 * Table based and inline styled, because a decade of email clients still do
 * not agree on flexbox, and a layout that collapses in Outlook is a notice
 * that did not arrive.
 *
 * The association's name, the preheader and the button label are escaped
 * here, once, so no template has to remember: all three carry words a board
 * or an owner typed. Callers pass them as plain text, never pre-escaped.
 * `body` and `footer` are HTML the template built, with its own escaping.
 *
 * The line under the button, "This link signs you in", is only printed when
 * it is true. It went out on every message, including the one that confirms
 * a password somebody had just chosen and the invitation that asks them to
 * choose one. A template whose link is a plain address passes
 * `signsIn: false`.
 */
function layout(options: {
  associationName: string;
  preheader: string;
  body: string;
  cta: { label: string; url: string };
  footer: string;
  /** False when the link does not sign the person in. Defaults to true. */
  signsIn?: boolean;
}): string {
  const signsIn =
    options.signsIn === false
      ? ""
      : `
      <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7789;">
        This link signs you in, so there is no password to remember.
      </p>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e2e6ec;overflow:hidden;">
    <tr><td style="padding:24px 28px 0;">
      <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6b7789;">
        ${escapeHtml(options.associationName)}
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 8px;">${options.body}</td></tr>
    <tr><td style="padding:8px 28px 28px;">
      <a href="${options.cta.url}"
         style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;
                padding:14px 28px;border-radius:10px;font-size:16px;font-weight:600;">
        ${escapeHtml(options.cta.label)}
      </a>${signsIn}
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #eef1f5;">
      <p style="margin:0;font-size:11px;line-height:1.6;color:#8a94a3;">${options.footer}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/** A notice that an assessment is coming due. */
export function assessmentDueEmail(input: DuesEmailInput) {
  const amount = money(input.balanceCents);
  const subject = `${amount} due ${longDate(input.dueDate)} · ${input.associationName}`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">
      ${amount} is due ${longDate(input.dueDate)}
    </h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      ${escapeHtml(input.ownerName)}, this is your assessment for unit ${escapeHtml(input.unitLabel)}.
    </p>`;

  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: `${amount} due ${longDate(input.dueDate)} for unit ${input.unitLabel}.`,
      body,
      cta: { label: `Pay ${amount}`, url: input.payUrl },
      footer: footerFor(input),
    }),
    text: `${input.ownerName},\n\n${amount} is due ${longDate(input.dueDate)} for unit ${input.unitLabel}.\n\nPay: ${input.payUrl}\n\n${input.associationName}`,
  };
}

/** A reminder that an account is past due. Firmer, still not a threat. */
export function pastDueEmail(input: DuesEmailInput) {
  const amount = money(input.balanceCents);
  const days = input.daysPastDue ?? 0;
  const subject = `${amount} past due · unit ${input.unitLabel} · ${input.associationName}`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">
      ${amount} is past due
    </h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      ${escapeHtml(input.ownerName)}, unit ${escapeHtml(input.unitLabel)} carries a balance of ${amount}${
        days > 0 ? `, now ${days} ${days === 1 ? "day" : "days"} past due` : ""
      }.
    </p>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      ${
        input.canReply
          ? "If you have already paid, or if something is wrong with this figure, reply to this email and the board will look into it."
          : "If you have already paid, or if something is wrong with this figure, write to the board from Messages in the app."
      }
    </p>`;

  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: `${amount} past due on unit ${input.unitLabel}.`,
      body,
      cta: { label: `Pay ${amount}`, url: input.payUrl },
      footer: footerFor(input),
    }),
    text: `${input.ownerName},\n\n${placeLabel(input.unitLabel)} carries a balance of ${amount}${
      days > 0 ? `, ${days} days past due` : ""
    }.\n\nPay: ${input.payUrl}\n\n${
      input.canReply
        ? "If you have already paid, reply and the board will look into it."
        : "If you have already paid, write to the board from Messages in the app."
    }\n\n${input.associationName}`,
  };
}

/**
 * The footer.
 *
 * A statutory notice says plainly why there is no unsubscribe link, rather
 * than leaving somebody to conclude we ignored one.
 */
function footerFor(input: DuesEmailInput): string {
  const sender = `Sent by ${escapeHtml(input.associationName)} through Your HOAsis.`;
  if (!input.unsubscribeUrl) {
    return `${sender} This is a notice about your account, so it is sent to every owner and cannot be turned off. You can still turn off community updates and newsletters in your account settings.`;
  }
  return `${sender} <a href="${input.unsubscribeUrl}" style="color:#8a94a3;">Unsubscribe from these</a>.`;
}

/* -------------------------------------------------------------------------- */
/* Trial                                                                       */
/* -------------------------------------------------------------------------- */

export interface TrialEmailInput {
  associationName: string;
  presidentName: string;
  /** The day the free period ends, `YYYY-MM-DD`. */
  trialEndsOn: string;
  homes: number;
  /** The software bill, monthly, in cents. */
  monthlyCents: number;
  /** Lands on Settings, where the card is added. */
  billingUrl: string;
}

/**
 * The three trial notices: two weeks out, three days out, and the day it
 * ends. Same shape as the dues notices on purpose. The subject carries the
 * date, the body says the price in one line, and there is one link.
 */
export function trialEmail(kind: "14-days" | "3-days" | "ended", input: TrialEmailInput) {
  const price = `${money(input.monthlyCents)} a month for ${input.homes} ${
    input.homes === 1 ? "home" : "homes"
  }`;
  const ends = longDate(input.trialEndsOn);

  const heading =
    kind === "ended"
      ? `Your free 90 days ended ${ends}`
      : kind === "3-days"
        ? `Your free 90 days end ${ends}`
        : `Two weeks left on your free 90 days`;

  const subject =
    kind === "ended"
      ? `Free period ended · ${input.associationName}`
      : `Free period ends ${ends} · ${input.associationName}`;

  const detail =
    kind === "ended"
      ? `Nothing is lost and residents can still pay. The board's screens stay open for two more weeks; after that they wait behind the billing page until a card is added.`
      : `Add a card any time before then and nothing changes on the day. Without one, the board's screens stay open for two weeks after and then wait behind the billing page.`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">
      ${heading}
    </h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      ${escapeHtml(input.presidentName)}, ${escapeHtml(input.associationName)} is on Your HOAsis at ${price}. ${detail}
    </p>`;

  const footer = `Sent to the President of ${escapeHtml(input.associationName)} by Your HOAsis. This is about the association's subscription, so it goes to whoever runs the board and cannot be turned off.`;

  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: `${price}, after ${ends}.`,
      body,
      cta: { label: "Add a card", url: input.billingUrl },
      footer,
      // A plain address on Settings. The President signs in as usual.
      signsIn: false,
    }),
    text: `${input.presidentName},\n\n${heading}. ${input.associationName} is on Your HOAsis at ${price}. ${detail}\n\nAdd a card: ${input.billingUrl}\n\nYour HOAsis`,
  };
}

/* -------------------------------------------------------------------------- */
/* Account                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The confirmation link, sent by us rather than by Supabase's own mailer.
 *
 * Supabase's built in sender is capped and not for production, and the first
 * real founder to hit that cap saw "Error sending confirmation email" on the
 * very first screen. So the account is created through the admin API and the
 * link goes out on the same route as every other message we send.
 */
export function confirmSignupEmail(input: { name: string; confirmUrl: string }) {
  const first = input.name.trim().split(/\s+/)[0] || "there";
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">
      Confirm your email
    </h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      Hi ${escapeHtml(first)}. One tap below confirms this address and finishes creating your
      account. Anything you entered during setup is waiting for you.
    </p>`;
  return {
    subject: "Confirm your email for Your HOAsis",
    html: layout({
      associationName: "Your HOAsis",
      preheader: "One tap confirms your email and finishes your account.",
      body,
      cta: { label: "Confirm my email", url: input.confirmUrl },
      footer:
        "If you did not create an account with Your HOAsis, ignore this message and nothing happens. " +
        "The link expires in 24 hours.",
      // They chose a password a minute ago. Telling them there is none to
      // remember is wrong.
      signsIn: false,
    }),
    text: `Hi ${first}. Confirm your email for Your HOAsis by opening this link: ${input.confirmUrl}\n\nIf you did not create an account, ignore this message.`,
  };
}

/**
 * The invitation, and the note that says the board let somebody in.
 *
 * One template, two moments. "invite": the board put the household on the
 * register and this is the door. "welcome": the person asked with a code,
 * the board said yes, and the account they already made now opens on their
 * home. Somebody who already has an account gets a link that signs them in;
 * everybody else gets the join page with their address filled in.
 */
export function inviteEmail(input: {
  kind: "invite" | "welcome";
  associationName: string;
  /** "Bothell, WA". Names repeat; the town says which one this is. */
  associationPlace?: string;
  ownerName: string;
  unitLabel: string;
  url: string;
  hasAccount: boolean;
}) {
  const first = input.ownerName.trim().split(/\s+/)[0] || "Neighbor";
  const home = input.unitLabel ? ` at ${escapeHtml(input.unitLabel)}` : "";
  const named = escapeHtml(input.associationName) + (input.associationPlace ? ` in ${escapeHtml(input.associationPlace)}` : "");
  const welcome = input.kind === "welcome";
  const subject = welcome
    ? `You're in: ${input.associationName}`
    : `Your home${input.unitLabel ? ` at ${input.unitLabel}` : ""} is ready on Your HOAsis`;
  const heading = welcome ? `The board let you in` : `${escapeHtml(input.associationName)} is on Your HOAsis`;
  const line = welcome
    ? `Hi ${escapeHtml(first)}. The board of ${named} confirmed your home${home}. Your dues, documents and requests are ready.`
    : `Hi ${escapeHtml(first)}. Your board added your home${home} to ${named}. ${
        input.hasAccount
          ? "Your account already exists, so one tap opens it."
          : "Create your account with this email address and your home opens on its own."
      }`;
  const cta = input.hasAccount ? "Open my account" : "Create my account";
  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">
      ${heading}
    </h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">${line}</p>`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: welcome
        ? `Your home${input.unitLabel ? ` at ${input.unitLabel}` : ""} is confirmed.`
        : `Create your account and your home opens on its own.`,
      body,
      cta: { label: cta, url: input.url },
      footer:
        "Sent by your association's board through Your HOAsis. If you do not know this " +
        "association, ignore this message and nothing happens.",
      // Without an account the link is the join page, where a password is chosen.
      signsIn: input.hasAccount,
    }),
    text: `${line.replace(/<[^>]+>/g, "")}\n\n${cta}: ${input.url}\n\n${input.associationName}`,
  };
}

/**
 * Makes typed words safe to sit in HTML, as text or inside a double-quoted
 * attribute. Subjects and the plain text part are not HTML and never go
 * through this, or "&amp;" shows up in an inbox.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* -------------------------------------------------------------------------- */
/* Autopay                                                                     */
/* -------------------------------------------------------------------------- */

export interface AutopayEmailInput {
  associationName: string;
  ownerName: string;
  amountCents: number;
  /** "BECU checking ••1234". */
  method: string;
  /** Why it did not go through, in Stripe's words, for the failed kind. */
  problem?: string;
  /** Lands on the pay screen, signed in. */
  payUrl: string;
}

/**
 * The two autopay notices. A charge that went out is a receipt: the amount is
 * the subject, and the one link is the account. A charge that failed is the
 * same shape with the problem in one line, because the owner's next move is
 * to pay by hand, and the link takes them there.
 */
export function autopayEmail(kind: "charged" | "failed", input: AutopayEmailInput) {
  const amount = money(input.amountCents);
  const heading =
    kind === "charged"
      ? `Autopay sent ${amount} to ${input.associationName}`
      : `Autopay could not send ${amount}`;
  const subject =
    kind === "charged"
      ? `${amount} paid by autopay · ${input.associationName}`
      : `Autopay failed for ${amount} · ${input.associationName}`;
  const detail =
    kind === "charged"
      ? `It came from ${input.method} and applies to your oldest charge first. A bank payment takes a few business days to clear; a card is same day.`
      : `${input.method} was declined${input.problem ? `: ${input.problem}` : ""}. Nothing was taken. Autopay will try again next month; until then the balance is yours to pay by hand.`;

  const body = `
    <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">
      ${escapeHtml(heading)}
    </h1>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      ${escapeHtml(input.ownerName)}, ${escapeHtml(detail)}
    </p>`;

  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: kind === "charged" ? `${amount} from ${input.method}.` : `Nothing was taken.`,
      body,
      cta:
        kind === "charged"
          ? { label: "View account", url: input.payUrl }
          : { label: `Pay ${amount}`, url: input.payUrl },
      footer: `Sent by ${escapeHtml(input.associationName)} through Your HOAsis because autopay is on for your home. Turn it off any time on the pay screen.`,
      // A plain address on the pay screen, not a sign-in link.
      signsIn: false,
    }),
    text: `${input.ownerName},\n\n${heading}. ${detail}\n\n${input.payUrl}\n\nYour HOAsis`,
  };
}

/* -------------------------------------------------------------------------- */
/* Disputes                                                                    */
/* -------------------------------------------------------------------------- */

export interface DisputeEmailInput {
  associationName: string;
  /** Whoever holds finances. The greeting uses the first name. */
  recipientName: string;
  /** The home the disputed payment was for, as the roster labels it. Empty if unknown. */
  unitLabel: string;
  amountCents: number;
  /** The bank's reason in Stripe's vocabulary, such as "fraudulent". */
  reason?: string | null;
  /** The last day evidence can be sent, `YYYY-MM-DD`. Only for an opened dispute. */
  evidenceDueOn?: string | null;
  /** The dispute on the association's own Stripe dashboard. */
  disputeUrl: string;
}

/**
 * A payment was disputed with the owner's bank, or the bank has decided.
 *
 * It goes to the people who hold finances, the day it happens. A dispute has
 * a deadline for evidence, and one nobody answers is one the association
 * loses. The amount is the subject, the deadline is in the first paragraph,
 * and the one link is the dispute on the association's own Stripe dashboard,
 * which is where it is answered.
 *
 * "lost" says what the books here do not yet do on their own: the money has
 * left Stripe, and the owner's statement and the ledger still show it.
 */
export function disputeEmail(kind: "opened" | "won" | "lost", input: DisputeEmailInput) {
  const amount = money(input.amountCents);
  const first = firstName(input.recipientName);
  const home = input.unitLabel ? placeLabel(input.unitLabel) : "";
  const reason = input.reason ? input.reason.replace(/_/g, " ") : "";

  const subject =
    kind === "opened"
      ? `Payment disputed: ${amount}${home ? ` · ${home}` : ""} · ${input.associationName}`
      : `Dispute ${kind}: ${amount}${home ? ` · ${home}` : ""} · ${input.associationName}`;
  const title =
    kind === "opened"
      ? `A ${amount} payment was disputed`
      : kind === "won"
        ? `The ${amount} dispute was decided for the association`
        : `The ${amount} dispute was lost`;

  const forHome = home ? ` for ${home}` : "";
  const lines =
    kind === "opened"
      ? [
          `${first}, the bank behind a ${amount} payment${forHome} has disputed it${
            reason ? `. The reason given: ${reason}` : ""
          }.`,
          `Stripe holds the disputed amount, and usually a dispute fee, out of the association's balance while the bank decides. ${
            input.evidenceDueOn
              ? `Send your evidence by ${longDate(input.evidenceDueOn)}. With no answer by then, the bank decides for the cardholder.`
              : "Send your evidence as soon as you can. With no answer, the bank decides for the cardholder."
          }`,
          `The owner's statement has not changed. The payment still shows as paid until the bank decides.`,
        ]
      : kind === "won"
        ? [
            `${first}, the bank decided the disputed ${amount} payment${forHome} for the association. Stripe returns the money to the association's balance.`,
            `Nothing changes on the owner's statement.`,
          ]
        : [
            `${first}, the bank decided the disputed ${amount} payment${forHome} for the cardholder. The ${amount} and Stripe's dispute fee stay out of the association's balance.`,
            `The payment has been taken off the books here: the owner's statement shows the ${amount} as owed again and the deposit has been reversed in the ledger.`,
          ];

  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader:
        kind === "opened" && input.evidenceDueOn
          ? `Evidence is due ${longDate(input.evidenceDueOn)}.`
          : title,
      body: `${heading(title)}${paragraphs(lines.join("\n\n"))}`,
      cta: { label: kind === "opened" ? "Answer on Stripe" : "See it on Stripe", url: input.disputeUrl },
      footer: `Sent to the people who hold finances for ${escapeHtml(input.associationName)} by Your HOAsis. This is about money in the association's account, so it cannot be turned off.`,
      // Stripe's dashboard has its own sign in.
      signsIn: false,
    }),
    text: `${title}\n\n${lines.join("\n\n")}\n\n${input.disputeUrl}\n\nYour HOAsis`,
  };
}

export interface PaymentsPausedEmailInput {
  associationName: string;
  recipientName: string;
  /** What Stripe is waiting for, as plain sentences. May be empty. */
  needs: string[];
  /** The board's payments settings, where the Stripe forms are opened. */
  settingsUrl: string;
}

/**
 * Stripe has stopped the association from taking payments.
 *
 * It goes to the people who hold finances the day it happens. Until now the
 * only sign was an owner writing in to say Pay had gone, or autopay failing
 * and blaming the owner's card. What Stripe wants is usually a form or a
 * document, and it is the treasurer who has it.
 */
export function paymentsPausedEmail(input: PaymentsPausedEmailInput) {
  const first = firstName(input.recipientName);
  const title = "Online payments are paused";
  const lines = [
    `${first}, Stripe has paused online payments for ${input.associationName}. Owners cannot pay online and autopay is waiting, so nobody is charged a failed payment in the meantime.`,
    input.needs.length
      ? `Stripe is waiting for:\n${input.needs.map((n) => `• ${n}`).join("\n")}`
      : `Stripe has not asked for anything more, which usually means it is checking what it already has. That can take a day or two.`,
    `Payments come back on by themselves once Stripe is satisfied. Checks and cash can still be recorded by hand.`,
  ];
  return {
    subject: `Online payments are paused · ${input.associationName}`,
    html: layout({
      associationName: input.associationName,
      preheader: input.needs[0] ?? "Stripe is checking the association's account.",
      body: `${heading(title)}${paragraphs(lines.join("\n\n"))}`,
      cta: { label: "Open payments settings", url: input.settingsUrl },
      footer: `Sent to the people who hold finances for ${escapeHtml(input.associationName)} by Your HOAsis. This is about money in the association's account, so it cannot be turned off.`,
      // A plain link to the board's own settings; whoever opens it signs in as usual.
      signsIn: false,
    }),
    text: `${title}\n\n${lines.join("\n\n")}\n\n${input.settingsUrl}\n\nYour HOAsis`,
  };
}

/* -------------------------------------------------------------------------- */
/* Notices from the board                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The shape every board notice shares: who it is from, the one link, and
 * whether the footer offers a way out. Statutory notices pass null for the
 * unsubscribe link and the footer says why there is none.
 */
export interface NoticeEmailInput {
  associationName: string;
  ownerName: string;
  /** Signs the person in and lands on the screen the notice is about. */
  url: string;
  /** Null for statutory notices, and for a person with no account to hold a preference. */
  unsubscribeUrl: string | null;
  /**
   * False when the board only has an address for this person. Their link is
   * the join page, which signs nobody in, and they have no account settings
   * yet, so the footer says how to get some. Defaults to true.
   */
  hasAccount?: boolean;
}

/** Plain text as the board typed it, made safe for HTML and split on blank lines. */
function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#3d4a5e;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#0f1a2b;font-weight:600;">${escapeHtml(text)}</h1>`;
}

/**
 * The footer of a board notice. `why` is the statutory reason, and only a
 * notice with one may say it cannot be turned off. An announcement to an
 * owner with no account used to say exactly that, with no reason and no way
 * out, about a message the privacy page calls optional. That owner has no
 * preferences to change until there is an account, so the footer says why
 * the message came and where the choice lives.
 */
function noticeFooter(input: NoticeEmailInput, why: string): string {
  const sender = `Sent by ${escapeHtml(input.associationName)} through Your HOAsis.`;
  if (input.unsubscribeUrl) {
    return `${sender} <a href="${input.unsubscribeUrl}" style="color:#8a94a3;">Unsubscribe from these</a>.`;
  }
  if (why) {
    return `${sender} ${why} It is sent to every owner and cannot be turned off.`;
  }
  return `${sender} You are getting this because the board has this address on file for your home. Create your account to choose which emails you get.`;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "Neighbor";
}

/** An announcement the board posted. Optional: an owner may turn these off. */
export function announcementEmail(input: NoticeEmailInput & { title: string; body: string }) {
  const subject = `${input.title} · ${input.associationName}`;
  const body = `${heading(input.title)}${paragraphs(input.body)}`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: input.body.split("\n")[0].slice(0, 120),
      body,
      cta: { label: "Open Your HOAsis", url: input.url },
      signsIn: input.hasAccount !== false,
      footer: noticeFooter(input, ""),
    }),
    text: `${input.title}\n\n${input.body}\n\n${input.url}\n\n${input.associationName}${
      input.unsubscribeUrl ? `\n\nUnsubscribe: ${input.unsubscribeUrl}` : ""
    }`,
  };
}

/** Notice of a meeting. Statutory: the date is the subject, the agenda is the body. */
export function meetingNoticeEmail(
  input: NoticeEmailInput & {
    title: string;
    date: string;
    time: string;
    location: string;
    dialIn?: string;
    passcode?: string;
    /** The Jitsi link everyone joins by, from `lib/meetings/video.ts`. */
    videoUrl?: string;
    agenda: string[];
  },
) {
  const when = `${longDate(input.date)} at ${input.time}`;
  const subject = `Notice of meeting: ${input.title}, ${when} · ${input.associationName}`;
  const phone = input.dialIn
    ? `dial ${input.dialIn}${input.passcode ? ` (passcode ${input.passcode})` : ""}`
    : "";
  const lines = [
    `${input.title} is on ${when}, ${input.location}.`,
    input.videoUrl
      ? `Join by video: ${input.videoUrl}${phone ? `, or ${phone}` : ""}.`
      : phone
        ? `Join by phone: ${phone}.`
        : "",
  ].filter(Boolean);
  const agenda = input.agenda.length
    ? `<p style="margin:12px 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7789;">Agenda</p><ol style="margin:0 0 10px;padding-left:20px;font-size:15px;line-height:1.6;color:#3d4a5e;">${input.agenda
        .map((a) => `<li>${escapeHtml(a)}</li>`)
        .join("")}</ol>`
    : "";
  const body = `${heading(`${input.title}, ${when}`)}${paragraphs(lines.join("\n\n"))}${agenda}`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: `${when}, ${input.location}.`,
      body,
      cta: { label: "See the meeting", url: input.url },
      signsIn: input.hasAccount !== false,
      footer: noticeFooter(input, "This is notice of a meeting of the association."),
    }),
    text: `${input.title}, ${when}\n\n${lines.join("\n")}${
      input.agenda.length ? `\n\nAgenda:\n${input.agenda.map((a, i) => `${i + 1}. ${a}`).join("\n")}` : ""
    }\n\n${input.url}\n\n${input.associationName}`,
  };
}

/** A vote is open. Statutory: the closing date is in the subject. */
export function ballotOpenEmail(
  input: NoticeEmailInput & { title: string; body: string[]; closesDate: string },
) {
  const closes = longDate(input.closesDate);
  const subject = `Vote by ${closes}: ${input.title} · ${input.associationName}`;
  const body = `${heading(input.title)}${paragraphs(
    [`Voting is open until ${closes}. One vote per home.`, ...input.body].join("\n\n"),
  )}`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: `Voting is open until ${closes}.`,
      body,
      cta: { label: "Cast my vote", url: input.url },
      signsIn: input.hasAccount !== false,
      footer: noticeFooter(input, "This is notice of a vote of the association."),
    }),
    text: `${input.title}\n\nVoting is open until ${closes}. One vote per home.\n\n${input.body.join(
      "\n\n",
    )}\n\nVote: ${input.url}\n\n${input.associationName}`,
  };
}

/**
 * A message from the board to one household: a reply on a thread, a note
 * from the roster, or a dues letter written in the product. The subject is
 * the board's own; the body goes out as typed. A dues letter is statutory
 * and says so; anything else may be turned off.
 */
export function boardMessageEmail(
  input: NoticeEmailInput & {
    subject: string;
    body: string;
    senderName: string;
    /** "Treasurer", when the sender holds an office. Signs as "Name, Treasurer, for the board". */
    senderOffice?: string;
    statutory: boolean;
  },
) {
  const subject = `${input.subject} · ${input.associationName}`;
  const signature = input.senderOffice
    ? `${input.senderName}, ${input.senderOffice}, for the board`
    : `${input.senderName}, for the board`;
  const body = `${heading(input.subject)}${paragraphs(input.body)}<p style="margin:6px 0 0;font-size:15px;line-height:1.6;color:#3d4a5e;">${escapeHtml(
    signature,
  )}</p>`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: input.body.split("\n")[0].slice(0, 120),
      body,
      cta: { label: input.statutory ? "See my account" : "Reply", url: input.url },
      signsIn: input.hasAccount !== false,
      footer: noticeFooter(
        input,
        input.statutory ? "This is a notice about your account." : "",
      ),
    }),
    text: `${input.subject}\n\n${input.body}\n\n${signature}\n\n${input.url}\n\n${input.associationName}${
      input.unsubscribeUrl ? `\n\nUnsubscribe: ${input.unsubscribeUrl}` : ""
    }`,
  };
}

/**
 * An owner wrote to the board, and this goes to the officer it was addressed
 * to (or to the communications holders when it was addressed to the board, or
 * nobody holds the office). The link opens the thread in Messages; it does
 * not sign anybody in, because an officer has an account already. Replying to
 * this email reaches the association's contact address, so the button is how
 * to answer the owner.
 */
export function officeMessageEmail(input: {
  associationName: string;
  recipientName: string;
  /** "Treasurer" or "the board". */
  addressedTo: string;
  fromName: string;
  /** Home label as the board reads it, or empty. */
  home: string;
  subject: string;
  body: string;
  url: string;
}) {
  const first = firstName(input.recipientName);
  const who = input.home ? `${input.fromName}, ${input.home}` : input.fromName;
  const subject = `New message for ${input.addressedTo}: ${input.subject} · ${input.associationName}`;
  const intro = `${first}, ${who} wrote to ${input.addressedTo}.`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: input.body.split("\n")[0].slice(0, 120),
      body: `${heading(input.subject)}${paragraphs(intro)}${paragraphs(input.body)}`,
      cta: { label: "Read and reply", url: input.url },
      signsIn: false,
      footer: `Sent by ${escapeHtml(input.associationName)} through Your HOAsis. The whole board can read this message in Messages.`,
    }),
    text: `${input.subject}\n\n${intro}\n\n${input.body}\n\nRead and reply: ${input.url}\n\n${input.associationName}`,
  };
}

/** A request moved. The new status is the subject; the board's note is the body. */
export function requestUpdateEmail(
  input: NoticeEmailInput & { reference: string; title: string; status: string; note: string },
) {
  const subject = `${input.status}: ${input.title} · ${input.reference}`;
  const body = `${heading(`${input.title} is ${input.status.toLowerCase()}`)}${paragraphs(
    [`${firstName(input.ownerName)}, the board updated request ${input.reference}.`, input.note].join("\n\n"),
  )}`;
  return {
    subject,
    html: layout({
      associationName: input.associationName,
      preheader: `${input.reference} is ${input.status.toLowerCase()}.`,
      body,
      cta: { label: "See the request", url: input.url },
      signsIn: input.hasAccount !== false,
      footer: noticeFooter(input, ""),
    }),
    text: `${input.title} is ${input.status.toLowerCase()}.\n\n${input.note}\n\n${input.url}\n\n${input.associationName}${
      input.unsubscribeUrl ? `\n\nUnsubscribe: ${input.unsubscribeUrl}` : ""
    }`,
  };
}
