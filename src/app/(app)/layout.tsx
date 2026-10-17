import { Suspense } from "react";
import { getAppContext } from "@/lib/data/context";
import { AppDataProvider, type ClientAppData } from "@/components/shell/app-context";
import { Shell } from "@/components/shell/shell";
import { TaskDrawer } from "@/components/tasks/task-drawer";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  const [{ data: projects }, { count }] = await Promise.all([
    ctx.supabase.from("projects").select("id, name, archived_at").eq("workspace_id", ctx.workspace.id).order("name"),
    ctx.supabase.from("notifications").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).is("read_at", null),
  ]);
  const data: ClientAppData = {
    userId: ctx.userId,
    displayName: ctx.displayName,
    email: ctx.email,
    role: ctx.role,
    today: ctx.today,
    timezone: ctx.timezone,
    workspace: { id: ctx.workspace.id, name: ctx.workspace.name },
    workspaces: ctx.workspaces,
    members: ctx.members.map((m) => ({ userId: m.userId, name: m.name, role: m.role, active: m.status === "active" })),
    projects: (projects ?? []).map((p) => ({ id: p.id, name: p.name, archived: !!p.archived_at })),
    unreadCount: count ?? 0,
    realtime: process.env.NEXT_PUBLIC_REALTIME !== "off",
  };
  return (
    <AppDataProvider value={data}>
      <Shell>{children}</Shell>
      <Suspense>
        <TaskDrawer />
      </Suspense>
    </AppDataProvider>
  );
}
