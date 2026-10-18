import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { canInviteMore, entitlements, type SubscriptionRow } from "../../src/lib/billing/plan";
import { rpcParams, subscriptionUpdate } from "../../src/lib/billing/webhook";
import { csvCell, toCsv } from "../../src/lib/export/csv";

const WS = "6f0e9a52-2a4c-4f39-9c55-8a1d1d6c0b11";
const PRO_MONTHLY = "price_pro_monthly";
const planForPrice = (id: string | null | undefined) => (id === PRO_MONTHLY ? ("pro" as const) : null);

function subscription(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub_123",
    object: "subscription",
    customer: "cus_123",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    metadata: { workspace_id: WS },
    items: {
      object: "list",
      data: [{ id: "si_1", quantity: 4, current_period_end: 1_790_000_000, price: { id: PRO_MONTHLY, recurring: { interval: "month" } } }],
    },
    ...over,
  };
}

function event(type: string, object: unknown, created = 1_780_000_000) {
  return { id: "evt_1", object: "event", type, created, data: { object } } as unknown as Stripe.Event;
}

const row = (over: Partial<SubscriptionRow> = {}): SubscriptionRow => ({
  plan: "pro",
  status: "active",
  billingInterval: "month",
  seats: 4,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  ...over,
});
const opts = { billingEnabled: true, freeMemberLimit: 5 };

describe("entitlements", () => {
  it("unlocks everything during early access, when payments aren't configured", () => {
    const e = entitlements(null, { billingEnabled: false, freeMemberLimit: 5 });
    expect(e).toMatchObject({ plan: "early_access", memberLimit: null, aiAnswers: true, export: true });
  });

  it("gives Free limits when there is no subscription", () => {
    expect(entitlements(null, opts)).toMatchObject({ plan: "free", memberLimit: 5, aiAnswers: false, export: false });
  });

  it("gives Pro only for paying statuses", () => {
    expect(entitlements(row(), opts).plan).toBe("pro");
    expect(entitlements(row({ status: "trialing" }), opts).plan).toBe("pro");
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(entitlements(row({ status }), opts).plan).toBe("free");
    }
  });

  it("keeps Pro while Stripe retries a failed payment, and says so", () => {
    expect(entitlements(row({ status: "past_due" }), opts)).toMatchObject({ plan: "pro", notice: "payment_failed" });
  });

  it("flags a subscription that will end", () => {
    expect(entitlements(row({ cancelAtPeriodEnd: true }), opts)).toMatchObject({ plan: "pro", notice: "ending" });
  });

  it("never treats a non-Pro plan as paid", () => {
    expect(entitlements(row({ plan: "free" }), opts).plan).toBe("free");
  });

  it("counts pending invitations against the Free member limit", () => {
    const free = entitlements(null, opts);
    expect(canInviteMore(free, 3, 1)).toBe(true);
    expect(canInviteMore(free, 4, 1)).toBe(false);
    expect(canInviteMore(free, 5, 0)).toBe(false);
    expect(canInviteMore(entitlements(row(), opts), 40, 10)).toBe(true);
  });
});

describe("Stripe webhook events", () => {
  it("maps a subscription event to a database update", () => {
    const u = subscriptionUpdate(event("customer.subscription.created", subscription()), planForPrice);
    expect(u).toEqual({
      workspaceId: WS,
      customerId: "cus_123",
      subscriptionId: "sub_123",
      plan: "pro",
      status: "active",
      interval: "month",
      seats: 4,
      periodEnd: new Date(1_790_000_000 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      eventAt: new Date(1_780_000_000 * 1000).toISOString(),
    });
    expect(rpcParams(u!)).toMatchObject({ p_workspace: WS, p_plan: "pro", p_status: "active", p_seats: 4 });
  });

  it("treats a deleted subscription as canceled", () => {
    const u = subscriptionUpdate(event("customer.subscription.deleted", subscription({ status: "active" })), planForPrice);
    expect(u?.status).toBe("canceled");
  });

  it("grants nothing for an unknown price", () => {
    const sub = subscription();
    (sub.items.data[0].price as { id: string }).id = "price_someone_elses";
    expect(subscriptionUpdate(event("customer.subscription.updated", sub), planForPrice)?.plan).toBe("free");
  });

  it("ignores events without a workspace, or of other types", () => {
    expect(subscriptionUpdate(event("customer.subscription.updated", subscription({ metadata: {} })), planForPrice)).toBeNull();
    expect(subscriptionUpdate(event("customer.subscription.updated", subscription({ metadata: { workspace_id: "x' or 1=1" } })), planForPrice)).toBeNull();
    expect(subscriptionUpdate(event("checkout.session.completed", { id: "cs_1" }), planForPrice)).toBeNull();
    expect(subscriptionUpdate(event("invoice.paid", { id: "in_1" }), planForPrice)).toBeNull();
  });

  it("notices a scheduled cancellation", () => {
    expect(subscriptionUpdate(event("customer.subscription.updated", subscription({ cancel_at_period_end: true })), planForPrice)?.cancelAtPeriodEnd).toBe(true);
    expect(subscriptionUpdate(event("customer.subscription.updated", subscription({ cancel_at: 1_790_000_000 })), planForPrice)?.cancelAtPeriodEnd).toBe(true);
  });

  it("accepts only correctly signed payloads", () => {
    const stripe = new Stripe("sk_test_dummy");
    const secret = "whsec_test_secret";
    const payload = JSON.stringify(event("customer.subscription.created", subscription()));
    const header = stripe.webhooks.generateTestHeaderString({ payload, secret });

    const verified = stripe.webhooks.constructEvent(payload, header, secret);
    expect(verified.type).toBe("customer.subscription.created");

    expect(() => stripe.webhooks.constructEvent(payload, header, "whsec_wrong")).toThrow();
    const tampered = payload.replace('"active"', '"trialing"');
    expect(() => stripe.webhooks.constructEvent(tampered, header, secret)).toThrow();
    const old = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect(() => stripe.webhooks.constructEvent(payload, old, secret)).toThrow();
  });
});

describe("CSV export", () => {
  it("quotes cells that need it", () => {
    expect(csvCell('Say "hi", then go')).toBe('"Say ""hi"", then go"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(6)).toBe("6");
  });

  it("stops task titles running as spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("writes a header and rows with a UTF-8 marker", () => {
    expect(toCsv(["A", "B"], [[1, "x"]])).toBe("﻿A,B\r\n1,x\r\n");
  });
});
