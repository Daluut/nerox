"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppContext } from "../data/context";
import type { ActionResult } from "../data/types";
import { topologicalOrder } from "../domain/graph";
import { can, canDeleteProject } from "../domain/permissions";
import { createProjectSchema, dateOnly, milestoneSchema, projectSchema, projectStatusSchema, uuid } from "../validation";
import { err, friendlyError, ok, okVoid, parse, refresh } from "./util";

async function editableContext() {
  const ctx = await getAppContext();
  if (!can(ctx.role, "project.edit")) return { ctx, denied: err("Viewers can't make changes. Ask an admin for member access.") };
  return { ctx, denied: null };
}

export async function createProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const v = parse(createProjectSchema, input);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  if (!can(ctx.role, "project.create")) return err("Viewers can't create projects.");
  const d = v.data;

  const keys = d.tasks.map((t) => t.key);
  if (new Set(keys).size !== keys.length) return err("Task keys must be unique.");
  const deps = d.tasks.flatMap((t) => t.dependsOn.filter((k) => keys.includes(k)).map((p) => ({ predecessorId: p, successorId: t.key })));
  if (!topologicalOrder(keys, deps)) return err("The starting tasks contain a circular dependency.");
  for (const t of d.tasks) if (t.startDate && t.dueDate && t.startDate > t.dueDate) return err(`“${t.title}” is due before it starts.`);

  const active = new Set(ctx.members.filter((m) => m.status === "active").map((m) => m.userId));
  if (d.ownerId && !active.has(d.ownerId)) return err("The project owner must be a workspace member.");

  const { data, error } = await ctx.supabase.rpc("create_project", {
    p_workspace: ctx.workspace.id,
    p_name: d.name,
    p_description: d.description,
    p_start: d.startDate,
    p_deadline: d.deadline,
    p_owner: d.ownerId ?? ctx.userId,
    p_members: d.memberIds.filter((id) => active.has(id)),
    p_milestones: d.milestones.map((m) => ({ name: m.name, target_date: m.targetDate })),
    p_tasks: d.tasks.map((t) => ({
      key: t.key,
      title: t.title,
      priority: t.priority,
      start_date: t.startDate,
      due_date: t.dueDate,
      estimate_hours: t.estimateHours,
      depends_on: t.dependsOn,
    })),
  });
  if (error) return err(friendlyError(error, "Couldn't create the project. Please try again."));
  refresh();
  return ok({ id: data as string });
}

export async function updateProject(projectId: string, input: unknown): Promise<ActionResult> {
  const id = parse(uuid, projectId);
  const v = parse(projectSchema, input);
  if (!id.ok) return id;
  if (!v.ok) return v;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error, count } = await ctx.supabase
    .from("projects")
    .update(
      { name: v.data.name, description: v.data.description, start_date: v.data.startDate, deadline: v.data.deadline, owner_id: v.data.ownerId },
      { count: "exact" },
    )
    .eq("id", id.data);
  if (error) return err(friendlyError(error));
  if (!count) return err("That project no longer exists.");
  if (v.data.ownerId) {
    await ctx.supabase.from("project_members").upsert({ project_id: id.data, user_id: v.data.ownerId }, { onConflict: "project_id,user_id", ignoreDuplicates: true });
  }
  refresh();
  return okVoid();
}

export async function setProjectArchived(projectId: string, archived: boolean): Promise<ActionResult> {
  const id = parse(uuid, projectId);
  if (!id.ok) return id;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error } = await ctx.supabase.from("projects").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function setProjectStatus(projectId: string, status: string): Promise<ActionResult> {
  const id = parse(uuid, projectId);
  const s = parse(projectStatusSchema, status);
  if (!id.ok) return id;
  if (!s.ok) return s;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error } = await ctx.supabase
    .from("projects")
    .update({ status: s.data, completed_at: s.data === "completed" ? new Date().toISOString() : null })
    .eq("id", id.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function deleteProject(projectId: string, confirmName: string): Promise<ActionResult> {
  const id = parse(uuid, projectId);
  if (!id.ok) return id;
  const ctx = await getAppContext();
  const { data: project } = await ctx.supabase.from("projects").select("name, owner_id").eq("id", id.data).maybeSingle();
  if (!project) return err("That project no longer exists.");
  if (!canDeleteProject(ctx.role, ctx.userId, project.owner_id)) return err("Only admins or the project owner can delete this project.");
  if (confirmName.trim() !== project.name) return err("Type the project name exactly to confirm.");
  const { error, count } = await ctx.supabase.from("projects").delete({ count: "exact" }).eq("id", id.data);
  if (error) return err(friendlyError(error));
  if (!count) return err("You don't have permission to do that.");
  refresh();
  redirect("/projects");
}

export async function setProjectMember(projectId: string, userId: string, member: boolean): Promise<ActionResult> {
  const v = parse(z.object({ projectId: uuid, userId: uuid }), { projectId, userId });
  if (!v.ok) return v;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error } = member
    ? await ctx.supabase.from("project_members").upsert({ project_id: v.data.projectId, user_id: v.data.userId }, { onConflict: "project_id,user_id", ignoreDuplicates: true })
    : await ctx.supabase.from("project_members").delete().eq("project_id", v.data.projectId).eq("user_id", v.data.userId);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function createMilestone(input: unknown): Promise<ActionResult> {
  const v = parse(milestoneSchema, input);
  if (!v.ok) return v;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error } = await ctx.supabase.from("milestones").insert({ project_id: v.data.projectId, name: v.data.name, target_date: v.data.targetDate });
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function updateMilestone(milestoneId: string, input: { name?: string; targetDate?: string | null; completed?: boolean }): Promise<ActionResult> {
  const id = parse(uuid, milestoneId);
  const v = parse(z.object({ name: z.string().trim().min(1).max(120).optional(), targetDate: dateOnly.optional(), completed: z.boolean().optional() }).strict(), input);
  if (!id.ok) return id;
  if (!v.ok) return v;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const patch: Record<string, unknown> = {};
  if (v.data.name !== undefined) patch.name = v.data.name;
  if (v.data.targetDate !== undefined) patch.target_date = v.data.targetDate;
  if (v.data.completed !== undefined) patch.completed_at = v.data.completed ? new Date().toISOString() : null;
  const { error } = await ctx.supabase.from("milestones").update(patch).eq("id", id.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function deleteMilestone(milestoneId: string): Promise<ActionResult> {
  const id = parse(uuid, milestoneId);
  if (!id.ok) return id;
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error } = await ctx.supabase.from("milestones").delete().eq("id", id.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function acknowledgeRisk(projectId: string, riskId: string, acknowledged: boolean): Promise<ActionResult> {
  const id = parse(uuid, projectId);
  if (!id.ok) return id;
  if (typeof riskId !== "string" || !riskId || riskId.length > 200) return err("Invalid insight.");
  const { ctx, denied } = await editableContext();
  if (denied) return denied;
  const { error } = acknowledged
    ? await ctx.supabase.from("pulse_acknowledgements").upsert({ project_id: id.data, risk_id: riskId, user_id: ctx.userId }, { onConflict: "project_id,risk_id", ignoreDuplicates: true })
    : await ctx.supabase.from("pulse_acknowledgements").delete().eq("project_id", id.data).eq("risk_id", riskId);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}
