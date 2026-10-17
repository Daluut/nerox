"use server";

import { z } from "zod";
import { getAppContext } from "../data/context";
import { loadMemory } from "../data/memory";
import type { ActionResult } from "../data/types";
import { can } from "../domain/permissions";
import { planningSuggestions } from "../memory/engine";
import { uuid } from "../validation";
import { err, friendlyError, ok, okVoid, parse, refresh } from "./util";

export async function setInsightDismissed(key: string, dismissed: boolean): Promise<ActionResult> {
  const v = parse(z.string().min(1).max(200), key);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  if (!can(ctx.role, "task.write")) return err("Viewers can't change Memory.");
  const { error } = dismissed
    ? await ctx.supabase.from("memory_dismissals").upsert({ workspace_id: ctx.workspace.id, insight_key: v.data, dismissed_by: ctx.userId }, { onConflict: "workspace_id,insight_key", ignoreDuplicates: true })
    : await ctx.supabase.from("memory_dismissals").delete().eq("workspace_id", ctx.workspace.id).eq("insight_key", v.data);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function saveRetrospective(projectId: string, input: { wentWell: string; toImprove: string }): Promise<ActionResult> {
  const id = parse(uuid, projectId);
  const v = parse(z.object({ wentWell: z.string().max(4000), toImprove: z.string().max(4000) }), input);
  if (!id.ok) return id;
  if (!v.ok) return v;
  const ctx = await getAppContext();
  if (!can(ctx.role, "task.write")) return err("Viewers can't edit retrospectives.");
  const { data: existing } = await ctx.supabase.from("retrospectives").select("project_id").eq("project_id", id.data).maybeSingle();
  const row = { went_well: v.data.wentWell, to_improve: v.data.toImprove, updated_by: ctx.userId };
  const { error } = existing
    ? await ctx.supabase.from("retrospectives").update(row).eq("project_id", id.data)
    : await ctx.supabase.from("retrospectives").insert({ project_id: id.data, ...row });
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

/** Memory's estimate lessons that apply to tasks someone is about to create. */
export async function getPlanningSuggestions(titles: string[]) {
  if (!Array.isArray(titles) || titles.length > 200) return ok([]);
  const ctx = await getAppContext();
  const { report, dismissed } = await loadMemory(ctx);
  const visible = { ...report, insights: report.insights.filter((i) => !dismissed.has(i.key)) };
  return ok(planningSuggestions(visible, titles.map((t) => String(t).slice(0, 200))));
}
