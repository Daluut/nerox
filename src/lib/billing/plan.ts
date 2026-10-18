/**
 * Plan rules. Pure functions, shared by the server and the UI, and unit-tested.
 *
 * Paid access is decided only from the subscription row the verified Stripe
 * webhook wrote. A visit to the checkout success page grants nothing.
 */

export type PlanId = "free" | "pro";

export interface SubscriptionRow {
  plan: PlanId;
  status: string;
  billingInterval: "month" | "year" | null;
  seats: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Stripe statuses that keep Pro on. `past_due` is included because Stripe is
 * still retrying the payment; once it gives up the subscription becomes
 * `canceled` or `unpaid` (depending on your Stripe settings) and Pro switches off.
 */
export const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export interface Entitlements {
  /** "early_access" means payments aren't switched on, so nothing is limited. */
  plan: PlanId | "early_access";
  memberLimit: number | null; // null = unlimited
  aiAnswers: boolean;
  export: boolean;
  /** Something the owner should know about: a failed payment, or Pro ending. */
  notice: "payment_failed" | "ending" | null;
}

export function entitlements(row: SubscriptionRow | null, opts: { billingEnabled: boolean; freeMemberLimit: number }): Entitlements {
  if (!opts.billingEnabled) return { plan: "early_access", memberLimit: null, aiAnswers: true, export: true, notice: null };
  const paid = !!row && row.plan === "pro" && PAID_STATUSES.has(row.status);
  if (!paid) return { plan: "free", memberLimit: opts.freeMemberLimit, aiAnswers: false, export: false, notice: null };
  return {
    plan: "pro",
    memberLimit: null,
    aiAnswers: true,
    export: true,
    notice: row.status === "past_due" ? "payment_failed" : row.cancelAtPeriodEnd ? "ending" : null,
  };
}

/** Whether one more invitation fits under the member limit. */
export function canInviteMore(e: Entitlements, activeMembers: number, pendingInvites: number) {
  return e.memberLimit === null || activeMembers + pendingInvites < e.memberLimit;
}
