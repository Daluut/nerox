import { formatDate } from "@/lib/domain/dates";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/domain/types";
import type { ActivityEvent } from "@/lib/data/types";

const q = (s: unknown) => (s ? `“${String(s)}”` : "a task");
const status = (s: unknown) => STATUS_LABEL[s as TaskStatus] ?? String(s);
const date = (d: unknown) => (d ? formatDate(String(d)) : "no date");

/**
 * Human sentence for an activity event, without the actor's name.
 * `withSubject` includes the task/project name (feeds) or omits it (task history).
 */
export function describeEvent(e: Pick<ActivityEvent, "eventType" | "data">, name: (id: string | null) => string, withSubject = true): string {
  const d = e.data as Record<string, unknown>;
  const subj = withSubject ? ` ${q(d.title)}` : "";
  switch (e.eventType) {
    case "task_created":
      return withSubject ? `created${subj}` : "created this task";
    case "task_completed":
      return `completed${subj || " this task"}`;
    case "task_reopened":
      return `reopened${subj || " this task"}`;
    case "task_status_changed":
      return `moved${subj} from ${status(d.from)} to ${status(d.to)}`;
    case "task_assigned":
      return d.to ? `assigned${subj} to ${name(d.to as string)}` : `unassigned${subj || " this task"}`;
    case "task_due_changed":
      return `changed the due date${withSubject ? ` of${subj}` : ""} from ${date(d.from)} to ${date(d.to)}`;
    case "task_priority_changed":
      return `changed priority${withSubject ? ` of${subj}` : ""} to ${PRIORITY_LABEL[d.to as Priority] ?? d.to}`;
    case "task_updated":
      return `edited${subj || " details"}`;
    case "task_deleted":
      return `deleted${subj}`;
    case "comment_added":
      return `commented${withSubject ? ` on${subj}` : ""}: “${String(d.excerpt ?? "").slice(0, 80)}${String(d.excerpt ?? "").length > 80 ? "…" : ""}”`;
    case "dependency_added":
      return `made ${q(d.successor)} wait on ${q(d.predecessor)}`;
    case "dependency_removed":
      return `removed the dependency of ${q(d.successor)} on ${q(d.predecessor)}`;
    case "project_created":
      return `created the project ${q(d.name)}`;
    case "project_updated":
      return `updated project details`;
    case "project_deadline_changed":
      return `moved the project deadline from ${date(d.from)} to ${date(d.to)}`;
    case "project_archived":
      return `archived ${q(d.name)}`;
    case "project_restored":
      return `restored ${q(d.name)}`;
    case "project_status_changed":
      return `marked ${q(d.name)} as ${String(d.to).replace("_", " ")}`;
    case "project_deleted":
      return `deleted the project ${q(d.name)}`;
    case "milestone_created":
      return `added milestone ${q(d.name)}`;
    case "milestone_completed":
      return `completed milestone ${q(d.name)}`;
    case "milestone_reopened":
      return `reopened milestone ${q(d.name)}`;
    case "milestone_rescheduled":
      return `moved milestone ${q(d.name)} to ${date(d.to)}`;
    case "member_joined":
      return `joined the workspace as ${d.role}`;
    case "member_left":
      return "left the workspace";
    case "member_removed":
      return "removed a member";
    case "member_role_changed":
      return `changed a member's role to ${d.to}`;
    default:
      return e.eventType.replace(/_/g, " ");
  }
}
