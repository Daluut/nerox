import "server-only";
import { cache } from "react";
import { buildMemory } from "../memory/engine";
import type { AppContext } from "./context";
import { loadWorkspaceBundles } from "./queries";

/** Memory for the current workspace, built from every project (archived ones included). */
export const loadMemory = cache(async (ctx: AppContext) => {
  const [bundles, dismissals, retros] = await Promise.all([
    loadWorkspaceBundles(ctx),
    ctx.supabase.from("memory_dismissals").select("insight_key").eq("workspace_id", ctx.workspace.id),
    ctx.supabase.from("retrospectives").select("project_id, went_well, to_improve, updated_at, updated_by").eq("workspace_id", ctx.workspace.id),
  ]);
  const report = buildMemory(
    bundles.map((b) => ({
      id: b.project.id,
      name: b.project.name,
      deadline: b.project.deadline,
      status: b.project.status,
      completedAt: b.project.completedAt,
      tasks: b.tasks,
      dependencies: b.dependencies,
    })),
    ctx.timezone,
  );
  return {
    report,
    projectNames: new Map(bundles.map((b) => [b.project.id, b.project.name])),
    dismissed: new Set((dismissals.data ?? []).map((d) => d.insight_key as string)),
    notes: new Map((retros.data ?? []).map((r) => [r.project_id as string, { wentWell: r.went_well as string, toImprove: r.to_improve as string, updatedAt: r.updated_at as string, updatedBy: r.updated_by as string | null }])),
  };
});
