"use client";

import type { Appearance } from "@stripe/stripe-js";

/**
 * The Payment Element, dressed as the product.
 *
 * Stripe's form lives in its own frame, so nothing in globals.css reaches
 * it. The values are read from the document at mount so the element follows
 * the same theme the page is showing, light or dark, and the same type and
 * radius the rest of the pay screen uses. Called on the client only.
 */
export function stripeAppearance(): Appearance {
  const root = typeof document === "undefined" ? null : document.documentElement;
  const dark = root?.classList.contains("dark") ?? false;
  const style = root ? getComputedStyle(root) : null;
  const token = (name: string, fallback: string) => style?.getPropertyValue(name).trim() || fallback;
  return {
    theme: dark ? "night" : "stripe",
    labels: "floating",
    variables: {
      colorPrimary: token("--primary", dark ? "#3d7ff0" : "#2b6be3"),
      colorBackground: token("--surface-2", dark ? "#0b1526" : "#f7f7f5"),
      colorText: token("--fg", dark ? "#e9edf3" : "#16202e"),
      colorTextSecondary: token("--fg-muted", dark ? "#9aa8bd" : "#50545d"),
      colorDanger: token("--danger", dark ? "#e88a80" : "#b3382d"),
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      fontSizeBase: "16px",
      borderRadius: "10px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { borderColor: token("--border", dark ? "#1f3050" : "#e4e3df"), boxShadow: "none" },
      ".Input:focus": { boxShadow: "none", borderColor: token("--primary", "#2b6be3") },
      ".Tab, .Block": { borderColor: token("--border", dark ? "#1f3050" : "#e4e3df"), boxShadow: "none" },
    },
  };
}

/**
 * One rail at a time. The pay screen already asked "bank or card", so the
 * element shows that one form rather than an accordion of everything Stripe
 * could offer, and Link's "pay by bank, $5 back" upsell stays out of a dues
 * payment.
 *
 * Apple Pay and Google Pay ride the card rail. "auto" means the element
 * shows the wallet first when the browser has one set up and the domain is
 * registered on the association's account (registerPayDomains); anywhere
 * else the card form is what renders, with no error.
 */
export const PAYMENT_ELEMENT_OPTIONS = {
  layout: "tabs" as const,
  wallets: { applePay: "auto" as const, googlePay: "auto" as const, link: "never" as const },
};
