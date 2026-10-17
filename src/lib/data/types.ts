import type { DateOnly, DomainTask, ProjectStatus, Role } from "../domain/types";
import type { Assessment } from "../pulse/types";

export interface Member {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  status: "active" | "removed";
  joinedAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  ownerId: string | null;
  createdBy: string | null;
  startDate: DateOnly | null;
  deadline: DateOnly | null;
  status: ProjectStatus;
  archivedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task extends DomainTask {
  workspaceId: string;
  description: string;
  labels: string[];
}

export interface Dependency {
  id: string;
  projectId: string;
  predecessorId: string;
  successorId: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: DateOnly | null;
  completedAt: string | null;
}

export interface ProjectBundle {
  project: Project;
  tasks: Task[];
  dependencies: Dependency[];
  milestones: Milestone[];
  memberIds: string[];
  assessment: Assessment;
}

export interface ActivityEvent {
  id: string;
  projectId: string | null;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  eventType: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  authorId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Snapshot {
  snapshotDate: DateOnly;
  score: number | null;
  status: Assessment["status"];
  assessedAt: string;
  algorithmVersion: string;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
