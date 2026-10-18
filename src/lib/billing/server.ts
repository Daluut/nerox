import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { SITE } from "@/config/site";
import { activeMembers, type AppContext } from "../data/context";
import { createAdminClient } from "../supabase/admin";
import { billingEnabled } from "./config";
import { entitlements, type SubscriptionRow } from "./plan";
import { getStripe } from "./stripe";

interface DbRow {
  plan: "free" | "pro";
  status: string;
  billing_interval: "month" | "year" | null;
  seats: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
  stripe_subscription_id: string;
}

const COLUMNS = "plan, status, billing_interval, seats, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id";

/** The workspace's subscription as written by the webhook (read under RLS). */
export const getSubscription = cache(async (ctx: AppContext) => {
  if (!billingEnabled()) return null;
  const { data, error } = await ctx.supabase.from("subscriptions").select(COLUMNS).eq("workspace_id", ctx.workspace.id).maybeSingle();
  if (error) console.error("[nerox] billing: couldn't read subscription:", error.message);
  return (data as DbRow | null) ?? null;
});

export function toRow(r: DbRow | null): SubscriptionRow | null {
  return r
    ? {
        plan: r.plan,
        status: r.status,
        billingInterval: r.billing_interval,
        seats: r.seats,
        currentPeriodEnd: r.current_period_end,
        cancelAtPeriodEnd: r.cancel_at_period_end,
      }
    : null;
}

export const getEntitlements = cache(async (ctx: AppContext) =>
  entitlements(toRow(await getSubscription(ctx)), { billingEnabled: billingEnabled(), freeMemberLimit: SITE.pricing.freeMemberLimit }),
);

export const seatCount = (ctx: AppContext) => Math.max(1, activeMembers(ctx).length);

export async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/**
 * Keeps the number of paid seats equal to the number of active members after
 * someone joins or leaves. Best effort: a failure is logged, never shown, and
 * the next membership change corrects it.
 */
export async function syncSeats(workspaceId: string) {
  if (!billingEnabled()) return;
  try {
    const admin = createAdminClient();
    const [{ data: sub }, { count }] = await Promise.all([
      admin.from("subscriptions").select("plan, status, stripe_subscription_id").eq("workspace_id", workspaceId).maybeSingle(),
      admin.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
    ]);
    if (!sub || sub.plan !== "pro" || !["active", "trialing", "past_due"].includes(sub.status) || !count) return;
    const stripe = getStripe();
    const live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = live.items.data[0];
    if (!item || item.quantity === count) return;
    await stripe.subscriptions.update(live.id, { items: [{ id: item.id, quantity: count }], proration_behavior: "create_prorations" });
  } catch (e) {
    console.error("[nerox] billing: seat sync failed:", e instanceof Error ? e.message : e);
  }
}
