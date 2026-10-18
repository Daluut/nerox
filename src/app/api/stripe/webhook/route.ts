import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { billingEnabled, planForPrice } from "@/lib/billing/config";
import { getStripe } from "@/lib/billing/stripe";
import { rpcParams, subscriptionUpdate } from "@/lib/billing/webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. The signature is checked against STRIPE_WEBHOOK_SECRET using
 * the exact raw body before anything is trusted. This is the only place paid
 * access is granted or removed.
 */
export async function POST(request: Request) {
  if (!billingEnabled()) return NextResponse.json({ error: "Billing is not configured" }, { status: 404 });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const update = subscriptionUpdate(event, planForPrice);
  if (!update) return NextResponse.json({ received: true, ignored: event.type });

  const { data, error } = await createAdminClient().rpc("billing_apply_subscription", rpcParams(update));
  if (error) {
    console.error("[nerox] billing webhook: database update failed:", error.message);
    // A 500 makes Stripe retry later.
    return NextResponse.json({ error: "Couldn't record the update" }, { status: 500 });
  }
  if (data === "unknown_workspace") console.warn("[nerox] billing webhook: subscription for unknown workspace", update.workspaceId);
  return NextResponse.json({ received: true, result: data });
}
