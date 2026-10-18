import "server-only";

/**
 * Payments switch on only when every piece Stripe needs is configured.
 * Until then the site shows Pro as "coming soon" and nothing is limited.
 */
export function billingEnabled() {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.STRIPE_PRICE_PRO_MONTHLY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function yearlyAvailable() {
  return billingEnabled() && !!process.env.STRIPE_PRICE_PRO_YEARLY;
}

export type Interval = "month" | "year";

export function priceIdFor(interval: Interval) {
  return interval === "year" ? process.env.STRIPE_PRICE_PRO_YEARLY : process.env.STRIPE_PRICE_PRO_MONTHLY;
}

/** Which Nerox plan a Stripe price belongs to. Unknown prices grant nothing. */
export function planForPrice(priceId: string | null | undefined): "pro" | null {
  if (!priceId) return null;
  return priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_YEARLY ? "pro" : null;
}
