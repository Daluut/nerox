"use server";

import { z } from "zod";
import { getAppContext } from "../data/context";
import { billingEnabled, priceIdFor } from "../billing/config";
import { getStripe } from "../billing/stripe";
import { getEntitlements, getSubscription, seatCount, siteUrl } from "../billing/server";
import type { ActionResult } from "../data/types";
import { err, ok, parse } from "./util";

const canManageBilling = (role: string) => role === "owner" || role === "admin";

/**
 * Starts a Stripe Checkout session for Pro and returns its URL. Payment happens
 * on Stripe's hosted page; access is granted later, only by the verified webhook.
 */
export async function startCheckout(interval: unknown): Promise<ActionResult<{ url: string }>> {
  const v = parse(z.enum(["month", "year"]), interval);
  if (!v.ok) return v;
  if (!billingEnabled()) return err("Payments aren't switched on yet.");
  const ctx = await getAppContext();
  if (!canManageBilling(ctx.role)) return err("Only the workspace owner or an admin can manage billing.");
  const price = priceIdFor(v.data);
  if (!price) return err("Yearly billing isn't available yet. Choose monthly.");

  const [current, ent] = await Promise.all([getSubscription(ctx), getEntitlements(ctx)]);
  if (ent.plan === "pro") return err("This workspace is already on Pro. Use Manage billing to make changes.");

  const base = await siteUrl();
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: seatCount(ctx) }],
      ...(current?.stripe_customer_id ? { customer: current.stripe_customer_id } : ctx.email ? { customer_email: ctx.email } : {}),
      client_reference_id: ctx.workspace.id,
      metadata: { workspace_id: ctx.workspace.id },
      subscription_data: { metadata: { workspace_id: ctx.workspace.id, started_by: ctx.userId } },
      allow_promotion_codes: true,
      success_url: `${base}/settings/billing?checkout=success`,
      cancel_url: `${base}/settings/billing?checkout=cancelled`,
    });
    if (!session.url) return err("Stripe didn't return a checkout page. Try again.");
    return ok({ url: session.url });
  } catch (e) {
    console.error("[nerox] billing: checkout failed:", e instanceof Error ? e.message : e);
    return err("Couldn't open checkout. Try again in a moment.");
  }
}

/** Opens Stripe's customer portal: change card, see invoices, cancel. */
export async function openBillingPortal(): Promise<ActionResult<{ url: string }>> {
  if (!billingEnabled()) return err("Payments aren't switched on yet.");
  const ctx = await getAppContext();
  if (!canManageBilling(ctx.role)) return err("Only the workspace owner or an admin can manage billing.");
  const current = await getSubscription(ctx);
  if (!current?.stripe_customer_id) return err("There's no billing account for this workspace yet.");
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: current.stripe_customer_id,
      return_url: `${await siteUrl()}/settings/billing`,
    });
    return ok({ url: session.url });
  } catch (e) {
    console.error("[nerox] billing: portal failed:", e instanceof Error ? e.message : e);
    return err("Couldn't open billing. Try again in a moment.");
  }
}
