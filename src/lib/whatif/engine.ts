import { addDays, compareDates, daysBetween, maxDate } from "../domain/dates";
import { topologicalOrder } from "../domain/graph";
import { effortWeights } from "../domain/progress";
import type { DateOnly, DomainDependency, DomainMember, DomainMilestone, DomainProject, DomainTask } from "../domain/types";
import { assessProject } from "../pulse/engine";
import type { PulseConfig } from "../pulse/config";
import type { HealthStatus } from "../pulse/types";

/**
 * What If? — scenario simulation.
 *
 * Nothing here touches the database. simulate() takes the live project, a list of
 * hypothetical changes, and returns what would happen: which tasks move, the new
 * projected finish, milestones affected, workload changes and the health score
 * the project would have. Applying a scenario is a separate, explicit step.
 *
 * Scheduling model (deliberately simple and stated to the user):
 *  - A task's planned window is start date → due date. With no start date, it is
 *    assumed to start (estimate ÷ 6 hours) days before it's due, minimum one day.
 *  - Dependencies are finish-to-start. When a task finishes later, each task that
 *    waits on it moves by the same amount, minus any slack already in the plan.
 *  - Tasks are only ever pushed later by a change, never pulled earlier, because
 *    nobody has agreed to start sooner. Finishing early shows up as slack.
 *  - Completed tasks never move. Tasks without a due date aren't scheduled.
 */

export type Change =
  | { kind: "delay"; taskId: string; days: number }
  | { kind: "duration"; taskId: string; factor: number }
  | { kind: "finish_early"; taskId: string; days: number }
  | { kind: "reassign"; taskId: string; toUserId: string | null; handoverDays: number }
  | { kind: "unavailable"; userId: string; from: DateOnly; days: number }
  | { kind: "deadline"; date: DateOnly | null };

export interface SimInput {
  project: DomainProject;
  tasks: DomainTask[];
  dependencies: DomainDependency[];
  milestones: DomainMilestone[];
  members: DomainMember[];
  today: DateOnly;
  timeZone: string;
  now: Date;
  config?: PulseConfig;
}

export interface TaskMove {
  taskId: string;
  title: string;
  assigneeId: string | null;
  fromStart: DateOnly;
  fromDue: DateOnly;
  toStart: DateOnly;
  toDue: DateOnly;
  shiftDays: number; // change in due date
  cause: "changed" | "dependency";
  causeTaskTitle?: string;
}

export interface MilestoneImpact {
  milestoneId: string;
  name: string;
  targetDate: DateOnly | null;
  baselineFinish: DateOnly | null;
  scenarioFinish: DateOnly | null;
  nowLate: boolean;
  wasLate: boolean;
}

export interface WorkloadImpact {
  userId: string;
  name: string;
  before: number;
  after: number;
  unit: "hours" | "tasks";
}

export interface PlannedUpdate {
  taskId: string;
  title: string;
  startDate?: DateOnly | null;
  dueDate?: DateOnly | null;
  assigneeId?: string | null;
}

export interface SimResult {
  valid: boolean;
  errors: string[];
  assumptions: string[];
  moves: TaskMove[];
  baselineFinish: DateOnly | null;
  scenarioFinish: DateOnly | null;
  baselineDeadline: DateOnly | null;
  scenarioDeadline: DateOnly | null;
  finishShiftDays: number | null;
  baselineDaysVsDeadline: number | null; // positive = after the deadline
  scenarioDaysVsDeadline: number | null;
  milestones: MilestoneImpact[];
  workload: WorkloadImpact[];
  health: { before: number | null; after: number | null; beforeStatus: HealthStatus; afterStatus: HealthStatus; newRisks: string[]; resolvedRisks: string[] };
  updates: PlannedUpdate[];
  projectDeadlineUpdate: { from: DateOnly | null; to: DateOnly | null } | null;
  summary: string;
}

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;

interface Slot {
  start: DateOnly;
  end: DateOnly;
}

function baseSlot(t: DomainTask): Slot | null {
  if (!t.dueDate) return null;
  if (t.startDate && compareDates(t.startDate, t.dueDate) <= 0) return { start: t.startDate, end: t.dueDate };
  const days = t.estimateHours ? Math.max(1, Math.ceil(t.estimateHours / 6)) : 1;
  return { start: addDays(t.dueDate, -(days - 1)), end: t.dueDate };
}

/** A short, stable fingerprint of everything a simulation depends on. */
export function fingerprint(project: Pick<DomainProject, "deadline">, tasks: DomainTask[], deps: DomainDependency[]): string {
  const parts = [
    `d:${project.deadline ?? ""}`,
    ...[...tasks].sort((a, b) => a.id.localeCompare(b.id)).map((t) => [t.id, t.status, t.startDate, t.dueDate, t.assigneeId, t.estimateHours].join("|")),
    ...deps.map((d) => `${d.predecessorId}>${d.successorId}`).sort(),
  ].join("\n");
  let h = 0x811c9dc5;
  for (let i = 0; i < parts.length; i++) {
    h ^= parts.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function validateChanges(input: SimInput, changes: Change[]): string[] {
  const byId = new Map(input.tasks.map((t) => [t.id, t]));
  const errors: string[] = [];
  for (const c of changes) {
    if (c.kind === "deadline") continue;
    if (c.kind === "unavailable") {
      if (!input.members.some((m) => m.userId === c.userId)) errors.push("That person isn't on this project.");
      if (!(c.days >= 1 && c.days <= 365)) errors.push("Unavailable time must be between 1 and 365 days.");
      continue;
    }
    const t = byId.get(c.taskId);
    if (!t) {
      errors.push("One of the tasks no longer exists.");
      continue;
    }
    if (t.status === "done") errors.push(`“${t.title}” is already complete, so it can't be changed in a scenario.`);
    if (c.kind !== "reassign" && !t.dueDate) errors.push(`“${t.title}” has no due date, so its timing can't be simulated. Give it a due date first.`);
    if ((c.kind === "delay" || c.kind === "finish_early") && !(c.days >= 1 && c.days <= 365)) errors.push("Days must be between 1 and 365.");
    if (c.kind === "duration" && !(c.factor > 0 && c.factor <= 10)) errors.push("Choose how much longer the task takes (up to 10×).");
    if (c.kind === "reassign" && c.toUserId === t.assigneeId) errors.push(`“${t.title}” is already assigned to that person.`);
  }
  return errors;
}

export function simulate(input: SimInput, changes: Change[]): SimResult {
  const errors = validateChanges(input, changes);
  const assumptions = [
    "Tasks without a start date are assumed to take (estimate ÷ 6 hours) days, or one day without an estimate.",
    "Dependent tasks move by the same amount as the task they wait on, minus any slack already in the plan. Nothing is moved earlier.",
  ];
  const tasks = input.tasks;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const nameOf = (id: string | null) => (id ? (input.members.find((m) => m.userId === id)?.name ?? "Former member") : "Unassigned");

  // 1. Baseline slots and each task's own change to its finish date.
  const base = new Map<string, Slot>();
  for (const t of tasks) {
    const s = baseSlot(t);
    if (s) base.set(t.id, s);
  }
  const unscheduledLinks = input.dependencies.filter((d) => byId.has(d.predecessorId) && byId.has(d.successorId) && (!base.has(d.predecessorId) || !base.has(d.successorId)));
  if (unscheduledLinks.length) assumptions.push(`${plural(unscheduledLinks.length, "dependency")} involve tasks without due dates and can't pass delays along.`);
  if (tasks.some((t) => !t.dueDate && t.status !== "done")) assumptions.push("Tasks without a due date aren't scheduled, so they never appear as moved.");

  const endDelta = new Map<string, number>();
  const assignee = new Map(tasks.map((t) => [t.id, t.assigneeId]));
  let deadline = input.project.deadline;
  let deadlineChanged = false;

  if (!errors.length) {
    for (const c of changes) {
      if (c.kind === "deadline") {
        deadline = c.date;
        deadlineChanged = true;
        continue;
      }
      if (c.kind === "unavailable") {
        const awayEnd = addDays(c.from, c.days - 1);
        for (const t of tasks) {
          const s = base.get(t.id);
          if (!s || t.status === "done" || assignee.get(t.id) !== c.userId) continue;
          // Overlap between the task's window and the time away pauses the work.
          const from = maxDate(s.start, c.from)!;
          const to = compareDates(s.end, awayEnd) < 0 ? s.end : awayEnd;
          const overlap = compareDates(from, to) <= 0 ? daysBetween(from, to) + 1 : 0;
          if (overlap) endDelta.set(t.id, (endDelta.get(t.id) ?? 0) + overlap);
        }
        assumptions.push(`While ${nameOf(c.userId)} is away, their tasks pause and resume afterwards. Nobody else picks them up.`);
        continue;
      }
      const s = base.get(c.taskId);
      if (c.kind === "reassign") {
        assignee.set(c.taskId, c.toUserId);
        if (c.handoverDays > 0 && s) endDelta.set(c.taskId, (endDelta.get(c.taskId) ?? 0) + c.handoverDays);
        if (c.handoverDays > 0) assumptions.push(`Handing over “${byId.get(c.taskId)!.title}” costs ${plural(c.handoverDays, "day")} while the new person gets up to speed.`);
        else assumptions.push(`Handing over “${byId.get(c.taskId)!.title}” is assumed to cost no time. In practice there is usually some.`);
        continue;
      }
      if (!s) continue;
      const dur = daysBetween(s.start, s.end) + 1;
      if (c.kind === "delay") endDelta.set(c.taskId, (endDelta.get(c.taskId) ?? 0) + c.days);
      if (c.kind === "finish_early") endDelta.set(c.taskId, (endDelta.get(c.taskId) ?? 0) - Math.min(c.days, dur - 1));
      if (c.kind === "duration") endDelta.set(c.taskId, (endDelta.get(c.taskId) ?? 0) + Math.round(dur * c.factor) - dur);
    }
  }

  // 2. Push changes through the dependency graph in dependency order.
  const scheduledIds = tasks.filter((t) => base.has(t.id)).map((t) => t.id);
  const scheduledDeps = input.dependencies.filter((d) => base.has(d.predecessorId) && base.has(d.successorId));
  const order = topologicalOrder(scheduledIds, scheduledDeps) ?? scheduledIds;
  const preds = new Map<string, string[]>();
  for (const d of scheduledDeps) preds.set(d.successorId, [...(preds.get(d.successorId) ?? []), d.predecessorId]);

  const next = new Map<string, Slot>();
  const endShift = new Map<string, number>();
  const causeOf = new Map<string, string>();
  for (const id of order) {
    const t = byId.get(id)!;
    const b = base.get(id)!;
    if (t.status === "done") {
      next.set(id, b);
      endShift.set(id, 0);
      continue;
    }
    let startShift = 0;
    for (const p of preds.get(id) ?? []) {
      const pb = base.get(p)!;
      const slack = Math.max(0, daysBetween(pb.end, b.start) - 1);
      const pushed = (endShift.get(p) ?? 0) - slack;
      if (pushed > startShift) {
        startShift = pushed;
        causeOf.set(id, p);
      }
    }
    const start = addDays(b.start, startShift);
    let end = addDays(b.end, startShift + (endDelta.get(id) ?? 0));
    if (compareDates(end, start) < 0) end = start;
    next.set(id, { start, end });
    endShift.set(id, daysBetween(b.end, end));
  }

  // 3. Describe the outcome.
  const moves: TaskMove[] = [];
  for (const id of order) {
    const b = base.get(id)!;
    const n = next.get(id)!;
    if (b.start === n.start && b.end === n.end) continue;
    const t = byId.get(id)!;
    const direct = endDelta.has(id);
    moves.push({
      taskId: id,
      title: t.title,
      assigneeId: assignee.get(id) ?? null,
      fromStart: b.start,
      fromDue: b.end,
      toStart: n.start,
      toDue: n.end,
      shiftDays: daysBetween(b.end, n.end),
      cause: direct ? "changed" : "dependency",
      causeTaskTitle: !direct && causeOf.get(id) ? byId.get(causeOf.get(id)!)!.title : undefined,
    });
  }

  const openScheduled = order.filter((id) => byId.get(id)!.status !== "done");
  const finish = (m: Map<string, Slot>) => (openScheduled.length ? openScheduled.map((id) => m.get(id)!.end).reduce((a, b) => (b > a ? b : a)) : null);
  const baselineFinish = finish(base);
  const scenarioFinish = finish(next);
  const vs = (f: DateOnly | null, d: DateOnly | null) => (f && d ? daysBetween(d, f) : null);

  const milestones: MilestoneImpact[] = input.milestones
    .filter((m) => !m.completedAt)
    .map((m) => {
      const linked = openScheduled.filter((id) => byId.get(id)!.milestoneId === m.id);
      const bf = linked.length ? linked.map((id) => base.get(id)!.end).reduce((a, b) => (b > a ? b : a)) : null;
      const sf = linked.length ? linked.map((id) => next.get(id)!.end).reduce((a, b) => (b > a ? b : a)) : null;
      return {
        milestoneId: m.id,
        name: m.name,
        targetDate: m.targetDate,
        baselineFinish: bf,
        scenarioFinish: sf,
        wasLate: !!(bf && m.targetDate && bf > m.targetDate),
        nowLate: !!(sf && m.targetDate && sf > m.targetDate),
      };
    })
    .filter((m) => m.baselineFinish !== m.scenarioFinish);

  const { weight, method } = effortWeights(tasks);
  const load = (who: (t: DomainTask) => string | null) => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      const a = who(t);
      if (t.status === "done" || !a) continue;
      m.set(a, (m.get(a) ?? 0) + weight(t));
    }
    return m;
  };
  const before = load((t) => t.assigneeId);
  const after = load((t) => assignee.get(t.id) ?? null);
  const people = new Set([...before.keys(), ...after.keys()]);
  const workload: WorkloadImpact[] = [...people]
    .map((id) => ({ userId: id, name: nameOf(id), before: round1(before.get(id) ?? 0), after: round1(after.get(id) ?? 0), unit: method === "effort" ? ("hours" as const) : ("tasks" as const) }))
    .filter((w) => w.before !== w.after)
    .sort((a, b) => b.after - a.after);

  // Health score the project would have, using the same Pulse engine.
  const scenarioTasks: DomainTask[] = tasks.map((t) => {
    const n = next.get(t.id);
    const b = base.get(t.id);
    return {
      ...t,
      assigneeId: assignee.get(t.id) ?? null,
      dueDate: n && b && n.end !== b.end ? n.end : t.dueDate,
      startDate: n && b && n.start !== b.start ? n.start : t.startDate,
    };
  });
  const members = [...new Set([...input.members.map((m) => m.userId), ...[...after.keys()]])].map((id) => ({ userId: id, name: nameOf(id) }));
  const pulseBase = { dependencies: input.dependencies, milestones: input.milestones, today: input.today, timeZone: input.timeZone, now: input.now, config: input.config };
  const hb = assessProject({ ...pulseBase, project: input.project, tasks, members: input.members });
  const ha = assessProject({ ...pulseBase, project: { ...input.project, deadline }, tasks: scenarioTasks, members });
  const beforeRisks = new Map(hb.risks.map((r) => [r.id, r.title]));
  const afterRisks = new Map(ha.risks.map((r) => [r.id, r.title]));

  const updates: PlannedUpdate[] = [];
  for (const t of tasks) {
    const u: PlannedUpdate = { taskId: t.id, title: t.title };
    const n = next.get(t.id);
    const b = base.get(t.id);
    if (n && b && n.end !== b.end) u.dueDate = n.end;
    if (n && b && t.startDate && n.start !== b.start) u.startDate = n.start;
    if ((assignee.get(t.id) ?? null) !== t.assigneeId) u.assigneeId = assignee.get(t.id) ?? null;
    if (u.dueDate !== undefined || u.startDate !== undefined || u.assigneeId !== undefined) updates.push(u);
  }

  const finishShift = baselineFinish && scenarioFinish ? daysBetween(baselineFinish, scenarioFinish) : null;
  const sDays = vs(scenarioFinish, deadline);
  const summary = errors.length
    ? errors[0]
    : !changes.length
      ? "Add a change to see what would happen."
      : finishShift === null
        ? "This project has no scheduled open work, so there's no finish date to compare."
        : `${moves.length ? `${plural(moves.length, "task")} would move` : "No dates would move"}${
            finishShift > 0 ? `, and the project would finish ${plural(finishShift, "day")} later` : finishShift < 0 ? `, and the project could finish ${plural(-finishShift, "day")} sooner` : ", and the finish date stays the same"
          }${sDays !== null ? (sDays > 0 ? `, ${plural(sDays, "day")} after the deadline.` : `, still within the deadline.`) : "."}`;

  return {
    valid: !errors.length,
    errors,
    assumptions: [...new Set(assumptions)],
    moves,
    baselineFinish,
    scenarioFinish,
    baselineDeadline: input.project.deadline,
    scenarioDeadline: deadline,
    finishShiftDays: finishShift,
    baselineDaysVsDeadline: vs(baselineFinish, input.project.deadline),
    scenarioDaysVsDeadline: sDays,
    milestones,
    workload,
    health: {
      before: hb.score,
      after: ha.score,
      beforeStatus: hb.status,
      afterStatus: ha.status,
      newRisks: [...afterRisks].filter(([id]) => !beforeRisks.has(id)).map(([, t]) => t),
      resolvedRisks: [...beforeRisks].filter(([id]) => !afterRisks.has(id)).map(([, t]) => t),
    },
    updates,
    projectDeadlineUpdate: deadlineChanged && deadline !== input.project.deadline ? { from: input.project.deadline, to: deadline } : null,
    summary,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Plain-English description of a change, for lists and saved scenarios. */
export function describeChange(c: Change, title: (taskId: string) => string, name: (userId: string | null) => string): string {
  switch (c.kind) {
    case "delay":
      return `“${title(c.taskId)}” finishes ${plural(c.days, "day")} late`;
    case "finish_early":
      return `“${title(c.taskId)}” finishes ${plural(c.days, "day")} early`;
    case "duration":
      return `“${title(c.taskId)}” takes ${c.factor === 2 ? "twice" : `${c.factor}×`} as long`;
    case "reassign":
      return `“${title(c.taskId)}” moves to ${name(c.toUserId)}${c.handoverDays ? ` (+${plural(c.handoverDays, "day")} handover)` : ""}`;
    case "unavailable":
      return `${name(c.userId)} is away for ${plural(c.days, "day")} from ${c.from}`;
    case "deadline":
      return c.date ? `The deadline moves to ${c.date}` : "The deadline is removed";
  }
}
