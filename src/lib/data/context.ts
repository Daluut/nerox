import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import { todayInTimeZone } from "../domain/dates";
import type { Role } from "../domain/types";
import { resolveConfig, type PulseConfig } from "../pulse/config";
import { toMember } from "./mappers";
import type { Member } from "./types";

export const WORKSPACE_COOKIE = "nerox_ws";

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: Role;
}

export interface AppContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  email: string | null;
  displayName: string;
  workspaces: WorkspaceSummary[];
  workspace: { id: string; name: string; ownerId: string; timezone: string; settings: Record<string, unknown> };
  role: Role;
  members: Member[]; // active and former members (for history), active first
  timezone: string;
  today: string;
  pulseConfig: PulseConfig;
}

/** The signed-in user, or a redirect to sign in. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
});

/**
 * Resolves the user, their workspaces and the current workspace (from a cookie,
 * validated against real memberships — the cookie is only a preference).
 */
export const getAppContext = cache(async (): Promise<AppContext> => {
  const { supabase, user } = await requireUser();
  const [{ data: memberships }, { data: profile }] = await Promise.all([
    supabase
      .from("workspace_members")
      .select("role, workspaces(id, name)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("joined_at"),
    supabase.from("profiles").select("display_name, email").eq("id", user.id).single(),
  ]);

  const workspaces: WorkspaceSummary[] = (memberships ?? [])
    .map((m) => {
      const w = (Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces) as { id: string; name: string } | null;
      return w ? { id: w.id, name: w.name, role: m.role as Role } : null;
    })
    .filter((w): w is WorkspaceSummary => !!w);
  if (!workspaces.length) redirect("/onboarding");

  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const current = workspaces.find((w) => w.id === preferred) ?? workspaces[0];

  const [{ data: ws }, { data: memberRows }] = await Promise.all([
    supabase.from("workspaces").select("id, name, owner_id, settings").eq("id", current.id).single(),
    supabase
      .from("workspace_members")
      .select("user_id, role, status, joined_at, profiles(id, display_name, email, avatar_url)")
      .eq("workspace_id", current.id),
  ]);
  if (!ws) redirect("/onboarding");

  const settings = (ws.settings ?? {}) as Record<string, unknown>;
  const timezone = typeof settings.timezone === "string" ? settings.timezone : "Europe/London";
  const members = (memberRows ?? [])
    .map(toMember)
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "active" ? -1 : 1));

  return {
    supabase,
    userId: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name || user.email?.split("@")[0] || "there",
    workspaces,
    workspace: { id: ws.id, name: ws.name, ownerId: ws.owner_id, timezone, settings },
    role: current.role,
    members,
    timezone,
    today: todayInTimeZone(timezone),
    pulseConfig: resolveConfig(settings.pulse),
  };
});

export const activeMembers = (ctx: AppContext) => ctx.members.filter((m) => m.status === "active");
export const memberName = (ctx: AppContext, id: string | null | undefined) =>
  id ? (ctx.members.find((m) => m.userId === id)?.name ?? "Former member") : "Unassigned";
