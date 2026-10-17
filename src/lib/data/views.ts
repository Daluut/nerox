import { daysBetween } from "../domain/dates";
import { PRIORITY_RANK, isOpen } from "../domain/types";
import { SEVERITY_RANK } from "../pulse/types";
import type { ProjectHealthRow } from "@/components/projects/project-health-list";
import type { TaskRowData } from "@/components/tasks/task-row";
import type { ProjectBundle, Task } from "./types";

/** Shapes shared by several pages, derived from the same bundles so screens never disagree. */

export function toHealthRow(b: ProjectBundle): ProjectHealthRow {
  const a = b.assessment;
  const top = a.risks[0];
  return {
    id: b.project.id,
    name: b.project.name,
    ownerId: b.project.ownerId,
    progress: a.progress.percent,
    progressMethod: a.progress.method,
    score: a.score,
    status: a.status,
    deadline: b.project.deadline,
    openTasks: a.counts.open,
    topIssue: top ? top.title : a.status === "insufficient_data" && a.counts.total < 3 ? "Add a few tasks so Pulse can assess this project" : null,
    strip: a.factors.map((f) => ({ weight: f.weight, score: f.available ? f.score : null })),
    archived: !!b.project.archivedAt,
    completed: b.project.status === "completed",
  };
}

export const isActiveProject = (b: ProjectBundle) => !b.project.archivedAt && b.project.status !== "completed";

/** Open tasks whose predecessors are unfinished. */
export function waitingOn(b: ProjectBundle, taskId: string): Task[] {
  const byId = new Map(b.tasks.map((t) => [t.id, t]));
  return b.dependencies
    .filter((d) => d.successorId === taskId)
    .map((d) => byId.get(d.predecessorId))
    .filter((t): t is Task => !!t && isOpen(t));
}

export function toRow(b: ProjectBundle, t: Task): TaskRowData {
  const waits = isOpen(t) ? waitingOn(b, t.id) : [];
  const blocks = isOpen(t) ? b.dependencies.filter((d) => d.predecessorId === t.id && isOpen(b.tasks.find((x) => x.id === d.successorId) ?? t)).length : 0;
  const note = waits.length ? `Waiting on ${waits.length === 1 ? `“${waits[0].title}”` : `${waits.length} tasks`}` : blocks ? `Blocks ${blocks} ${blocks === 1 ? "task" : "tasks"}` : null;
  return {
    id: t.id,
    projectId: t.projectId,
    projectName: b.project.name,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    dueDate: t.dueDate,
    note,
  };
}

/**
 * Attention ranking for "My priorities": overdue, then blocking others, then due soon,
 * then flagged by Pulse, then by priority and date.
 */
export function attentionScore(b: ProjectBundle, t: Task, today: string): number {
  if (!isOpen(t)) return -1;
  let s = 0;
  const days = t.dueDate ? daysBetween(today, t.dueDate) : null;
  if (days !== null && days < 0) s += 100 + Math.min(-days, 30);
  else if (days !== null && days <= 3) s += 60 - days * 5;
  else if (days !== null && days <= 7) s += 25;
  if (b.dependencies.some((d) => d.predecessorId === t.id)) s += 15;
  const risk = b.assessment.risks.find((r) => r.taskIds[0] === t.id);
  if (risk) s += SEVERITY_RANK[risk.severity] * 8;
  s += PRIORITY_RANK[t.priority] * 6;
  return s;
}
