import type { Role } from "./types";

/**
 * Role capability matrix. The database enforces the same rules through row-level
 * security and SECURITY DEFINER functions (see supabase/migrations); this module
 * mirrors them so the UI hides actions a user can't take and server actions can
 * fail fast with a clear message.
 *
 * Policy: every active workspace member can read every project in that workspace.
 */
export type Capability =
  | "workspace.read"
  | "workspace.manage" // rename, timezone, Pulse configuration
  | "workspace.delete"
  | "members.invite"
  | "members.manage" // change roles, remove members
  | "project.create"
  | "project.edit"
  | "project.delete"
  | "task.write"
  | "comment.write"
  | "pulse.snapshot";

const MATRIX: Record<Role, Capability[]> = {
  owner: [
    "workspace.read",
    "workspace.manage",
    "workspace.delete",
    "members.invite",
    "members.manage",
    "project.create",
    "project.edit",
    "project.delete",
    "task.write",
    "comment.write",
    "pulse.snapshot",
  ],
  admin: [
    "workspace.read",
    "workspace.manage",
    "members.invite",
    "members.manage",
    "project.create",
    "project.edit",
    "project.delete",
    "task.write",
    "comment.write",
    "pulse.snapshot",
  ],
  member: ["workspace.read", "project.create", "project.edit", "task.write", "comment.write", "pulse.snapshot"],
  viewer: ["workspace.read"],
};

export function can(role: Role | null | undefined, capability: Capability): boolean {
  return !!role && MATRIX[role].includes(capability);
}

/** Members may delete projects they own; owners/admins may delete any project. */
export function canDeleteProject(role: Role | null | undefined, userId: string, projectOwnerId: string | null) {
  return can(role, "project.delete") || (can(role, "project.edit") && projectOwnerId === userId);
}

/**
 * Who may change whose role. Nobody can change the owner's role through this path;
 * only the owner can grant or revoke admin.
 */
export function canChangeRole(actor: Role, target: Role, next: Role): boolean {
  if (!can(actor, "members.manage")) return false;
  if (target === "owner" || next === "owner") return false;
  if ((target === "admin" || next === "admin") && actor !== "owner") return false;
  return true;
}

export function canRemoveMember(actor: Role, target: Role): boolean {
  if (!can(actor, "members.manage") || target === "owner") return false;
  if (target === "admin" && actor !== "owner") return false;
  return true;
}

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Full control, including deleting the workspace.",
  admin: "Manages members, invitations and workspace settings.",
  member: "Creates and edits projects, tasks and comments.",
  viewer: "Read-only access to projects and tasks.",
};
