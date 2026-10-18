import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { billingEnabled, yearlyAvailable } from "@/lib/billing/config";
import { getEntitlements, getSubscription, seatCount } from "@/lib/billing/server";
import { SITE } from "@/config/site";
import { BillingView } from "./billing-view";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const ctx = await getAppContext();
  const [sub, ent, sp] = await Promise.all([getSubscription(ctx), getEntitlements(ctx), searchParams]);
  return (
    <BillingView
      enabled={billingEnabled()}
      yearly={yearlyAvailable()}
      canManage={ctx.role === "owner" || ctx.role === "admin"}
      plan={ent.plan}
      notice={ent.notice}
      status={sub?.status ?? null}
      interval={sub?.billing_interval ?? null}
      seats={sub?.seats ?? null}
      periodEnd={sub?.current_period_end ?? null}
      hasCustomer={!!sub?.stripe_customer_id}
      members={seatCount(ctx)}
      checkout={sp.checkout === "success" || sp.checkout === "cancelled" ? sp.checkout : null}
      pricing={SITE.pricing}
      proFeatures={SITE.plans.find((p) => p.id === "pro")!.features.slice(1)}
    />
  );
}
