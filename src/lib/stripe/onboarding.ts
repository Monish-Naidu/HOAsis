/**
 * What we already know about an association, in the shape Stripe's
 * Accounts v2 create call takes, so the hosted onboarding form asks the
 * treasurer for as little as possible.
 *
 * Measured on a bare test account (2026-09-26): with nothing prefilled
 * Stripe asks for the MCC, a statement descriptor, a support phone, a
 * product description, a web address, the city, state and phone, and then
 * the EIN, address line, ZIP, bank account, representative and the terms.
 * With this prefill the first eight are gone. What is left is exactly what
 * the "Before you start" card in Settings tells the treasurer to have ready.
 *
 * Only columns the setup wizard already collects are read (name, city,
 * state, EIN when given, phone, slug). No street address or ZIP: the
 * association row does not hold one, and a wrong guess costs more than a
 * blank. Pure and tested in tests/unit/stripe-onboarding.test.ts.
 */

export interface AssociationForStripe {
  name: string;
  ein?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  slug?: string | null;
}

/** Civic, social and fraternal associations. The closest MCC to a homeowners association. */
export const HOA_MCC = "8641";
export const PRODUCT_DESCRIPTION = "Homeowners association dues";

/** A US number in E.164, or null when the text is not a ten-digit number. */
export function e164(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * What shows on a resident's card statement. Stripe's rules: 5 to 22
 * characters, at least one letter, none of < > \ ' " *. Uppercase because
 * card networks print it that way anyway, "HOA" appended when it fits so a
 * resident reading their statement knows what the line is.
 */
export function statementDescriptor(name: string): string | null {
  const cleaned = name
    .toUpperCase()
    .replace(/[<>\\'"*]/g, "")
    .replace(/[^A-Z0-9 &.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[A-Z]/.test(cleaned)) return null;
  let descriptor = cleaned;
  if (!/\bHOA\b/.test(descriptor) && descriptor.length + 4 <= 22) descriptor = `${descriptor} HOA`;
  descriptor = descriptor.slice(0, 22).trim();
  return descriptor.length >= 5 ? descriptor : null;
}

/** The first word or two of the descriptor, 2 to 10 characters, for dynamic descriptors. */
export function statementPrefix(descriptor: string): string {
  return descriptor.slice(0, 10).trim();
}

/** The public page for this association, which is what Stripe wants as the business URL. */
export function associationUrl(origin: string, slug: string | null | undefined): string {
  const base = origin.replace(/\/$/, "");
  return slug ? `${base}/c/${slug}` : base;
}

export interface AccountPrefill {
  display_name: string;
  identity: {
    country: "us";
    entity_type: "company";
    business_details: {
      registered_name: string;
      id_numbers?: Array<{ type: "us_ein"; value: string }>;
      address?: { country: "us"; city?: string; state?: string };
      phone?: string;
    };
  };
  configuration: {
    merchant: {
      capabilities: {
        card_payments: { requested: true };
        ach_debit_payments: { requested: true };
      };
      mcc: string;
      statement_descriptor?: { descriptor: string; prefix: string };
      support?: { url: string; phone?: string };
    };
  };
  defaults: {
    responsibilities: { fees_collector: "stripe"; losses_collector: "stripe" };
    profile: { business_url: string; doing_business_as: string; product_description: string };
  };
}

/** The create params, minus dashboard, contact email and metadata, which the route adds. */
export function accountPrefill(association: AssociationForStripe, origin: string): AccountPrefill {
  const name = association.name.trim();
  const ein = (association.ein ?? "").replace(/\D/g, "");
  const phone = e164(association.phone);
  const url = associationUrl(origin, association.slug);
  const descriptor = statementDescriptor(name);
  const city = association.city?.trim();
  const state = association.state?.trim().toUpperCase();

  return {
    display_name: name,
    identity: {
      country: "us",
      entity_type: "company",
      business_details: {
        registered_name: name,
        id_numbers: ein.length === 9 ? [{ type: "us_ein", value: ein }] : undefined,
        address: city || state ? { country: "us", city: city || undefined, state: state || undefined } : undefined,
        phone: phone ?? undefined,
      },
    },
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { requested: true },
          ach_debit_payments: { requested: true },
        },
        mcc: HOA_MCC,
        statement_descriptor: descriptor
          ? { descriptor, prefix: statementPrefix(descriptor) }
          : undefined,
        support: { url, phone: phone ?? undefined },
      },
    },
    defaults: {
      responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
      profile: { business_url: url, doing_business_as: name, product_description: PRODUCT_DESCRIPTION },
    },
  };
}
