/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ActivityEvent, Comment, Dependency, Member, Milestone, Notification, Project, Snapshot, Task } from "./types";

// Supabase returns untyped rows here (no generated types); these mappers are the
// single place where database column names are translated to domain names.

export const PROJECT_COLUMNS =
  "id, workspace_id, name, description, owner_id, created_by, start_date, deadline, status, archived_at, completed_at, created_at, updated_at";
export const TASK_COLUMNS =
  "id, project_id, workspace_id, milestone_id, title, description, status, priority, assignee_id, creator_id, start_date, due_date, estimate_hours, actual_hours, labels, created_at, updated_at, status_changed_at, completed_at";

export const toProject = (r: any): Project => ({
  id: r.id,
  workspaceId: r.workspace_id,
  name: r.name,
  description: r.description ?? "",
  ownerId: r.owner_id,
  createdBy: r.created_by,
  startDate: r.start_date,
  deadline: r.deadline,
  status: r.status,
  archivedAt: r.archived_at,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const toTask = (r: any): Task => ({
  id: r.id,
  projectId: r.project_id,
  workspaceId: r.workspace_id,
  milestoneId: r.milestone_id,
  title: r.title,
  description: r.description ?? "",
  status: r.status,
  priority: r.priority,
  assigneeId: r.assignee_id,
  creatorId: r.creator_id,
  startDate: r.start_date,
  dueDate: r.due_date,
  estimateHours: n(r.estimate_hours),
  actualHours: n(r.actual_hours),
  labels: r.labels ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  statusChangedAt: r.status_changed_at,
  completedAt: r.completed_at,
});

export const toDependency = (r: any): Dependency => ({
  id: r.id,
  projectId: r.project_id,
  predecessorId: r.predecessor_id,
  successorId: r.successor_id,
});

export const toMilestone = (r: any): Milestone => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  description: r.description ?? "",
  targetDate: r.target_date,
  completedAt: r.completed_at,
});

export const toMember = (r: any): Member => {
  const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
  return {
    userId: r.user_id,
    name: p?.display_name || p?.email?.split("@")[0] || "Unknown",
    email: p?.email ?? null,
    avatarUrl: p?.avatar_url ?? null,
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
  };
};

export const toActivity = (r: any): ActivityEvent => ({
  id: r.id,
  projectId: r.project_id,
  actorId: r.actor_id,
  entityType: r.entity_type,
  entityId: r.entity_id,
  eventType: r.event_type,
  data: r.data ?? {},
  createdAt: r.created_at,
});

export const toComment = (r: any): Comment => ({
  id: r.id,
  taskId: r.task_id,
  authorId: r.author_id,
  content: r.content,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toSnapshot = (r: any): Snapshot => ({
  snapshotDate: r.snapshot_date,
  score: n(r.score),
  status: r.status,
  assessedAt: r.assessed_at,
  algorithmVersion: r.algorithm_version,
});

export const toNotification = (r: any): Notification => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  link: r.link,
  readAt: r.read_at,
  createdAt: r.created_at,
});
