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
}

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
 */
function layout(options: {
  associationName: string;
  preheader: string;
  body: string;
  cta: { label: string; url: string };
  footer: string;
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${options.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;border:1px solid #e2e6ec;overflow:hidden;">
    <tr><td style="padding:24px 28px 0;">
      <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#6b7789;">
        ${options.associationName}
      </p>
    </td></tr>
    <tr><td style="padding:16px 28px 8px;">${options.body}</td></tr>
    <tr><td style="padding:8px 28px 28px;">
      <a href="${options.cta.url}"
         style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;
                padding:14px 28px;border-radius:10px;font-size:16px;font-weight:600;">
        ${options.cta.label}
      </a>
      <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:#6b7789;">
        This link signs you in, so there is no password to remember.
      </p>
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
      ${input.ownerName}, this is your assessment for unit ${input.unitLabel}.
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
      ${input.ownerName}, unit ${input.unitLabel} carries a balance of ${amount}${
        days > 0 ? `, now ${days} ${days === 1 ? "day" : "days"} past due` : ""
      }.
    </p>
    <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:#3d4a5e;">
      If you have already paid, or if something is wrong with this figure, reply to this
      email and the board will look into it.
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
    text: `${input.ownerName},\n\nUnit ${input.unitLabel} carries a balance of ${amount}${
      days > 0 ? `, ${days} days past due` : ""
    }.\n\nPay: ${input.payUrl}\n\nIf you have already paid, reply and the board will look into it.\n\n${input.associationName}`,
  };
}

/**
 * The footer.
 *
 * A statutory notice says plainly why there is no unsubscribe link, rather
 * than leaving somebody to conclude we ignored one.
 */
function footerFor(input: DuesEmailInput): string {
  const sender = `Sent by ${input.associationName} through HOAsis.`;
  if (!input.unsubscribeUrl) {
    return `${sender} This is a notice about your account, so it is sent to every owner and cannot be turned off. You can still turn off community updates and newsletters in your account settings.`;
  }
  return `${sender} <a href="${input.unsubscribeUrl}" style="color:#8a94a3;">Unsubscribe from these</a>.`;
}
