import type { DomainProject, DomainTask } from "@/lib/domain/types";
import type { PulseInput } from "@/lib/pulse/types";

export const TODAY = "2026-10-17";
export const NOW = new Date("2026-10-17T12:00:00Z");

export function task(p: Partial<DomainTask> & { id: string }): DomainTask {
  return {
    projectId: "p1",
    title: p.id,
    status: "todo",
    priority: "medium",
    assigneeId: null,
    creatorId: "u1",
    milestoneId: null,
    startDate: null,
    dueDate: null,
    estimateHours: null,
    actualHours: null,
    createdAt: "2026-09-20T09:00:00Z",
    updatedAt: "2026-10-16T09:00:00Z",
    statusChangedAt: "2026-10-16T09:00:00Z",
    completedAt: p.status === "done" ? "2026-10-10T09:00:00Z" : null,
    ...p,
  };
}

export function project(p: Partial<DomainProject> = {}): DomainProject {
  return {
    id: "p1",
    name: "Project",
    startDate: "2026-09-20",
    deadline: "2026-11-15",
    status: "active",
    createdAt: "2026-09-20T09:00:00Z",
    ...p,
  };
}

export function input(p: Partial<PulseInput>): PulseInput {
  return {
    project: project(),
    tasks: [],
    dependencies: [],
    milestones: [],
    members: [
      { userId: "u1", name: "Ana" },
      { userId: "u2", name: "Ben" },
      { userId: "u3", name: "Cleo" },
    ],
    today: TODAY,
    timeZone: "Europe/London",
    now: NOW,
    ...p,
  };
}

export const dep = (predecessorId: string, successorId: string) => ({ predecessorId, successorId });
