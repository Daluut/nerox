-- ════════════════════════════════════════════════════════════════════════════
-- Nerox — billing (Stripe subscriptions)
--
-- One row per workspace that has ever started a paid subscription. Rows are
-- written ONLY by the Stripe webhook (server, service role) after the event's
-- signature has been verified. Members can read their workspace's row; nobody
-- can write it from the browser, so paid access can't be granted by a client.
-- ════════════════════════════════════════════════════════════════════════════

create table public.subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status text not null, -- Stripe's subscription status: active, trialing, past_due, canceled, unpaid…
  billing_interval text check (billing_interval in ('month', 'year')),
  seats integer check (seats is null or seats > 0),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_event_at timestamptz not null, -- Stripe event time; older events never overwrite newer state
  updated_at timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_member(workspace_id));
-- No insert/update/delete policies: only the service role (webhook) writes.

/**
 * Applies a verified Stripe subscription event. Called only by the webhook with
 * the service role. Ignores events older than what's stored, and ignores the
 * end of an old subscription once the workspace has moved to a newer one.
 */
create or replace function public.billing_apply_subscription(
  p_workspace uuid,
  p_customer text,
  p_subscription text,
  p_plan text,
  p_status text,
  p_interval text,
  p_seats integer,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_at timestamptz
) returns text
language plpgsql security definer set search_path = public as $$
declare
  cur public.subscriptions;
begin
  if not exists (select 1 from public.workspaces where id = p_workspace) then
    return 'unknown_workspace';
  end if;

  select * into cur from public.subscriptions where workspace_id = p_workspace for update;

  if found then
    if cur.last_event_at > p_event_at then
      return 'stale';
    end if;
    -- An old subscription ending must not cancel a newer one.
    if cur.stripe_subscription_id <> p_subscription
       and p_status in ('canceled', 'incomplete_expired', 'unpaid')
       and cur.status in ('active', 'trialing', 'past_due') then
      return 'superseded';
    end if;
    update public.subscriptions set
      stripe_customer_id = p_customer,
      stripe_subscription_id = p_subscription,
      plan = p_plan,
      status = p_status,
      billing_interval = p_interval,
      seats = p_seats,
      current_period_end = p_period_end,
      cancel_at_period_end = p_cancel_at_period_end,
      last_event_at = p_event_at,
      updated_at = now()
    where workspace_id = p_workspace;
    return 'updated';
  end if;

  insert into public.subscriptions (workspace_id, stripe_customer_id, stripe_subscription_id, plan, status, billing_interval, seats, current_period_end, cancel_at_period_end, last_event_at)
  values (p_workspace, p_customer, p_subscription, p_plan, p_status, p_interval, p_seats, p_period_end, p_cancel_at_period_end, p_event_at);
  return 'created';
end;
$$;

revoke all on function public.billing_apply_subscription(uuid, text, text, text, text, text, integer, timestamptz, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.billing_apply_subscription(uuid, text, text, text, text, text, integer, timestamptz, boolean, timestamptz) to service_role;

/** Pending, usable invitations, so the Free member limit can count them. */
create or replace function public.pending_invitation_count(p_workspace uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case when public.is_admin(p_workspace) then (
    select count(*)::int from public.invitations
    where workspace_id = p_workspace and accepted_at is null and revoked_at is null and expires_at > now()
  ) else 0 end;
$$;
grant execute on function public.pending_invitation_count(uuid) to authenticated;
