"use server";

import { getAppContext, memberName } from "../data/context";
import { TASK_COLUMNS, toDependency, toTask } from "../data/mappers";
import { loadActivity, loadComments } from "../data/queries";
import type { ActionResult, ActivityEvent, Comment, Dependency, Task } from "../data/types";
import { checkNewDependency } from "../domain/graph";
import { can } from "../domain/permissions";
import { commentSchema, createTaskSchema, updateTaskSchema, uuid } from "../validation";
import { err, friendlyError, ok, okVoid, parse, refresh } from "./util";

async function writableContext() {
  const ctx = await getAppContext();
  if (!can(ctx.role, "task.write")) return { ctx, denied: err("Viewers can't make changes. Ask an admin for member access.") };
  return { ctx, denied: null };
}

export async function createTask(input: unknown): Promise<ActionResult<{ id: string; projectId: string }>> {
  const v = parse(createTaskSchema, input);
  if (!v.ok) return v;
  const { ctx, denied } = await writableContext();
  if (denied) return denied;
  const d = v.data;
  const { data, error } = await ctx.supabase
    .from("tasks")
    .insert({
      project_id: d.projectId,
      title: d.title,
      description: d.description,
      status: d.status,
      priority: d.priority,
      assignee_id: d.assigneeId,
      start_date: d.startDate,
      due_date: d.dueDate,
      estimate_hours: d.estimateHours,
      milestone_id: d.milestoneId,
      creator_id: ctx.userId,
    })
    .select("id, project_id")
    .single();
  if (error) return err(friendlyError(error, "Couldn't create the task. Please try again."));
  refresh();
  return ok({ id: data.id as string, projectId: data.project_id as string });
}

/** Partial update. Only fields present in `patch` change; the database records history. */
export async function updateTask(taskId: string, patch: unknown): Promise<ActionResult<Task>> {
  const id = parse(uuid, taskId);
  const v = parse(updateTaskSchema, patch);
  if (!id.ok) return id;
  if (!v.ok) return v;
  const { ctx, denied } = await writableContext();
  if (denied) return denied;
  const p = v.data;
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.description !== undefined) row.description = p.description;
  if (p.status !== undefined) row.status = p.status;
  if (p.priority !== undefined) row.priority = p.priority;
  if (p.assigneeId !== undefined) row.assignee_id = p.assigneeId;
  if (p.startDate !== undefined) row.start_date = p.startDate;
  if (p.dueDate !== undefined) row.due_date = p.dueDate;
  if (p.estimateHours !== undefined) row.estimate_hours = p.estimateHours;
  if (p.actualHours !== undefined) row.actual_hours = p.actualHours;
  if (p.milestoneId !== undefined) row.milestone_id = p.milestoneId;
  if (p.labels !== undefined) row.labels = [...new Set(p.labels)];
  if (!Object.keys(row).length) return err("Nothing to update.");

  if (row.start_date !== undefined || row.due_date !== undefined) {
    const { data: current } = await ctx.supabase.from("tasks").select("start_date, due_date").eq("id", id.data).maybeSingle();
    if (!current) return err("That task no longer exists.");
    const start = (row.start_date !== undefined ? row.start_date : current.start_date) as string | null;
    const due = (row.due_date !== undefined ? row.due_date : current.due_date) as string | null;
    if (start && due && start > due) return err("The due date must be on or after the start date.", { dueDate: "Must be on or after the start date." });
  }

  const { data, error } = await ctx.supabase.from("tasks").update(row).eq("id", id.data).select(TASK_COLUMNS).maybeSingle();
  if (error) return err(friendlyError(error, "Couldn't update the task. Please try again."));
  if (!data) return err("That task no longer exists, or you can't edit it.");
  refresh();
  return ok(toTask(data));
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const id = parse(uuid, taskId);
  if (!id.ok) return id;
  const { ctx, denied } = await writableContext();
  if (denied) return denied;
  const { error, count } = await ctx.supabase.from("tasks").delete({ count: "exact" }).eq("id", id.data);
  if (error) return err(friendlyError(error));
  if (!count) return err("That task no longer exists.");
  refresh();
  return okVoid();
}

export async function addDependency(predecessorId: string, successorId: string): Promise<ActionResult> {
  const a = parse(uuid, predecessorId);
  const b = parse(uuid, successorId);
  if (!a.ok) return a;
  if (!b.ok) return b;
  const { ctx, denied } = await writableContext();
  if (denied) return denied;
  const { data: succ } = await ctx.supabase.from("tasks").select("project_id").eq("id", b.data).maybeSingle();
  if (!succ) return err("That task no longer exists.");
  const { data: deps } = await ctx.supabase.from("task_dependencies").select("predecessor_id, successor_id").eq("project_id", succ.project_id);
  const check = checkNewDependency(
    a.data,
    b.data,
    (deps ?? []).map((d) => ({ predecessorId: d.predecessor_id as string, successorId: d.successor_id as string })),
  );
  if (!check.ok) return err(check.message);
  // The database re-checks for cycles inside the insert, which also covers concurrent edits.
  const { error } = await ctx.supabase.from("task_dependencies").insert({ predecessor_id: a.data, successor_id: b.data, project_id: succ.project_id, created_by: ctx.userId });
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function removeDependency(dependencyId: string): Promise<ActionResult> {
  const id = parse(uuid, dependencyId);
  if (!id.ok) return id;
  const { ctx, denied } = await writableContext();
  if (denied) return denied;
  const { error } = await ctx.supabase.from("task_dependencies").delete().eq("id", id.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function addComment(input: { taskId: string; content: string }): Promise<ActionResult> {
  const v = parse(commentSchema, input);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  if (!can(ctx.role, "comment.write")) return err("Viewers can't comment.");
  const { error } = await ctx.supabase.from("comments").insert({ task_id: v.data.taskId, content: v.data.content, author_id: ctx.userId });
  if (error) return err(friendlyError(error, "Couldn't post the comment. Please try again."));
  refresh();
  return okVoid();
}

export async function deleteComment(commentId: string): Promise<ActionResult> {
  const id = parse(uuid, commentId);
  if (!id.ok) return id;
  const ctx = await getAppContext();
  const { error, count } = await ctx.supabase.from("comments").delete({ count: "exact" }).eq("id", id.data);
  if (error) return err(friendlyError(error));
  if (!count) return err("You can only delete your own comments.");
  refresh();
  return okVoid();
}

export interface TaskDetail {
  task: Task;
  projectName: string;
  projectTasks: Pick<Task, "id" | "title" | "status" | "dueDate">[];
  dependencies: Dependency[];
  milestones: { id: string; name: string }[];
  comments: (Comment & { authorName: string })[];
  history: (ActivityEvent & { actorName: string })[];
}

/** Everything the task drawer shows, read in one round trip. */
export async function getTaskDetail(taskId: string): Promise<ActionResult<TaskDetail>> {
  const id = parse(uuid, taskId);
  if (!id.ok) return id;
  const ctx = await getAppContext();
  const { data: row } = await ctx.supabase.from("tasks").select(TASK_COLUMNS).eq("id", id.data).maybeSingle();
  if (!row || row.workspace_id !== ctx.workspace.id) return err("That task doesn't exist or isn't in this workspace.");
  const task = toTask(row);
  const [project, siblings, deps, ms, comments, history] = await Promise.all([
    ctx.supabase.from("projects").select("name").eq("id", task.projectId).single(),
    ctx.supabase.from("tasks").select("id, title, status, due_date").eq("project_id", task.projectId).order("created_at"),
    ctx.supabase.from("task_dependencies").select("id, project_id, predecessor_id, successor_id").eq("project_id", task.projectId),
    ctx.supabase.from("milestones").select("id, name").eq("project_id", task.projectId).order("target_date"),
    loadComments(ctx, task.id),
    loadActivity(ctx, { entityId: task.id, limit: 40 }),
  ]);
  return ok({
    task,
    projectName: project.data?.name ?? "",
    projectTasks: (siblings.data ?? []).map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: t.due_date })),
    dependencies: (deps.data ?? []).map(toDependency),
    milestones: ms.data ?? [],
    comments: comments.map((c) => ({ ...c, authorName: memberName(ctx, c.authorId) })),
    history: history.filter((h) => h.entityType === "task" || h.entityType === "dependency").map((h) => ({ ...h, actorName: memberName(ctx, h.actorId) })),
  });
}
