import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { loadInvitations } from "@/lib/data/queries";
import { can } from "@/lib/domain/permissions";
import { TeamView } from "./team-view";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await getAppContext();
  const invitations = await loadInvitations(ctx);
  const { data: openTasks } = await ctx.supabase.from("tasks").select("assignee_id").eq("workspace_id", ctx.workspace.id).neq("status", "done").not("assignee_id", "is", null);
  const load: Record<string, number> = {};
  for (const t of openTasks ?? []) load[t.assignee_id as string] = (load[t.assignee_id as string] ?? 0) + 1;
  return (
    <TeamView
      members={ctx.members
        .filter((m) => m.status === "active")
        .map((m) => ({ userId: m.userId, name: m.name, email: m.email, role: m.role, joinedAt: m.joinedAt, openTasks: load[m.userId] ?? 0 }))}
      invitations={invitations.map((i) => ({ id: i.id as string, email: i.email as string | null, role: i.role as string, expiresAt: i.expires_at as string }))}
      canInvite={can(ctx.role, "members.invite")}
      canManage={can(ctx.role, "members.manage")}
    />
  );
}
