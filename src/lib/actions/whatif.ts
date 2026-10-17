"use server";

import { z } from "zod";
import { getAppContext } from "../data/context";
import { loadProjectBundle } from "../data/queries";
import type { ActionResult, ProjectBundle } from "../data/types";
import { isValidDateOnly } from "../domain/dates";
import { can } from "../domain/permissions";
import { fingerprint, simulate, type Change, type SimInput, type SimResult } from "../whatif/engine";
import { uuid } from "../validation";
import { err, friendlyError, ok, okVoid, parse, refresh } from "./util";

const date = z.string().refine(isValidDateOnly, "Enter a valid date.");
const changeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("delay"), taskId: uuid, days: z.number().int().min(1).max(365) }),
  z.object({ kind: z.literal("finish_early"), taskId: uuid, days: z.number().int().min(1).max(365) }),
  z.object({ kind: z.literal("duration"), taskId: uuid, factor: z.number().min(0.1).max(10) }),
  z.object({ kind: z.literal("reassign"), taskId: uuid, toUserId: uuid.nullable(), handoverDays: z.number().int().min(0).max(30) }),
  z.object({ kind: z.literal("unavailable"), userId: uuid, from: date, days: z.number().int().min(1).max(365) }),
  z.object({ kind: z.literal("deadline"), date: date.nullable() }),
]);
const changesSchema = z.array(changeSchema).min(1, "Add at least one change.").max(20);

async function simInput(projectId: string): Promise<{ input: SimInput; bundle: ProjectBundle; ctx: Awaited<ReturnType<typeof getAppContext>> }> {
  const ctx = await getAppContext();
  const bundle = await loadProjectBundle(ctx, projectId);
  const memberIds = [...new Set([...bundle.memberIds, ...ctx.members.filter((m) => m.status === "active").map((m) => m.userId)])];
  const input: SimInput = {
    project: { id: bundle.project.id, name: bundle.project.name, startDate: bundle.project.startDate, deadline: bundle.project.deadline, status: bundle.project.status, createdAt: bundle.project.createdAt },
    tasks: bundle.tasks,
    dependencies: bundle.dependencies,
    milestones: bundle.milestones,
    members: memberIds.map((id) => ({ userId: id, name: ctx.members.find((m) => m.userId === id)?.name ?? "Former member" })),
    today: ctx.today,
    timeZone: ctx.timezone,
    now: new Date(),
    config: ctx.pulseConfig,
  };
  return { input, bundle, ctx };
}

export async function runScenario(projectId: string, changes: unknown): Promise<ActionResult<SimResult & { fingerprint: string }>> {
  const id = parse(uuid, projectId);
  const v = parse(changesSchema, changes);
  if (!id.ok) return id;
  if (!v.ok) return v;
  const { input, bundle } = await simInput(id.data);
  const result = simulate(input, v.data as Change[]);
  return ok({ ...result, fingerprint: fingerprint(bundle.project, bundle.tasks, bundle.dependencies) });
}

export async function saveScenario(projectId: string, name: string, changes: unknown): Promise<ActionResult<{ id: string }>> {
  const id = parse(uuid, projectId);
  const n = parse(z.string().trim().min(1, "Give the scenario a name.").max(120), name);
  const v = parse(changesSchema, changes);
  if (!id.ok) return id;
  if (!n.ok) return n;
  if (!v.ok) return v;
  const { input, bundle, ctx } = await simInput(id.data);
  if (!can(ctx.role, "project.edit")) return err("Viewers can't save scenarios.");
  const r = simulate(input, v.data as Change[]);
  if (!r.valid) return err(r.errors[0]);
  const { data, error } = await ctx.supabase
    .from("scenarios")
    .insert({
      project_id: id.data,
      creator_id: ctx.userId,
      name: n.data,
      changes: v.data,
      baseline_fingerprint: fingerprint(bundle.project, bundle.tasks, bundle.dependencies),
      results: { summary: r.summary, finishShiftDays: r.finishShiftDays, scenarioFinish: r.scenarioFinish, moved: r.moves.length, healthBefore: r.health.before, healthAfter: r.health.after },
    })
    .select("id")
    .single();
  if (error) return err(friendlyError(error));
  refresh();
  return ok({ id: data.id as string });
}

export async function deleteScenario(scenarioId: string): Promise<ActionResult> {
  const id = parse(uuid, scenarioId);
  if (!id.ok) return id;
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.from("scenarios").delete().eq("id", id.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

/**
 * Applies a scenario to the real project. It's re-simulated against the live data
 * first and refused if the project changed since the person last looked, so what
 * they confirmed is exactly what gets written.
 */
export async function applyScenario(projectId: string, changes: unknown, expectedFingerprint: string, scenarioId?: string | null): Promise<ActionResult<{ updated: number }>> {
  const id = parse(uuid, projectId);
  const v = parse(changesSchema, changes);
  if (!id.ok) return id;
  if (!v.ok) return v;
  const { input, bundle, ctx } = await simInput(id.data);
  if (!can(ctx.role, "project.edit")) return err("Viewers can't change projects.");
  if (fingerprint(bundle.project, bundle.tasks, bundle.dependencies) !== expectedFingerprint) {
    return err("The project has changed since this simulation was run. Run it again to see the up-to-date result, then apply.");
  }
  const r = simulate(input, v.data as Change[]);
  if (!r.valid) return err(r.errors[0]);
  const updates = r.updates.map((u) => ({
    task_id: u.taskId,
    ...(u.startDate !== undefined ? { start_date: u.startDate } : {}),
    ...(u.dueDate !== undefined ? { due_date: u.dueDate } : {}),
    ...(u.assigneeId !== undefined ? { assignee_id: u.assigneeId } : {}),
  }));
  const { error } = await ctx.supabase.rpc("apply_scenario", {
    p_project: id.data,
    p_updates: updates,
    p_set_deadline: !!r.projectDeadlineUpdate,
    p_deadline: r.projectDeadlineUpdate?.to ?? null,
  });
  if (error) return err(friendlyError(error, "Couldn't apply the scenario. Nothing was changed."));
  if (scenarioId && uuid.safeParse(scenarioId).success) {
    await ctx.supabase.from("scenarios").update({ applied_at: new Date().toISOString(), applied_by: ctx.userId }).eq("id", scenarioId);
  }
  refresh();
  return ok({ updated: updates.length });
}
