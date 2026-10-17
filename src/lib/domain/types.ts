// Core domain vocabulary shared by the UI, server actions and the Pulse engine.

export const TASK_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PROJECT_STATUSES = ["active", "on_hold", "completed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** A calendar date with no time or timezone, formatted YYYY-MM-DD. */
export type DateOnly = string;

export interface DomainTask {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  creatorId: string | null;
  milestoneId: string | null;
  startDate: DateOnly | null;
  dueDate: DateOnly | null;
  estimateHours: number | null;
  actualHours: number | null;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  statusChangedAt: string;
  completedAt: string | null;
}

export interface DomainDependency {
  predecessorId: string;
  successorId: string;
}

export interface DomainMilestone {
  id: string;
  name: string;
  targetDate: DateOnly | null;
  completedAt: string | null;
}

export interface DomainMember {
  userId: string;
  name: string;
}

export interface DomainProject {
  id: string;
  name: string;
  startDate: DateOnly | null;
  deadline: DateOnly | null;
  status: ProjectStatus;
  createdAt: string;
}

export const isOpen = (t: Pick<DomainTask, "status">) => t.status !== "done";
