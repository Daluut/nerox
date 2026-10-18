import { NextResponse } from "next/server";
import { getAppContext, memberName } from "@/lib/data/context";
import { getEntitlements } from "@/lib/billing/server";
import { toCsv } from "@/lib/export/csv";

export const dynamic = "force-dynamic";

/** Downloads a project's tasks as a CSV file. Read under RLS, so only visible projects export. */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) return new NextResponse("Not found", { status: 404 });
  const ctx = await getAppContext();
  if (!(await getEntitlements(ctx)).export) {
    return new NextResponse("Spreadsheet export is part of Nerox Pro. An owner or admin can upgrade on the Billing page in Settings.", { status: 402 });
  }

  const [{ data: project }, { data: tasks, error }, { data: milestones }] = await Promise.all([
    ctx.supabase.from("projects").select("id, name").eq("id", projectId).eq("workspace_id", ctx.workspace.id).maybeSingle(),
    ctx.supabase
      .from("tasks")
      .select("title, status, priority, assignee_id, start_date, due_date, estimate_hours, actual_hours, milestone_id, labels, completed_at, created_at")
      .eq("project_id", projectId)
      .order("created_at"),
    ctx.supabase.from("milestones").select("id, name").eq("project_id", projectId),
  ]);
  if (!project) return new NextResponse("Not found", { status: 404 });
  if (error) return new NextResponse("Couldn't export this project. Try again.", { status: 500 });

  const milestoneName = new Map((milestones ?? []).map((m) => [m.id as string, m.name as string]));
  const rows = (tasks ?? []).map((t) => [
    t.title,
    t.status,
    t.priority,
    t.assignee_id ? memberName(ctx, t.assignee_id) : "",
    t.start_date ?? "",
    t.due_date ?? "",
    t.estimate_hours ?? "",
    t.actual_hours ?? "",
    t.milestone_id ? (milestoneName.get(t.milestone_id) ?? "") : "",
    (t.labels ?? []).join(", "),
    t.completed_at ? String(t.completed_at).slice(0, 10) : "",
  ]);
  const csv = toCsv(["Task", "Status", "Priority", "Assignee", "Start", "Due", "Estimate (h)", "Actual (h)", "Milestone", "Labels", "Completed"], rows);
  const filename = `${project.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "project"}-tasks.csv`;
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
