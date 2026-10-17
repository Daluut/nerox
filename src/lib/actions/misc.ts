"use server";

import { getAppContext } from "../data/context";
import { loadNotifications } from "../data/queries";
import type { ActionResult, Notification } from "../data/types";
import { err, friendlyError, ok, okVoid, refresh } from "./util";

export async function listNotifications(): Promise<ActionResult<Notification[]>> {
  const ctx = await getAppContext();
  return ok(await loadNotifications(ctx));
}

export async function markNotificationsRead(ids: string[] | "all"): Promise<ActionResult> {
  const ctx = await getAppContext();
  let q = ctx.supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", ctx.userId).is("read_at", null);
  if (ids !== "all") {
    if (!Array.isArray(ids) || ids.length > 100) return err("Invalid request.");
    q = q.in("id", ids);
  }
  const { error } = await q;
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export interface SearchResult {
  kind: "project" | "task" | "milestone" | "member";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/** Partial-match search across what the user can see. Row-level security scopes every query. */
export async function search(query: string): Promise<ActionResult<SearchResult[]>> {
  const q = typeof query === "string" ? query.trim().slice(0, 80) : "";
  if (q.length < 2) return ok([]);
  const ctx = await getAppContext();
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const wsId = ctx.workspace.id;
  const [projects, tasks, milestones] = await Promise.all([
    ctx.supabase.from("projects").select("id, name, archived_at").eq("workspace_id", wsId).ilike("name", pattern).limit(6),
    ctx.supabase.from("tasks").select("id, title, project_id, status, projects(name)").eq("workspace_id", wsId).ilike("title", pattern).limit(10),
    ctx.supabase.from("milestones").select("id, name, project_id, projects(name)").eq("workspace_id", wsId).ilike("name", pattern).limit(5),
  ]);
  const pname = (r: { projects?: unknown }) => {
    const p = r.projects as { name?: string } | { name?: string }[] | null | undefined;
    return (Array.isArray(p) ? p[0]?.name : p?.name) ?? "";
  };
  const lower = q.toLowerCase();
  const results: SearchResult[] = [
    ...(projects.data ?? []).map((p) => ({ kind: "project" as const, id: p.id, title: p.name, subtitle: p.archived_at ? "Archived project" : "Project", href: `/projects/${p.id}` })),
    ...(tasks.data ?? []).map((t) => ({ kind: "task" as const, id: t.id, title: t.title, subtitle: pname(t), href: `/projects/${t.project_id}?task=${t.id}` })),
    ...(milestones.data ?? []).map((m) => ({ kind: "milestone" as const, id: m.id, title: m.name, subtitle: `Milestone in ${pname(m)}`, href: `/projects/${m.project_id}` })),
    ...ctx.members
      .filter((m) => m.status === "active" && (m.name.toLowerCase().includes(lower) || m.email?.toLowerCase().includes(lower)))
      .slice(0, 5)
      .map((m) => ({ kind: "member" as const, id: m.userId, title: m.name, subtitle: `${m.role[0].toUpperCase()}${m.role.slice(1)}`, href: `/team` })),
  ];
  if (projects.error || tasks.error) return err("Search is unavailable right now.");
  return ok(results);
}
