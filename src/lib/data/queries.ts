import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { can } from "../domain/permissions";
import { assessProject } from "../pulse/engine";
import type { Assessment } from "../pulse/types";
import type { AppContext } from "./context";
import {
  PROJECT_COLUMNS,
  TASK_COLUMNS,
  toActivity,
  toComment,
  toDependency,
  toMilestone,
  toNotification,
  toProject,
  toSnapshot,
  toTask,
} from "./mappers";
import type { ActivityEvent, Dependency, Milestone, Project, ProjectBundle, Snapshot, Task } from "./types";

function fail(what: string, error: { message: string } | null): never {
  console.error(`[nerox] failed to load ${what}:`, error?.message);
  throw new Error(`Couldn't load ${what}. Please try again.`);
}

/** Runs Pulse for a project — the single place every screen gets its health data from. */
export function assess(
  ctx: AppContext,
  project: Project,
  tasks: Task[],
  dependencies: Dependency[],
  milestones: Milestone[],
  memberIds: string[],
): Assessment {
  return assessProject({
    project: { id: project.id, name: project.name, startDate: project.startDate, deadline: project.deadline, status: project.status, createdAt: project.createdAt },
    tasks,
    dependencies,
    milestones,
    members: memberIds.map((id) => ({ userId: id, name: ctx.members.find((m) => m.userId === id)?.name ?? "Former member" })),
    today: ctx.today,
    timeZone: ctx.timezone,
    now: new Date(),
    config: ctx.pulseConfig,
  });
}

function bundle(ctx: AppContext, project: Project, tasks: Task[], deps: Dependency[], milestones: Milestone[], memberIds: string[]): ProjectBundle {
  return { project, tasks, dependencies: deps, milestones, memberIds, assessment: assess(ctx, project, tasks, deps, milestones, memberIds) };
}

const groupBy = <T,>(items: T[], key: (t: T) => string) => {
  const m = new Map<string, T[]>();
  for (const i of items) {
    const k = key(i);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(i);
  }
  return m;
};

/** Every project in the current workspace with its tasks and a live Pulse assessment. */
export const loadWorkspaceBundles = cache(async (ctx: AppContext): Promise<ProjectBundle[]> => {
  const s = ctx.supabase;
  const wsId = ctx.workspace.id;
  const [p, t, d, m, pm] = await Promise.all([
    s.from("projects").select(PROJECT_COLUMNS).eq("workspace_id", wsId).order("created_at"),
    s.from("tasks").select(TASK_COLUMNS).eq("workspace_id", wsId),
    s.from("task_dependencies").select("id, project_id, predecessor_id, successor_id").eq("workspace_id", wsId),
    s.from("milestones").select("id, project_id, name, description, target_date, completed_at").eq("workspace_id", wsId).order("target_date"),
    s.from("project_members").select("project_id, user_id").eq("workspace_id", wsId),
  ]);
  if (p.error) fail("projects", p.error);
  if (t.error) fail("tasks", t.error);
  if (d.error) fail("dependencies", d.error);
  if (m.error) fail("milestones", m.error);
  if (pm.error) fail("project members", pm.error);

  const tasks = groupBy((t.data ?? []).map(toTask), (x) => x.projectId);
  const deps = groupBy((d.data ?? []).map(toDependency), (x) => x.projectId);
  const ms = groupBy((m.data ?? []).map(toMilestone), (x) => x.projectId);
  const members = groupBy(pm.data ?? [], (x) => x.project_id as string);
  return (p.data ?? []).map(toProject).map((project) =>
    bundle(
      ctx,
      project,
      tasks.get(project.id) ?? [],
      deps.get(project.id) ?? [],
      ms.get(project.id) ?? [],
      (members.get(project.id) ?? []).map((x) => x.user_id as string),
    ),
  );
});

export const loadProjectBundle = cache(async (ctx: AppContext, projectId: string): Promise<ProjectBundle> => {
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) notFound();
  const s = ctx.supabase;
  const { data: row, error } = await s.from("projects").select(PROJECT_COLUMNS).eq("id", projectId).maybeSingle();
  if (error) fail("the project", error);
  if (!row || row.workspace_id !== ctx.workspace.id) notFound(); // RLS hides other workspaces; this keeps the switcher honest
  const [t, d, m, pm] = await Promise.all([
    s.from("tasks").select(TASK_COLUMNS).eq("project_id", projectId).order("created_at"),
    s.from("task_dependencies").select("id, project_id, predecessor_id, successor_id").eq("project_id", projectId),
    s.from("milestones").select("id, project_id, name, description, target_date, completed_at").eq("project_id", projectId).order("target_date"),
    s.from("project_members").select("user_id").eq("project_id", projectId),
  ]);
  if (t.error) fail("tasks", t.error);
  if (d.error) fail("dependencies", d.error);
  if (m.error) fail("milestones", m.error);
  return bundle(
    ctx,
    toProject(row),
    (t.data ?? []).map(toTask),
    (d.data ?? []).map(toDependency),
    (m.data ?? []).map(toMilestone),
    (pm.data ?? []).map((x) => x.user_id as string),
  );
});

export async function loadActivity(
  ctx: AppContext,
  opts: { projectId?: string; entityId?: string; limit?: number } = {},
): Promise<ActivityEvent[]> {
  let q = ctx.supabase
    .from("activity_events")
    .select("id, project_id, actor_id, entity_type, entity_id, event_type, data, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 30);
  if (opts.projectId) q = q.eq("project_id", opts.projectId);
  if (opts.entityId) q = q.eq("entity_id", opts.entityId);
  const { data, error } = await q;
  if (error) fail("activity", error);
  return (data ?? []).map(toActivity);
}

export async function loadComments(ctx: AppContext, taskId: string) {
  const { data, error } = await ctx.supabase
    .from("comments")
    .select("id, task_id, author_id, content, created_at, updated_at")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) fail("comments", error);
  return (data ?? []).map(toComment);
}

export async function loadSnapshots(ctx: AppContext, projectId: string, limit = 60): Promise<Snapshot[]> {
  const { data, error } = await ctx.supabase
    .from("pulse_assessments")
    .select("snapshot_date, score, status, assessed_at, algorithm_version")
    .eq("project_id", projectId)
    .order("snapshot_date", { ascending: false })
    .limit(limit);
  if (error) fail("Pulse history", error);
  return (data ?? []).map(toSnapshot).reverse();
}

export async function loadAcknowledgements(ctx: AppContext, projectIds: string[]) {
  if (!projectIds.length) return new Map<string, { userId: string; at: string }>();
  const { data, error } = await ctx.supabase
    .from("pulse_acknowledgements")
    .select("project_id, risk_id, user_id, acknowledged_at")
    .in("project_id", projectIds);
  if (error) fail("acknowledgements", error);
  return new Map((data ?? []).map((r) => [`${r.project_id}:${r.risk_id}`, { userId: r.user_id as string, at: r.acknowledged_at as string }]));
}

/**
 * Stores today's assessment for each active project (one row per project per day,
 * replaced through the day). This is what Pulse history is built from — trends are
 * never interpolated between stored snapshots.
 */
export async function recordSnapshots(ctx: AppContext, bundles: ProjectBundle[]) {
  if (!can(ctx.role, "pulse.snapshot")) return;
  const rows = bundles
    .filter((b) => !b.project.archivedAt && b.project.status !== "completed")
    .map((b) => ({
      project_id: b.project.id,
      workspace_id: ctx.workspace.id,
      snapshot_date: ctx.today,
      score: b.assessment.score,
      status: b.assessment.status,
      confidence: b.assessment.confidence,
      factors: b.assessment.factors.map((f) => ({ key: f.key, score: f.score, weight: f.weight, available: f.available, quality: f.quality })),
      risks: b.assessment.risks.map((r) => ({ id: r.id, kind: r.kind, severity: r.severity, basis: r.basis, title: r.title })),
      algorithm_version: b.assessment.algorithmVersion,
      assessed_at: b.assessment.assessedAt,
    }));
  if (!rows.length) return;
  const { error } = await ctx.supabase.from("pulse_assessments").upsert(rows, { onConflict: "project_id,snapshot_date" });
  if (error) console.error("[nerox] failed to record Pulse snapshot:", error.message);
}

export async function loadNotifications(ctx: AppContext) {
  const { data } = await ctx.supabase
    .from("notifications")
    .select("id, kind, title, link, read_at, created_at")
    .eq("workspace_id", ctx.workspace.id)
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map(toNotification);
}

export async function loadInvitations(ctx: AppContext) {
  if (!can(ctx.role, "members.invite")) return [];
  const { data, error } = await ctx.supabase
    .from("invitations")
    .select("id, email, role, expires_at, created_at, invited_by")
    .eq("workspace_id", ctx.workspace.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) fail("invitations", error);
  return data ?? [];
}
