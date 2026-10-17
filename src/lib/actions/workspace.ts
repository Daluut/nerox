"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { WORKSPACE_COOKIE, getAppContext, requireUser } from "../data/context";
import type { ActionResult } from "../data/types";
import { can } from "../domain/permissions";
import { FACTOR_KEYS } from "../pulse/config";
import { inviteSchema, uuid, workspaceSchema } from "../validation";
import { err, friendlyError, ok, okVoid, parse, refresh } from "./util";

const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 };

export async function createWorkspace(input: { name: string; timezone: string }): Promise<ActionResult<{ id: string }>> {
  const v = parse(workspaceSchema, input);
  if (!v.ok) return v;
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_workspace", { p_name: v.data.name, p_timezone: v.data.timezone });
  if (error) return err(friendlyError(error));
  (await cookies()).set(WORKSPACE_COOKIE, data as string, cookieOptions);
  refresh();
  return ok({ id: data as string });
}

export async function switchWorkspace(workspaceId: string): Promise<void> {
  const v = parse(uuid, workspaceId);
  if (!v.ok) return;
  const ctx = await getAppContext();
  if (!ctx.workspaces.some((w) => w.id === v.data)) return; // only switch to workspaces you belong to
  (await cookies()).set(WORKSPACE_COOKIE, v.data, cookieOptions);
  redirect("/overview");
}

export async function updateWorkspace(input: { name: string; timezone: string }): Promise<ActionResult> {
  const v = parse(workspaceSchema, input);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  if (!can(ctx.role, "workspace.manage")) return err("Only owners and admins can change workspace settings.");
  const { error } = await ctx.supabase
    .from("workspaces")
    .update({ name: v.data.name, settings: { ...ctx.workspace.settings, timezone: v.data.timezone } })
    .eq("id", ctx.workspace.id);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

const weightsSchema = z.object(Object.fromEntries(FACTOR_KEYS.map((k) => [k, z.coerce.number().int().min(0).max(100)])));

export async function updatePulseWeights(input: Record<string, number> | null): Promise<ActionResult> {
  const ctx = await getAppContext();
  if (!can(ctx.role, "workspace.manage")) return err("Only owners and admins can change Pulse settings.");
  const settings = { ...ctx.workspace.settings };
  if (input === null) {
    delete settings.pulse;
  } else {
    const v = parse(weightsSchema, input);
    if (!v.ok) return v;
    if (Object.values(v.data).every((x) => x === 0)) return err("At least one factor needs a weight above 0.");
    settings.pulse = { ...((settings.pulse as object) ?? {}), weights: v.data };
  }
  const { error } = await ctx.supabase.from("workspaces").update({ settings }).eq("id", ctx.workspace.id);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function updateProfile(input: { name: string }): Promise<ActionResult> {
  const v = parse(z.object({ name: z.string().trim().min(1, "Name is required.").max(80) }), input);
  if (!v.ok) return v;
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ display_name: v.data.name }).eq("id", user.id);
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

/** Records that the person has finished (or skipped) the tutorial, on every device. */
export async function completeTour(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("profiles").select("preferences").eq("id", user.id).single();
  const preferences = { ...((data?.preferences as Record<string, unknown>) ?? {}), tour_done: true };
  const { error } = await supabase.from("profiles").update({ preferences }).eq("id", user.id);
  if (error) return err(friendlyError(error));
  return okVoid();
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a single-use invitation link. Only a hash of the token is stored. */
export async function createInvitation(input: { role: string; email: string; expiresInDays?: number }): Promise<ActionResult<{ url: string }>> {
  const v = parse(inviteSchema, input);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  if (!can(ctx.role, "members.invite")) return err("Only owners and admins can invite people.");
  if (v.data.role === "admin" && ctx.role !== "owner") return err("Only the owner can invite admins.");
  const token = randomBytes(32).toString("base64url");
  const { error } = await ctx.supabase.from("invitations").insert({
    workspace_id: ctx.workspace.id,
    email: v.data.email,
    role: v.data.role,
    token_hash: hashToken(token),
    invited_by: ctx.userId,
    expires_at: new Date(Date.now() + v.data.expiresInDays * 86_400_000).toISOString(),
  });
  if (error) return err(friendlyError(error));
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  refresh();
  return ok({ url: `${base}/invite/${token}` });
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const ctx = await getAppContext();
  const { error, count } = await ctx.supabase
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", id)
    .eq("workspace_id", ctx.workspace.id);
  if (error) return err(friendlyError(error));
  if (!count) return err("You don't have permission to do that.");
  refresh();
  return okVoid();
}

export async function acceptInvitation(token: string): Promise<ActionResult> {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return err("This invitation link isn't valid.");
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token_hash: hashToken(token) });
  if (error) return err(friendlyError(error, "This invitation link isn't valid."));
  (await cookies()).set(WORKSPACE_COOKIE, data as string, cookieOptions);
  redirect("/overview");
}

export async function setMemberRole(input: { userId: string; role: string }): Promise<ActionResult> {
  const v = parse(z.object({ userId: uuid, role: z.enum(["admin", "member", "viewer"]) }), input);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("set_member_role", { p_workspace: ctx.workspace.id, p_user: v.data.userId, p_role: v.data.role });
  if (error) return err(friendlyError(error));
  refresh();
  return okVoid();
}

export async function removeMember(userId: string): Promise<ActionResult> {
  const v = parse(uuid, userId);
  if (!v.ok) return v;
  const ctx = await getAppContext();
  const { error } = await ctx.supabase.rpc("remove_member", { p_workspace: ctx.workspace.id, p_user: v.data });
  if (error) return err(friendlyError(error));
  if (v.data === ctx.userId) {
    (await cookies()).delete(WORKSPACE_COOKIE);
    redirect("/overview");
  }
  refresh();
  return okVoid();
}

export async function deleteWorkspace(confirmName: string): Promise<ActionResult> {
  const ctx = await getAppContext();
  if (ctx.role !== "owner") return err("Only the workspace owner can delete it.");
  if (confirmName.trim() !== ctx.workspace.name) return err("Type the workspace name exactly to confirm.");
  const { error, count } = await ctx.supabase.from("workspaces").delete({ count: "exact" }).eq("id", ctx.workspace.id);
  if (error) return err(friendlyError(error));
  if (!count) return err("You don't have permission to do that.");
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/overview");
}
