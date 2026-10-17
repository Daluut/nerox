import { compareDates, dateOfTimestamp, daysBetween } from "../domain/dates";
import { median } from "../domain/progress";
import type { DateOnly, DomainDependency, DomainTask } from "../domain/types";

/**
 * Nerox Memory — learning from finished work.
 *
 * Memory looks at completed tasks across every project in a workspace and asks
 * two simple questions per kind of work: did it take as long as estimated, and
 * was it finished on time? It only turns an answer into a lesson when there is
 * enough evidence (MIN_OBSERVATIONS tasks from at least MIN_PROJECTS projects),
 * and every lesson shows how many tasks it's based on.
 *
 * Kinds of work are recognised from task titles with plain keyword rules, so the
 * grouping is predictable and explainable. No AI is used.
 */

export const MIN_OBSERVATIONS = 5;
export const MIN_PROJECTS = 2;

export const CATEGORIES = [
  { id: "testing", label: "Testing", words: ["test", "qa", "bug", "debug", "quality"] },
  { id: "integration", label: "Integration", words: ["integrat", "connect", "merge", "hook up", "wire"] },
  { id: "design", label: "Design", words: ["design", "ui", "ux", "mockup", "wireframe", "logo", "prototype", "layout"] },
  { id: "building", label: "Building", words: ["build", "implement", "develop", "code", "api", "frontend", "backend", "feature", "database", "schema", "set up", "setup"] },
  { id: "research", label: "Research", words: ["research", "investigat", "explore", "sources", "analys", "survey", "interview"] },
  { id: "writing", label: "Writing", words: ["write", "draft", "report", "document", "docs", "essay", "content", "copy", "outline"] },
  { id: "review", label: "Review", words: ["review", "feedback", "revise", "edit", "proofread", "check"] },
  { id: "planning", label: "Planning", words: ["plan", "scope", "requirement", "brief", "kick", "goal", "define"] },
  { id: "delivery", label: "Delivery", words: ["deliver", "submit", "launch", "release", "deploy", "ship", "present", "hand over", "handover"] },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"] | "other";

export function categorise(title: string): CategoryId {
  const t = ` ${title.toLowerCase()} `;
  for (const c of CATEGORIES) if (c.words.some((w) => (w.length <= 3 ? new RegExp(`\\b${w}\\b`).test(t) : t.includes(w)))) return c.id;
  return "other";
}

export const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? "Other work";

export interface MemoryProject {
  id: string;
  name: string;
  deadline: DateOnly | null;
  status: "active" | "on_hold" | "completed";
  completedAt: string | null;
  tasks: DomainTask[];
  dependencies: DomainDependency[];
}

export interface Insight {
  key: string; // stable id, used for dismissals
  kind: "estimate" | "lateness" | "deadlines" | "blocking";
  category: CategoryId | null;
  tone: "warning" | "good";
  title: string;
  detail: string;
  observations: number;
  projectIds: string[];
  period: { from: DateOnly; to: DateOnly } | null;
  suggestion: string;
  multiplier?: number; // for estimate insights: suggested factor for new estimates
}

export interface CategoryStat {
  category: CategoryId;
  label: string;
  completed: number;
  withEstimate: number; // tasks with both estimate and actual effort
  medianRatio: number | null; // actual ÷ estimate
  withDueDate: number;
  late: number;
  avgDaysLate: number | null;
  projects: number;
}

export interface Retrospective {
  projectId: string;
  projectName: string;
  completed: boolean;
  deadline: DateOnly | null;
  finishedOn: DateOnly | null;
  daysVsDeadline: number | null; // positive = late
  tasksDone: number;
  tasksTotal: number;
  onTimeShare: number | null;
  lateTasks: { id: string; title: string; daysLate: number; blocked: number }[];
  overruns: { id: string; title: string; estimate: number; actual: number }[];
  estimateRatio: number | null;
}

export interface MemoryReport {
  insights: Insight[];
  stats: CategoryStat[];
  totals: { completedProjects: number; completedTasks: number; withEstimateAndActual: number; withDueDate: number };
  retrospectives: Retrospective[];
}

interface Obs {
  task: DomainTask;
  projectId: string;
  category: CategoryId;
  doneOn: DateOnly;
  ratio: number | null;
  daysLate: number | null; // null = no due date
  blocked: number; // tasks that waited on it
}

const round = (n: number, step = 0.05) => Math.round(n / step) * step;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, w: string) => `${n} ${n === 1 ? w : `${w}s`}`;

function collect(projects: MemoryProject[], timeZone: string): Obs[] {
  const obs: Obs[] = [];
  for (const p of projects) {
    const successors = new Map<string, number>();
    for (const d of p.dependencies) successors.set(d.predecessorId, (successors.get(d.predecessorId) ?? 0) + 1);
    for (const t of p.tasks) {
      if (t.status !== "done" || !t.completedAt) continue;
      const doneOn = dateOfTimestamp(t.completedAt, timeZone);
      obs.push({
        task: t,
        projectId: p.id,
        category: categorise(t.title),
        doneOn,
        ratio: t.estimateHours && t.estimateHours > 0 && t.actualHours != null && t.actualHours > 0 ? t.actualHours / t.estimateHours : null,
        daysLate: t.dueDate ? Math.max(0, daysBetween(t.dueDate, doneOn)) : null,
        blocked: successors.get(t.id) ?? 0,
      });
    }
  }
  return obs;
}

function period(obs: Obs[]) {
  if (!obs.length) return null;
  const dates = obs.map((o) => o.doneOn).sort(compareDates);
  return { from: dates[0], to: dates[dates.length - 1] };
}

export function buildMemory(projects: MemoryProject[], timeZone: string): MemoryReport {
  const obs = collect(projects, timeZone);
  const insights: Insight[] = [];

  // Per kind of work: estimates and lateness.
  const cats = [...new Set(obs.map((o) => o.category))];
  const stats: CategoryStat[] = cats
    .map((category) => {
      const all = obs.filter((o) => o.category === category);
      const est = all.filter((o) => o.ratio !== null);
      const due = all.filter((o) => o.daysLate !== null);
      const late = due.filter((o) => o.daysLate! > 0);
      return {
        category,
        label: categoryLabel(category),
        completed: all.length,
        withEstimate: est.length,
        medianRatio: est.length ? median(est.map((o) => o.ratio!)) : null,
        withDueDate: due.length,
        late: late.length,
        avgDaysLate: late.length ? late.reduce((s, o) => s + o.daysLate!, 0) / late.length : null,
        projects: new Set(all.map((o) => o.projectId)).size,
      };
    })
    .sort((a, b) => b.completed - a.completed);

  for (const s of stats) {
    const est = obs.filter((o) => o.category === s.category && o.ratio !== null);
    const estProjects = [...new Set(est.map((o) => o.projectId))];
    if (s.medianRatio !== null && est.length >= MIN_OBSERVATIONS && estProjects.length >= MIN_PROJECTS && Math.abs(s.medianRatio - 1) >= 0.15) {
      const over = s.medianRatio > 1;
      const m = round(s.medianRatio);
      insights.push({
        key: `estimate:${s.category}`,
        kind: "estimate",
        category: s.category,
        tone: over ? "warning" : "good",
        title: over
          ? `${s.label} usually takes about ${pct(s.medianRatio - 1)} longer than estimated`
          : `${s.label} usually takes about ${pct(1 - s.medianRatio)} less time than estimated`,
        detail: `Across ${plural(est.length, "completed task")} in ${plural(estProjects.length, "project")}, the typical ${s.label.toLowerCase()} task took ${m.toFixed(2)}× its estimate.`,
        observations: est.length,
        projectIds: estProjects,
        period: period(est),
        suggestion: over ? `When you estimate ${s.label.toLowerCase()} work, multiply your first guess by about ${m.toFixed(2)}.` : `Your ${s.label.toLowerCase()} estimates are on the cautious side. That's fine, just don't pad them further.`,
        multiplier: m,
      });
    }
    const due = obs.filter((o) => o.category === s.category && o.daysLate !== null);
    const dueProjects = [...new Set(due.map((o) => o.projectId))];
    if (due.length >= MIN_OBSERVATIONS && dueProjects.length >= MIN_PROJECTS && s.late / due.length >= 0.4) {
      insights.push({
        key: `lateness:${s.category}`,
        kind: "lateness",
        category: s.category,
        tone: "warning",
        title: `${s.label} often finishes after its due date`,
        detail: `${s.late} of ${due.length} ${s.label.toLowerCase()} tasks with a due date were finished late, by ${s.avgDaysLate!.toFixed(1)} days on average.`,
        observations: due.length,
        projectIds: dueProjects,
        period: period(due),
        suggestion: `Give ${s.label.toLowerCase()} tasks a few days of buffer, or start them earlier.`,
      });
    }
  }

  // Late work that other tasks were waiting on.
  const lateBlockers = obs.filter((o) => o.daysLate !== null && o.daysLate > 0 && o.blocked > 0);
  const blockerProjects = [...new Set(lateBlockers.map((o) => o.projectId))];
  if (lateBlockers.length >= 3 && blockerProjects.length >= MIN_PROJECTS) {
    insights.push({
      key: "blocking",
      kind: "blocking",
      category: null,
      tone: "warning",
      title: "Late tasks have repeatedly held up other work",
      detail: `${plural(lateBlockers.length, "task")} that other work depended on finished late, holding up ${plural(lateBlockers.reduce((s, o) => s + o.blocked, 0), "task")} between them.`,
      observations: lateBlockers.length,
      projectIds: blockerProjects,
      period: period(lateBlockers),
      suggestion: "Watch tasks that block others more closely. Pulse flags them when they slip; start them early.",
    });
  }

  // Project deadlines.
  const finished = projects.filter((p) => p.status === "completed" && p.completedAt && p.deadline);
  const lateProjects = finished.filter((p) => compareDates(dateOfTimestamp(p.completedAt!, timeZone), p.deadline!) > 0);
  if (finished.length >= 3 && lateProjects.length / finished.length >= 0.5) {
    insights.push({
      key: "deadlines",
      kind: "deadlines",
      category: null,
      tone: "warning",
      title: "Projects tend to finish after their deadline",
      detail: `${lateProjects.length} of ${finished.length} completed projects finished late.`,
      observations: finished.length,
      projectIds: finished.map((p) => p.id),
      period: null,
      suggestion: "When setting a new deadline, check Pulse's forecast after the first week and adjust early rather than late.",
    });
  }

  const retrospectives: Retrospective[] = projects
    .filter((p) => p.tasks.some((t) => t.status === "done"))
    .map((p) => retrospective(p, timeZone))
    .sort((a, b) => Number(b.completed) - Number(a.completed));

  return {
    insights,
    stats,
    totals: {
      completedProjects: projects.filter((p) => p.status === "completed").length,
      completedTasks: obs.length,
      withEstimateAndActual: obs.filter((o) => o.ratio !== null).length,
      withDueDate: obs.filter((o) => o.daysLate !== null).length,
    },
    retrospectives,
  };
}

export function retrospective(p: MemoryProject, timeZone: string): Retrospective {
  const obs = collect([p], timeZone);
  const finishedOn =
    p.status === "completed" && p.completedAt
      ? dateOfTimestamp(p.completedAt, timeZone)
      : obs.length && obs.length === p.tasks.length
        ? obs.map((o) => o.doneOn).sort(compareDates).at(-1)!
        : null;
  const due = obs.filter((o) => o.daysLate !== null);
  const est = obs.filter((o) => o.ratio !== null);
  return {
    projectId: p.id,
    projectName: p.name,
    completed: p.status === "completed",
    deadline: p.deadline,
    finishedOn,
    daysVsDeadline: finishedOn && p.deadline ? daysBetween(p.deadline, finishedOn) : null,
    tasksDone: obs.length,
    tasksTotal: p.tasks.length,
    onTimeShare: due.length ? due.filter((o) => o.daysLate === 0).length / due.length : null,
    lateTasks: due
      .filter((o) => o.daysLate! > 0)
      .sort((a, b) => b.daysLate! - a.daysLate!)
      .slice(0, 6)
      .map((o) => ({ id: o.task.id, title: o.task.title, daysLate: o.daysLate!, blocked: o.blocked })),
    overruns: est
      .filter((o) => o.ratio! >= 1.25)
      .sort((a, b) => b.ratio! - a.ratio!)
      .slice(0, 6)
      .map((o) => ({ id: o.task.id, title: o.task.title, estimate: o.task.estimateHours!, actual: o.task.actualHours! })),
    estimateRatio: est.length ? median(est.map((o) => o.ratio!)) : null,
  };
}

/** Suggestions to show while planning a new project, from Memory's estimate lessons. */
export function planningSuggestions(report: MemoryReport, taskTitles: string[]): { category: CategoryId; label: string; multiplier: number; reason: string; affected: string[] }[] {
  return report.insights
    .filter((i) => i.kind === "estimate" && i.multiplier && i.multiplier > 1 && i.category)
    .map((i) => ({
      category: i.category!,
      label: categoryLabel(i.category!),
      multiplier: i.multiplier!,
      reason: i.detail,
      affected: taskTitles.filter((t) => categorise(t) === i.category),
    }))
    .filter((s) => s.affected.length > 0);
}
