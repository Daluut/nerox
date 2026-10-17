-- ════════════════════════════════════════════════════════════════════════════
-- Nerox — What If? scenarios and Nerox Memory
-- ════════════════════════════════════════════════════════════════════════════

-- Saved What If? scenarios. A scenario stores its inputs and a summary of the
-- result, plus a fingerprint of the project as it was, so the app can tell when
-- the live project has changed and the scenario should be re-run.
create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  creator_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  changes jsonb not null,
  baseline_fingerprint text not null,
  results jsonb not null,
  applied_at timestamptz,
  applied_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scenarios_project_idx on public.scenarios (project_id, created_at desc);
create trigger scenarios_ws before insert or update on public.scenarios for each row execute function public.inherit_workspace_from_project();
create trigger scenarios_updated before update on public.scenarios for each row execute function public.set_updated_at();

-- Team-written retrospective notes for a project. The facts (planned vs actual)
-- are computed from task data; these are the human reflections alongside them.
create table public.retrospectives (
  project_id uuid primary key references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  went_well text not null default '' check (char_length(went_well) <= 4000),
  to_improve text not null default '' check (char_length(to_improve) <= 4000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger retrospectives_ws before insert or update on public.retrospectives for each row execute function public.inherit_workspace_from_project();
create trigger retrospectives_updated before update on public.retrospectives for each row execute function public.set_updated_at();

-- People can dismiss a Memory insight they don't find useful. Insights are
-- recomputed from data, so only the dismissal is stored, keyed by insight id.
create table public.memory_dismissals (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  insight_key text not null check (char_length(insight_key) <= 200),
  dismissed_by uuid references public.profiles (id) on delete set null,
  dismissed_at timestamptz not null default now(),
  primary key (workspace_id, insight_key)
);

alter table public.scenarios enable row level security;
alter table public.retrospectives enable row level security;
alter table public.memory_dismissals enable row level security;

create policy scenarios_select on public.scenarios for select using (public.is_member(workspace_id));
create policy scenarios_insert on public.scenarios for insert with check (public.can_edit(workspace_id) and creator_id = auth.uid());
create policy scenarios_update on public.scenarios for update using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));
create policy scenarios_delete on public.scenarios for delete using (public.can_edit(workspace_id));

create policy retro_select on public.retrospectives for select using (public.is_member(workspace_id));
create policy retro_insert on public.retrospectives for insert with check (public.can_edit(workspace_id));
create policy retro_update on public.retrospectives for update using (public.can_edit(workspace_id)) with check (public.can_edit(workspace_id));

create policy dismiss_select on public.memory_dismissals for select using (public.is_member(workspace_id));
create policy dismiss_insert on public.memory_dismissals for insert with check (public.can_edit(workspace_id));
create policy dismiss_delete on public.memory_dismissals for delete using (public.can_edit(workspace_id));

-- Applies a What If? scenario's planned updates in one transaction, as the caller
-- (so row-level security still decides what they may change). Either every
-- change lands or none do.
create or replace function public.apply_scenario(p_project uuid, p_updates jsonb, p_set_deadline boolean, p_deadline date)
returns void language plpgsql security invoker set search_path = public as $$
declare
  u jsonb;
begin
  for u in select * from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb)) loop
    update tasks set
      start_date = case when u ? 'start_date' then nullif(u ->> 'start_date', '')::date else start_date end,
      due_date = case when u ? 'due_date' then nullif(u ->> 'due_date', '')::date else due_date end,
      assignee_id = case when u ? 'assignee_id' then nullif(u ->> 'assignee_id', '')::uuid else assignee_id end
    where id = (u ->> 'task_id')::uuid and project_id = p_project and status <> 'done';
    if not found then
      raise exception 'scenario_stale: a task in this scenario has changed or no longer exists' using errcode = '22023';
    end if;
  end loop;
  if p_set_deadline then
    update projects set deadline = p_deadline where id = p_project;
    if not found then
      raise exception 'You do not have permission to change this project' using errcode = '42501';
    end if;
  end if;
end $$;
