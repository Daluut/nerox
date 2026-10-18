import { beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./harness";

/**
 * Billing in the database: only the webhook (service role) can grant or change
 * a plan, members can read their own workspace's plan, and out-of-order or
 * superseded Stripe events never overwrite newer state.
 */
let h: Awaited<ReturnType<typeof createDb>>;
let owner: string, member: string, outsider: string, ws: string, otherWs: string;

const apply = (args: { ws: string; sub?: string; status?: string; plan?: string; at: string; seats?: number; cancel?: boolean }) =>
  h.q<{ r: string }>("select public.billing_apply_subscription($1, 'cus_1', $2, $3, $4, 'month', $5, '2026-12-01T00:00:00Z', $6, $7) as r", [
    args.ws,
    args.sub ?? "sub_1",
    args.plan ?? "pro",
    args.status ?? "active",
    args.seats ?? 2,
    args.cancel ?? false,
    args.at,
  ]);

async function asService<T>(fn: () => Promise<T>) {
  await h.db.exec("set role service_role");
  try {
    return await fn();
  } finally {
    await h.db.exec("reset role");
  }
}

const current = async () => (await h.q<{ status: string; stripe_subscription_id: string; seats: number }>("select status, stripe_subscription_id, seats from subscriptions where workspace_id = $1", [ws]))[0];

beforeAll(async () => {
  h = await createDb();
  owner = await h.createUser("owner@example.com", "Owner");
  member = await h.createUser("member@example.com", "Member");
  outsider = await h.createUser("out@example.com", "Out");
  ws = await h.as(owner, async () => (await h.q<{ id: string }>("select public.create_workspace('Paid Co') as id"))[0].id);
  otherWs = await h.as(outsider, async () => (await h.q<{ id: string }>("select public.create_workspace('Other') as id"))[0].id);
  await h.q("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')", [ws, member]);
});

describe("billing", () => {
  it("does not let signed-in users grant themselves a plan", async () => {
    await expect(h.as(owner, () => apply({ ws, at: "2026-10-01T00:00:00Z" }))).rejects.toThrow(/permission denied/);
    await expect(
      h.as(owner, () => h.q("insert into subscriptions (workspace_id, stripe_customer_id, stripe_subscription_id, plan, status, last_event_at) values ($1, 'c', 's', 'pro', 'active', now())", [ws])),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets the webhook (service role) record a subscription", async () => {
    expect((await asService(() => apply({ ws, at: "2026-10-01T00:00:00Z" })))[0].r).toBe("created");
    expect(await current()).toMatchObject({ status: "active", stripe_subscription_id: "sub_1", seats: 2 });
  });

  it("shows the plan to members and hides it from other workspaces", async () => {
    expect(await h.as(member, () => h.q("select plan, status from subscriptions where workspace_id = $1", [ws]))).toEqual([{ plan: "pro", status: "active" }]);
    expect(await h.as(outsider, () => h.q("select * from subscriptions"))).toEqual([]);
  });

  it("does not let members change the plan directly", async () => {
    await h.as(owner, () => h.q("update subscriptions set status = 'active', plan = 'pro', seats = 999 where workspace_id = $1", [ws]));
    expect((await current()).seats).toBe(2);
  });

  it("ignores events older than what's stored", async () => {
    await asService(() => apply({ ws, at: "2026-10-05T00:00:00Z", seats: 3 }));
    expect((await asService(() => apply({ ws, at: "2026-10-02T00:00:00Z", status: "past_due" })))[0].r).toBe("stale");
    expect(await current()).toMatchObject({ status: "active", seats: 3 });
  });

  it("records a failed renewal and then the cancellation", async () => {
    await asService(() => apply({ ws, at: "2026-10-06T00:00:00Z", status: "past_due", seats: 3 }));
    expect((await current()).status).toBe("past_due");
    await asService(() => apply({ ws, at: "2026-10-09T00:00:00Z", status: "canceled", seats: 3 }));
    expect((await current()).status).toBe("canceled");
  });

  it("lets a workspace resubscribe, and an old subscription ending can't cancel the new one", async () => {
    expect((await asService(() => apply({ ws, sub: "sub_2", at: "2026-10-10T00:00:00Z" })))[0].r).toBe("updated");
    expect((await asService(() => apply({ ws, sub: "sub_1", status: "canceled", at: "2026-10-11T00:00:00Z" })))[0].r).toBe("superseded");
    expect(await current()).toMatchObject({ status: "active", stripe_subscription_id: "sub_2" });
  });

  it("ignores subscriptions for workspaces that don't exist", async () => {
    expect((await asService(() => apply({ ws: "00000000-0000-0000-0000-000000000000", at: "2026-10-10T00:00:00Z" })))[0].r).toBe("unknown_workspace");
  });

  it("counts pending invitations for admins only", async () => {
    await h.as(owner, () =>
      h.q("insert into invitations (workspace_id, role, token_hash, invited_by, expires_at) values ($1, 'member', 'h1', $2, now() + interval '1 day'), ($1, 'member', 'h2', $2, now() - interval '1 day')", [ws, owner]),
    );
    expect(await h.as(owner, () => h.q("select public.pending_invitation_count($1) as n", [ws]))).toEqual([{ n: 1 }]);
    expect(await h.as(member, () => h.q("select public.pending_invitation_count($1) as n", [ws]))).toEqual([{ n: 0 }]);
    expect(await h.as(outsider, () => h.q("select public.pending_invitation_count($1) as n", [ws]))).toEqual([{ n: 0 }]);
  });

  it("removes the subscription row with the workspace", async () => {
    await asService(() => apply({ ws: otherWs, at: "2026-10-10T00:00:00Z" }));
    await h.as(outsider, () => h.q("delete from workspaces where id = $1", [otherWs]));
    expect(await h.q("select * from subscriptions where workspace_id = $1", [otherWs])).toEqual([]);
  });
});
