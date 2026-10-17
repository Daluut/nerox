-- ════════════════════════════════════════════════════════════════════════════
-- Nerox — initial schema (Phase 1 foundation + Phase 2 Pulse)
--
-- Security model
--   • Every table has row-level security enabled.
--   • Access is scoped by workspace membership; helper functions below are
--     SECURITY DEFINER so policies can read memberships without recursion.
--   • Roles: owner > admin > member > viewer. Viewers are read-only.
--   • workspace_id on child rows is derived from the parent by triggers, never
--     trusted from the client.
--   • Multi-row operations (workspace creation, project creation from a template,
--     invitations, member removal) run inside single database functions so they
--     are atomic.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  email text,
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Workspaces & membership ─────────────────────────────────────────────────
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null references public.profiles (id),
  settings jsonb not null default '{"timezone":"Europe/London"}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'removed')),
  joined_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id) where status = 'active';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text,
  role text not null check (role in ('admin', 'member', 'viewer')),
  token_hash text not null unique, -- sha256 of the token; the token itself is never stored
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_workspace_idx on public.invitations (workspace_id);

-- ── Projects ────────────────────────────────────────────────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  owner_id uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  start_date date,
  deadline date,
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed')),
  archived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_date is null or deadline is null or start_date <= deadline)
);
create index projects_workspace_idx on public.projects (workspace_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '',
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_project_idx on public.milestones (project_id);

-- ── Tasks ───────────────────────────────────────────────────────────────────
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  milestone_id uuid references public.milestones (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  status text not null default 'todo' check (status in ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  assignee_id uuid references public.profiles (id) on delete set null,
  creator_id uuid references public.profiles (id) on delete set null,
  start_date date,
  due_date date,
  estimate_hours numeric(7, 2) check (estimate_hours is null or estimate_hours > 0),
  actual_hours numeric(7, 2) check (actual_hours is null or actual_hours >= 0),
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  completed_at timestamptz,
  check (start_date is null or due_date is null or start_date <= due_date),
  check ((status = 'done') = (completed_at is not null))
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (workspace_id, assignee_id) where status <> 'done';
create index tasks_due_idx on public.tasks (workspace_id, due_date) where status <> 'done';

create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  predecessor_id uuid not null references public.tasks (id) on delete cascade,
  successor_id uuid not null references public.tasks (id) on delete cascade,
  dependency_type text not null default 'finish_to_start' check (dependency_type = 'finish_to_start'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (predecessor_id, successor_id),
  check (predecessor_id <> successor_id)
);
create index task_dependencies_successor_idx on public.task_dependencies (successor_id);
create index task_dependencies_project_idx on public.task_dependencies (project_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  content text not null check (char_length(btrim(content)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_task_idx on public.comments (task_id, created_at);

-- ── Activity & notifications ────────────────────────────────────────────────
create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  entity_type text not null check (entity_type in ('project', 'task', 'milestone', 'comment', 'dependency', 'member')),
  entity_id uuid,
  event_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_workspace_idx on public.activity_events (workspace_id, created_at desc);
create index activity_project_idx on public.activity_events (project_id, created_at desc);
create index activity_entity_idx on public.activity_events (entity_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid references public.activity_events (id) on delete cascade,
  kind text not null,
  title text not null,
  link text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

-- ── Pulse ───────────────────────────────────────────────────────────────────
-- One stored snapshot per project per calendar day (the latest assessment that day).
create table public.pulse_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  snapshot_date date not null,
  score numeric(5, 2) check (score is null or (score >= 0 and score <= 100)),
  status text not null check (status in ('healthy', 'attention', 'at_risk', 'critical', 'insufficient_data')),
  confidence text not null,
  factors jsonb not null,
  risks jsonb not null,
  algorithm_version text not null,
  assessed_at timestamptz not null default now(),
  unique (project_id, snapshot_date)
);

-- Acknowledging a risk records that someone has seen it; it does not hide it from the score.
create table public.pulse_acknowledgements (
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  risk_id text not null check (char_length(risk_id) <= 200),
  user_id uuid not null references public.profiles (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 500),
  acknowledged_at timestamptz not null default now(),
  primary key (project_id, risk_id)
);

-- ════════════════════════════════════════════════════════════════════════════
-- Authorisation helpers
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.member_role(ws uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from workspace_members
  where workspace_id = ws and user_id = auth.uid() and status = 'active'
$$;

create or replace function public.is_member(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_role(ws) is not null
$$;

create or replace function public.can_edit(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(ws) in ('owner', 'admin', 'member'), false)
$$;

create or replace function public.is_admin(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(ws) in ('owner', 'admin'), false)
$$;

-- Profiles are visible to anyone who shares (or shared) a workspace with you,
-- so names in historical activity stay readable after someone leaves.
create or replace function public.can_see_profile(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from workspace_members mine
    join workspace_members theirs on theirs.workspace_id = mine.workspace_id
    where mine.user_id = auth.uid() and mine.status = 'active' and theirs.user_id = other
  )
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Integrity triggers
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger milestones_updated before update on public.milestones for each row execute function public.set_updated_at();
create trigger comments_updated before update on public.comments for each row execute function public.set_updated_at();

-- New auth user → profile.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)), 80)
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Child rows inherit workspace_id from their parent; the client value is ignored.
create or replace function public.inherit_workspace_from_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Moving records between projects is not supported' using errcode = '22023';
  end if;
  select workspace_id into new.workspace_id from projects where id = new.project_id;
  if new.workspace_id is null then
    raise exception 'Project not found' using errcode = '23503';
  end if;
  return new;
end $$;

create trigger project_members_ws before insert or update on public.project_members for each row execute function public.inherit_workspace_from_project();
create trigger milestones_ws before insert or update on public.milestones for each row execute function public.inherit_workspace_from_project();
create trigger pulse_assessments_ws before insert or update on public.pulse_assessments for each row execute function public.inherit_workspace_from_project();
create trigger pulse_ack_ws before insert or update on public.pulse_acknowledgements for each row execute function public.inherit_workspace_from_project();

create or replace function public.validate_project_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from workspace_members where workspace_id = new.workspace_id and user_id = new.user_id and status = 'active') then
    raise exception 'Only workspace members can be added to a project' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger project_members_validate before insert on public.project_members for each row execute function public.validate_project_member();

create or replace function public.prepare_task()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.project_id <> old.project_id then
    raise exception 'Moving tasks between projects is not supported' using errcode = '22023';
  end if;
  select workspace_id into new.workspace_id from projects where id = new.project_id;
  if new.workspace_id is null then
    raise exception 'Project not found' using errcode = '23503';
  end if;

  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    if not exists (select 1 from workspace_members where workspace_id = new.workspace_id and user_id = new.assignee_id and status = 'active') then
      raise exception 'Tasks can only be assigned to workspace members' using errcode = '23514';
    end if;
  end if;

  if new.milestone_id is not null and not exists (select 1 from milestones where id = new.milestone_id and project_id = new.project_id) then
    raise exception 'Milestone belongs to a different project' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.status_changed_at := now();
    new.completed_at := case when new.status = 'done' then now() else null end;
  else
    new.updated_at := now();
    new.creator_id := old.creator_id;
    new.created_at := old.created_at;
    if new.status is distinct from old.status then
      new.status_changed_at := now();
      new.completed_at := case when new.status = 'done' then now() else null end;
    else
      new.status_changed_at := old.status_changed_at;
      new.completed_at := old.completed_at;
    end if;
  end if;
  return new;
end $$;
create trigger tasks_prepare before insert or update on public.tasks for each row execute function public.prepare_task();

-- Dependencies: same project only, and never circular.
create or replace function public.validate_dependency()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  pred_project uuid;
  succ_project uuid;
begin
  select project_id into pred_project from tasks where id = new.predecessor_id;
  select project_id into succ_project from tasks where id = new.successor_id;
  if pred_project is null or succ_project is null then
    raise exception 'Task not found' using errcode = '23503';
  end if;
  if pred_project <> succ_project then
    raise exception 'Dependencies must be between tasks in the same project' using errcode = '23514';
  end if;
  new.project_id := pred_project;
  select workspace_id into new.workspace_id from projects where id = pred_project;

  -- Would the new edge close a loop? It does if the predecessor is already downstream of the successor.
  if exists (
    with recursive downstream(id) as (
      select successor_id from task_dependencies where predecessor_id = new.successor_id
      union
      select d.successor_id from task_dependencies d join downstream on d.predecessor_id = downstream.id
    )
    select 1 from downstream where id = new.predecessor_id
  ) then
    raise exception 'circular_dependency: this would make the tasks depend on each other in a loop' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger task_dependencies_validate before insert or update on public.task_dependencies for each row execute function public.validate_dependency();

create or replace function public.prepare_comment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select workspace_id into new.workspace_id from tasks where id = new.task_id;
  if new.workspace_id is null then
    raise exception 'Task not found' using errcode = '23503';
  end if;
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.task_id := old.task_id;
  end if;
  return new;
end $$;
create trigger comments_prepare before insert or update on public.comments for each row execute function public.prepare_comment();

-- ════════════════════════════════════════════════════════════════════════════
-- Activity log & notifications (written by triggers so they always reflect real changes)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.log_activity(
  p_workspace uuid, p_project uuid, p_entity_type text, p_entity uuid, p_event text, p_data jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  ev uuid;
begin
  insert into activity_events (workspace_id, project_id, actor_id, entity_type, entity_id, event_type, data)
  values (p_workspace, p_project, auth.uid(), p_entity_type, p_entity, p_event, coalesce(p_data, '{}'::jsonb))
  returning id into ev;
  return ev;
end $$;

create or replace function public.notify(
  p_workspace uuid, p_recipient uuid, p_event uuid, p_kind text, p_title text, p_link text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_recipient is null or p_recipient = auth.uid() then
    return;
  end if;
  if not exists (select 1 from workspace_members where workspace_id = p_workspace and user_id = p_recipient and status = 'active') then
    return;
  end if;
  insert into notifications (workspace_id, recipient_id, event_id, kind, title, link)
  values (p_workspace, p_recipient, p_event, p_kind, left(p_title, 300), p_link);
end $$;

create or replace function public.task_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ev uuid;
  link text;
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from projects where id = old.project_id) then
      perform log_activity(old.workspace_id, old.project_id, 'task', old.id, 'task_deleted', jsonb_build_object('title', old.title));
    end if;
    return old;
  end if;

  link := '/projects/' || new.project_id || '?task=' || new.id;

  if tg_op = 'INSERT' then
    ev := log_activity(new.workspace_id, new.project_id, 'task', new.id, 'task_created', jsonb_build_object('title', new.title));
    if new.assignee_id is not null then
      perform notify(new.workspace_id, new.assignee_id, ev, 'task_assigned', 'You were assigned “' || new.title || '”', link);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    ev := log_activity(new.workspace_id, new.project_id, 'task', new.id,
      case when new.status = 'done' then 'task_completed' when old.status = 'done' then 'task_reopened' else 'task_status_changed' end,
      jsonb_build_object('title', new.title, 'from', old.status, 'to', new.status));
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    ev := log_activity(new.workspace_id, new.project_id, 'task', new.id, 'task_assigned',
      jsonb_build_object('title', new.title, 'from', old.assignee_id, 'to', new.assignee_id));
    perform notify(new.workspace_id, new.assignee_id, ev, 'task_assigned', 'You were assigned “' || new.title || '”', link);
    perform notify(new.workspace_id, old.assignee_id, ev, 'task_reassigned', '“' || new.title || '” was reassigned', link);
  end if;
  if new.due_date is distinct from old.due_date then
    perform log_activity(new.workspace_id, new.project_id, 'task', new.id, 'task_due_changed',
      jsonb_build_object('title', new.title, 'from', old.due_date, 'to', new.due_date));
  end if;
  if new.priority is distinct from old.priority then
    perform log_activity(new.workspace_id, new.project_id, 'task', new.id, 'task_priority_changed',
      jsonb_build_object('title', new.title, 'from', old.priority, 'to', new.priority));
  end if;
  if new.title is distinct from old.title or new.description is distinct from old.description
     or new.estimate_hours is distinct from old.estimate_hours or new.start_date is distinct from old.start_date then
    perform log_activity(new.workspace_id, new.project_id, 'task', new.id, 'task_updated',
      jsonb_build_object('title', new.title));
  end if;
  return new;
end $$;
create trigger tasks_activity after insert or update or delete on public.tasks for each row execute function public.task_activity();

create or replace function public.dependency_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if not exists (select 1 from projects where id = r.project_id) then
    return r;
  end if;
  perform log_activity(r.workspace_id, r.project_id, 'dependency', r.successor_id,
    case when tg_op = 'DELETE' then 'dependency_removed' else 'dependency_added' end,
    jsonb_build_object(
      'predecessor', (select title from tasks where id = r.predecessor_id),
      'successor', (select title from tasks where id = r.successor_id)));
  return r;
end $$;
create trigger task_dependencies_activity after insert or delete on public.task_dependencies for each row execute function public.dependency_activity();

create or replace function public.comment_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  ev uuid;
begin
  select id, project_id, title, assignee_id, creator_id into t from tasks where id = new.task_id;
  ev := log_activity(new.workspace_id, t.project_id, 'comment', t.id, 'comment_added',
    jsonb_build_object('title', t.title, 'excerpt', left(new.content, 140)));
  perform notify(new.workspace_id, t.assignee_id, ev, 'comment', 'New comment on “' || t.title || '”', '/projects/' || t.project_id || '?task=' || t.id);
  if t.creator_id is distinct from t.assignee_id then
    perform notify(new.workspace_id, t.creator_id, ev, 'comment', 'New comment on “' || t.title || '”', '/projects/' || t.project_id || '?task=' || t.id);
  end if;
  return new;
end $$;
create trigger comments_activity after insert on public.comments for each row execute function public.comment_activity();

create or replace function public.project_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform log_activity(old.workspace_id, null, 'project', old.id, 'project_deleted', jsonb_build_object('name', old.name));
    return old;
  end if;
  if tg_op = 'INSERT' then
    perform log_activity(new.workspace_id, new.id, 'project', new.id, 'project_created', jsonb_build_object('name', new.name));
    return new;
  end if;
  if new.deadline is distinct from old.deadline then
    perform log_activity(new.workspace_id, new.id, 'project', new.id, 'project_deadline_changed',
      jsonb_build_object('name', new.name, 'from', old.deadline, 'to', new.deadline));
  end if;
  if new.archived_at is distinct from old.archived_at then
    perform log_activity(new.workspace_id, new.id, 'project', new.id,
      case when new.archived_at is null then 'project_restored' else 'project_archived' end, jsonb_build_object('name', new.name));
  end if;
  if new.status is distinct from old.status then
    perform log_activity(new.workspace_id, new.id, 'project', new.id, 'project_status_changed',
      jsonb_build_object('name', new.name, 'from', old.status, 'to', new.status));
  end if;
  if new.name is distinct from old.name or new.description is distinct from old.description
     or new.start_date is distinct from old.start_date or new.owner_id is distinct from old.owner_id then
    perform log_activity(new.workspace_id, new.id, 'project', new.id, 'project_updated', jsonb_build_object('name', new.name));
  end if;
  return new;
end $$;
create trigger projects_activity after insert or update or delete on public.projects for each row execute function public.project_activity();

create or replace function public.milestone_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ev uuid;
  m record;
begin
  if tg_op = 'INSERT' then
    perform log_activity(new.workspace_id, new.project_id, 'milestone', new.id, 'milestone_created', jsonb_build_object('name', new.name));
  elsif new.completed_at is distinct from old.completed_at then
    ev := log_activity(new.workspace_id, new.project_id, 'milestone', new.id,
      case when new.completed_at is null then 'milestone_reopened' else 'milestone_completed' end, jsonb_build_object('name', new.name));
    if new.completed_at is not null then
      for m in select user_id from project_members where project_id = new.project_id loop
        perform notify(new.workspace_id, m.user_id, ev, 'milestone_completed', 'Milestone “' || new.name || '” completed', '/projects/' || new.project_id);
      end loop;
    end if;
  elsif new.target_date is distinct from old.target_date then
    perform log_activity(new.workspace_id, new.project_id, 'milestone', new.id, 'milestone_rescheduled',
      jsonb_build_object('name', new.name, 'from', old.target_date, 'to', new.target_date));
  end if;
  return new;
end $$;
create trigger milestones_activity after insert or update on public.milestones for each row execute function public.milestone_activity();

-- ════════════════════════════════════════════════════════════════════════════
-- Transactional operations
-- ════════════════════════════════════════════════════════════════════════════

-- Creates a workspace and makes the caller its owner.
create or replace function public.create_workspace(p_name text, p_timezone text default 'Europe/London')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'Workspace name must be 1–80 characters' using errcode = '22023';
  end if;
  insert into workspaces (name, owner_id, settings)
  values (btrim(p_name), auth.uid(), jsonb_build_object('timezone', coalesce(nullif(p_timezone, ''), 'Europe/London')))
  returning id into ws;
  insert into workspace_members (workspace_id, user_id, role) values (ws, auth.uid(), 'owner');
  return ws;
end $$;

-- Creates a project with optional members, milestones, tasks and dependencies in one
-- transaction. Runs as the caller, so row-level security applies to every insert.
-- p_tasks: [{ key, title, priority, start_date, due_date, estimate_hours, assignee_id, depends_on: [key] }]
-- p_milestones: [{ name, target_date }]
create or replace function public.create_project(
  p_workspace uuid,
  p_name text,
  p_description text,
  p_start date,
  p_deadline date,
  p_owner uuid,
  p_members uuid[] default '{}',
  p_milestones jsonb default '[]'::jsonb,
  p_tasks jsonb default '[]'::jsonb
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  proj uuid;
  t jsonb;
  pred_key text;
  ids jsonb := '{}'::jsonb;
  new_id uuid;
  member uuid;
begin
  if not public.can_edit(p_workspace) then
    raise exception 'You do not have permission to create projects here' using errcode = '42501';
  end if;
  insert into projects (workspace_id, name, description, owner_id, created_by, start_date, deadline)
  values (p_workspace, btrim(p_name), coalesce(p_description, ''), coalesce(p_owner, auth.uid()), auth.uid(), p_start, p_deadline)
  returning id into proj;

  for member in select distinct unnest(array_append(array_append(coalesce(p_members, '{}'), auth.uid()), coalesce(p_owner, auth.uid()))) loop
    insert into project_members (project_id, user_id, workspace_id) values (proj, member, p_workspace) on conflict do nothing;
  end loop;

  for t in select * from jsonb_array_elements(coalesce(p_milestones, '[]'::jsonb)) loop
    insert into milestones (project_id, workspace_id, name, target_date)
    values (proj, p_workspace, t ->> 'name', nullif(t ->> 'target_date', '')::date);
  end loop;

  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    insert into tasks (project_id, workspace_id, title, priority, start_date, due_date, estimate_hours, assignee_id, creator_id)
    values (
      proj, p_workspace, t ->> 'title', coalesce(t ->> 'priority', 'medium'),
      nullif(t ->> 'start_date', '')::date, nullif(t ->> 'due_date', '')::date,
      nullif(t ->> 'estimate_hours', '')::numeric, nullif(t ->> 'assignee_id', '')::uuid, auth.uid())
    returning id into new_id;
    ids := ids || jsonb_build_object(t ->> 'key', new_id);
  end loop;

  for t in select * from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    for pred_key in select jsonb_array_elements_text(coalesce(t -> 'depends_on', '[]'::jsonb)) loop
      if ids ? pred_key then
        insert into task_dependencies (project_id, workspace_id, predecessor_id, successor_id, created_by)
        values (proj, p_workspace, (ids ->> pred_key)::uuid, (ids ->> (t ->> 'key'))::uuid, auth.uid());
      end if;
    end loop;
  end loop;

  return proj;
end $$;

-- Accepts an invitation by the sha256 hash of its token (hashing happens on the server).
create or replace function public.accept_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv invitations%rowtype;
  my_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  select * into inv from invitations where token_hash = p_token_hash for update;
  if not found or inv.revoked_at is not null then
    raise exception 'invitation_invalid: this invitation is not valid' using errcode = '22023';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation_used: this invitation has already been used' using errcode = '22023';
  end if;
  if inv.expires_at < now() then
    raise exception 'invitation_expired: this invitation has expired' using errcode = '22023';
  end if;
  if inv.email is not null then
    select email into my_email from profiles where id = auth.uid();
    if lower(coalesce(my_email, '')) <> lower(inv.email) then
      raise exception 'invitation_email: this invitation was sent to a different email address' using errcode = '22023';
    end if;
  end if;

  insert into workspace_members (workspace_id, user_id, role, status)
  values (inv.workspace_id, auth.uid(), inv.role, 'active')
  on conflict (workspace_id, user_id) do update
    set status = 'active',
        role = case when workspace_members.status = 'active' then workspace_members.role else excluded.role end,
        joined_at = case when workspace_members.status = 'active' then workspace_members.joined_at else now() end;

  update invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  perform log_activity(inv.workspace_id, null, 'member', auth.uid(), 'member_joined', jsonb_build_object('role', inv.role));
  return inv.workspace_id;
end $$;

create or replace function public.set_member_role(p_workspace uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor text := public.member_role(p_workspace);
  target text;
begin
  select role into target from workspace_members where workspace_id = p_workspace and user_id = p_user and status = 'active';
  if target is null then raise exception 'Member not found' using errcode = '22023'; end if;
  if p_role not in ('admin', 'member', 'viewer') then raise exception 'Invalid role' using errcode = '22023'; end if;
  if actor not in ('owner', 'admin') or target = 'owner'
     or ((target = 'admin' or p_role = 'admin') and actor <> 'owner') then
    raise exception 'You do not have permission to make this change' using errcode = '42501';
  end if;
  update workspace_members set role = p_role where workspace_id = p_workspace and user_id = p_user;
  perform log_activity(p_workspace, null, 'member', p_user, 'member_role_changed', jsonb_build_object('from', target, 'to', p_role));
end $$;

-- Removing a member (or leaving) keeps their history: memberships are marked removed,
-- completed work stays attributed, and their open tasks become unassigned so the
-- work is visibly unowned rather than silently lost.
create or replace function public.remove_member(p_workspace uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor text := public.member_role(p_workspace);
  target text;
begin
  select role into target from workspace_members where workspace_id = p_workspace and user_id = p_user and status = 'active';
  if target is null then raise exception 'Member not found' using errcode = '22023'; end if;
  if target = 'owner' then
    raise exception 'The workspace owner cannot be removed' using errcode = '42501';
  end if;
  if p_user <> auth.uid() and (actor not in ('owner', 'admin') or (target = 'admin' and actor <> 'owner')) then
    raise exception 'You do not have permission to remove this member' using errcode = '42501';
  end if;
  update workspace_members set status = 'removed' where workspace_id = p_workspace and user_id = p_user;
  delete from project_members where workspace_id = p_workspace and user_id = p_user;
  update tasks set assignee_id = null where workspace_id = p_workspace and assignee_id = p_user and status <> 'done';
  perform log_activity(p_workspace, null, 'member', p_user,
    case when p_user = auth.uid() then 'member_left' else 'member_removed' end, '{}'::jsonb);
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Row-level security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invitations enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.comments enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.pulse_assessments enable row level security;
alter table public.pulse_acknowledgements enable row level security;

create policy profiles_select on public.profiles for select using (public.can_see_profile(id));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy workspaces_select on public.workspaces for select using (public.is_member(id));
create policy workspaces_update on public.workspaces for update using (public.is_admin(id)) with check (public.is_admin(id));
create policy workspaces_delete on public.workspaces for delete using (public.member_role(id) = 'owner');

create policy members_select on public.workspace_members for select using (public.is_member(workspace_id));

create policy invitations_select on public.invitations for select using (public.is_admin(workspace_id));
create policy invitations_insert on public.invitations for insert with check (public.is_admin(workspace_id) and invited_by = auth.uid() and role <> 'owner');
create policy invitations_update on public.invitations for update using (public.is_admin(workspace_id)) with check (public.is_admin(workspace_id));

create policy projects_select on public.projects for select using (public.is_member(workspace_id));
create policy projects_insert on public.projects for insert with check (public.can_edit(workspace_id) and created_by = auth.uid());
create policy projects_update on public.projects for update using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));
create policy projects_delete on public.projects for delete using (public.is_admin(workspace_id) or (public.can_edit(workspace_id) and owner_id = auth.uid()));

create policy project_members_select on public.project_members for select using (public.is_member(workspace_id));
create policy project_members_insert on public.project_members for insert with check (public.can_edit(workspace_id));
create policy project_members_delete on public.project_members for delete using (public.can_edit(workspace_id));

create policy milestones_select on public.milestones for select using (public.is_member(workspace_id));
create policy milestones_insert on public.milestones for insert with check (public.can_edit(workspace_id));
create policy milestones_update on public.milestones for update using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));
create policy milestones_delete on public.milestones for delete using (public.can_edit(workspace_id));

create policy tasks_select on public.tasks for select using (public.is_member(workspace_id));
create policy tasks_insert on public.tasks for insert with check (public.can_edit(workspace_id) and creator_id = auth.uid());
create policy tasks_update on public.tasks for update using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));
create policy tasks_delete on public.tasks for delete using (public.can_edit(workspace_id));

create policy deps_select on public.task_dependencies for select using (public.is_member(workspace_id));
create policy deps_insert on public.task_dependencies for insert with check (public.can_edit(workspace_id));
create policy deps_delete on public.task_dependencies for delete using (public.can_edit(workspace_id));

create policy comments_select on public.comments for select using (public.is_member(workspace_id));
create policy comments_insert on public.comments for insert with check (public.can_edit(workspace_id) and author_id = auth.uid());
create policy comments_update on public.comments for update using (author_id = auth.uid() and public.can_edit(workspace_id)) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete using (author_id = auth.uid() or public.is_admin(workspace_id));

create policy activity_select on public.activity_events for select using (public.is_member(workspace_id));

create policy notifications_select on public.notifications for select using (recipient_id = auth.uid());
create policy notifications_update on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (recipient_id = auth.uid());

create policy pulse_select on public.pulse_assessments for select using (public.is_member(workspace_id));
create policy pulse_insert on public.pulse_assessments for insert with check (public.can_edit(workspace_id));
create policy pulse_update on public.pulse_assessments for update using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));

create policy pulse_ack_select on public.pulse_acknowledgements for select using (public.is_member(workspace_id));
create policy pulse_ack_insert on public.pulse_acknowledgements for insert with check (public.can_edit(workspace_id) and user_id = auth.uid());
create policy pulse_ack_delete on public.pulse_acknowledgements for delete using (public.can_edit(workspace_id));

-- Lock down direct function access; only authenticated users may call the public RPCs.
-- Internal helpers are callable only from triggers and other definer functions.
revoke execute on function public.log_activity(uuid, uuid, text, uuid, text, jsonb) from public;
revoke execute on function public.notify(uuid, uuid, uuid, text, text, text) from public;
do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function public.log_activity(uuid, uuid, text, uuid, text, jsonb) from %I', r);
      execute format('revoke execute on function public.notify(uuid, uuid, uuid, text, text, text) from %I', r);
    end if;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Realtime: stream changes to subscribed clients (RLS still applies).
-- ════════════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.tasks, public.task_dependencies, public.comments, public.notifications, public.milestones;
  end if;
end $$;
