import type Stripe from "stripe";

/**
 * Turns verified Stripe events into subscription updates. Kept free of
 * framework code so it can be unit-tested with signed test events.
 *
 * Only `customer.subscription.*` events are used: each one carries the whole,
 * current subscription, so no extra calls to Stripe are needed and events
 * arriving out of order are handled by comparing event times in the database.
 */

export const HANDLED_EVENTS = new Set(["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"]);

export interface SubscriptionUpdate {
  workspaceId: string;
  customerId: string;
  subscriptionId: string;
  plan: "free" | "pro";
  status: string;
  interval: "month" | "year" | null;
  seats: number | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  eventAt: string;
}

export function subscriptionUpdate(event: Stripe.Event, planForPrice: (priceId: string | null | undefined) => "pro" | null): SubscriptionUpdate | null {
  if (!HANDLED_EVENTS.has(event.type)) return null;
  const sub = event.data.object as Stripe.Subscription;
  const workspaceId = sub.metadata?.workspace_id;
  if (!workspaceId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return null;

  const item = sub.items?.data?.[0];
  const price = item?.price;
  const plan = planForPrice(price?.id) ?? "free";
  const periodEnd = item?.current_period_end ?? null;
  const interval = price?.recurring?.interval;

  return {
    workspaceId,
    customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    subscriptionId: sub.id,
    plan,
    // A deleted subscription is always over, whatever status it carries.
    status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
    interval: interval === "month" ? "month" : interval === "year" ? "year" : null,
    seats: item?.quantity ?? null,
    periodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end || !!sub.cancel_at,
    eventAt: new Date(event.created * 1000).toISOString(),
  };
}

/** Parameters for `billing_apply_subscription`. */
export function rpcParams(u: SubscriptionUpdate) {
  return {
    p_workspace: u.workspaceId,
    p_customer: u.customerId,
    p_subscription: u.subscriptionId,
    p_plan: u.plan,
    p_status: u.status,
    p_interval: u.interval,
    p_seats: u.seats,
    p_period_end: u.periodEnd,
    p_cancel_at_period_end: u.cancelAtPeriodEnd,
    p_event_at: u.eventAt,
  };
}
