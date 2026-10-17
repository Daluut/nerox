import { addDays, compareDates, dateOfTimestamp, daysBetween, formatDate, fractionOfInterval } from "../domain/dates";
import { buildAdjacency } from "../domain/graph";
import { computeProgress, effortWeights } from "../domain/progress";
import { PRIORITY_LABEL, PRIORITY_RANK, isOpen, type DomainTask, type Priority } from "../domain/types";
import { ALGORITHM_VERSION, DEFAULT_CONFIG, FACTOR_KEYS, FACTOR_LABEL, type FactorKey, type PulseConfig } from "./config";
import {
  SEVERITY_RANK,
  type Assessment,
  type FactorResult,
  type Forecast,
  type HealthStatus,
  type PulseInput,
  type Risk,
  type Severity,
  type WorkloadEntry,
} from "./types";

/**
 * Nerox Pulse — deterministic, explainable project-health assessment.
 *
 * assessProject() is a pure function of its input: the same project data, date and
 * configuration always produce the same assessment. No AI is involved. Each factor
 * is normalised to 0–100 (100 = healthy); factors that can't be evaluated are left
 * out and the remaining weights are rescaled, with the gap reported as reduced
 * confidence rather than treated as perfect performance.
 */

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;
const PRIORITY_MULT: Record<Priority, number> = { low: 0.5, medium: 1, high: 1.5, urgent: 2 };

interface Ctx {
  input: PulseInput;
  cfg: PulseConfig;
  today: string;
  tasks: DomainTask[];
  open: DomainTask[];
  byId: Map<string, DomainTask>;
  weight: (t: DomainTask) => number;
  method: "effort" | "count";
  unit: "hours" | "tasks";
  down: Map<string, string[]>;
  up: Map<string, string[]>;
  openDownstream: (id: string) => DomainTask[];
  overdue: DomainTask[];
  daysOverdue: (t: DomainTask) => number;
  name: (userId: string | null) => string;
}

function buildContext(input: PulseInput): Ctx {
  const cfg = input.config ?? DEFAULT_CONFIG;
  const tasks = input.tasks;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const deps = input.dependencies.filter((d) => byId.has(d.predecessorId) && byId.has(d.successorId));
  const { down, up } = buildAdjacency(deps);
  const { method, weight } = effortWeights(tasks);
  const open = tasks.filter(isOpen);
  const today = input.today;
  const memo = new Map<string, DomainTask[]>();
  const openDownstream = (id: string) => {
    if (memo.has(id)) return memo.get(id)!;
    const seen = new Set<string>();
    const stack = [...(down.get(id) ?? [])];
    while (stack.length) {
      const n = stack.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...(down.get(n) ?? []));
    }
    const result = [...seen].map((s) => byId.get(s)!).filter(isOpen);
    memo.set(id, result);
    return result;
  };
  const overdue = open.filter((t) => t.dueDate && compareDates(t.dueDate, today) < 0);
  const names = new Map(input.members.map((m) => [m.userId, m.name]));
  return {
    input,
    cfg,
    today,
    tasks,
    open,
    byId,
    weight,
    method,
    unit: method === "effort" ? "hours" : "tasks",
    down,
    up,
    openDownstream,
    overdue,
    daysOverdue: (t) => (t.dueDate ? daysBetween(t.dueDate, today) : 0),
    name: (id) => (id ? (names.get(id) ?? "Former member") : "Unassigned"),
  };
}

const sumW = (ctx: Ctx, ts: DomainTask[]) => ts.reduce((s, t) => s + ctx.weight(t), 0);
const fmtEffort = (ctx: Ctx, v: number) => (ctx.unit === "hours" ? `${round1(v)} h` : plural(Math.round(v), "task"));
const listTitles = (ts: DomainTask[], max = 3) =>
  ts.slice(0, max).map((t) => `“${t.title}”`).join(", ") + (ts.length > max ? ` and ${ts.length - max} more` : "");

function unavailable(key: FactorKey, cfg: PulseConfig, reason: string): FactorResult {
  return {
    key,
    label: FACTOR_LABEL[key],
    weight: cfg.weights[key],
    effectiveWeight: 0,
    score: null,
    available: false,
    quality: "insufficient",
    summary: reason,
    details: [],
  };
}

function factor(
  key: FactorKey,
  cfg: PulseConfig,
  score: number,
  quality: "measured" | "proxy",
  summary: string,
  details: string[] = [],
): FactorResult {
  return {
    key,
    label: FACTOR_LABEL[key],
    weight: cfg.weights[key],
    effectiveWeight: 0,
    score: Math.round(clamp(score)),
    available: true,
    quality,
    summary,
    details,
  };
}

// ── Factors ────────────────────────────────────────────────────────────────

function paceFactor(ctx: Ctx): FactorResult {
  const { cfg, tasks, today, input } = ctx;
  if (!tasks.length) return unavailable("pace", cfg, "No tasks yet.");
  const withDue = tasks.filter((t) => t.dueDate);
  let expected: number;
  let actual: number;
  let basis: string;
  let quality: "measured" | "proxy";
  if (withDue.length / tasks.length >= 0.6) {
    const total = sumW(ctx, withDue);
    expected = sumW(ctx, withDue.filter((t) => compareDates(t.dueDate!, today) <= 0)) / total;
    actual = sumW(ctx, withDue.filter((t) => t.status === "done")) / total;
    basis = "planned due dates";
    quality = ctx.method === "effort" ? "measured" : "proxy";
  } else if (input.project.startDate && input.project.deadline) {
    expected = fractionOfInterval(today, input.project.startDate, input.project.deadline);
    actual = computeProgress(tasks).ratio;
    basis = "time elapsed between start and deadline";
    quality = "proxy";
  } else {
    return unavailable("pace", cfg, "Add due dates to tasks, or a start date and deadline, to measure pace.");
  }
  const gap = expected - actual;
  const score = gap <= 0 ? 100 : 100 - gap * 200;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const summary =
    gap <= 0.02
      ? `On or ahead of plan: ${pct(actual)} done vs ${pct(expected)} expected by today.`
      : `Behind plan: ${pct(actual)} done vs ${pct(expected)} expected by today.`;
  return factor("pace", cfg, score, quality, summary, [
    `Expected progress is based on ${basis}.`,
    ctx.method === "effort" ? "Weighted by effort estimates." : "Weighted by task count (effort estimates are sparse) — a less precise proxy.",
  ]);
}

function overdueFactor(ctx: Ctx): FactorResult {
  const { cfg, tasks, overdue } = ctx;
  if (!tasks.some((t) => t.dueDate)) return unavailable("overdue", cfg, "No tasks have due dates.");
  if (!overdue.length) return factor("overdue", cfg, 100, "measured", "No overdue tasks.");
  let penalty = 0;
  for (const t of overdue) {
    const downCount = Math.min(ctx.openDownstream(t.id).length, 4);
    penalty += 8 * PRIORITY_MULT[t.priority] * (1 + 0.5 * downCount) * (ctx.daysOverdue(t) > 7 ? 1.5 : 1);
  }
  const blocking = overdue.filter((t) => ctx.openDownstream(t.id).length > 0);
  return factor(
    "overdue",
    cfg,
    100 - penalty,
    "measured",
    `${plural(overdue.length, "task")} overdue${blocking.length ? `, ${blocking.length} blocking other work` : ""}.`,
    [
      "Each overdue task reduces the score more when it is high priority, blocks downstream work, or is over a week late.",
    ],
  );
}

function feasibilityFactor(ctx: Ctx, forecast: Forecast): FactorResult {
  const { cfg, input, open, today } = ctx;
  const deadline = input.project.deadline;
  if (!deadline) return unavailable("feasibility", cfg, "No project deadline set.");
  if (!open.length) return factor("feasibility", cfg, 100, "measured", "All tasks are complete.");
  if (compareDates(deadline, today) < 0)
    return factor("feasibility", cfg, 0, "measured", `The deadline passed ${plural(daysBetween(deadline, today), "day")} ago with work outstanding.`);
  if (forecast.basis === "velocity") {
    if (forecast.velocityPerDay === 0) {
      return factor("feasibility", cfg, 25, "proxy", `No work was completed in the last ${cfg.velocityWindowDays} days, so no finish date can be projected.`);
    }
    const daysLeft = daysBetween(today, deadline);
    const projectedDays = Math.max(1, daysBetween(today, forecast.projectedFinish!));
    const ratio = daysLeft / projectedDays;
    const score = ratio >= 1.15 ? 100 : ratio <= 0.5 ? 0 : ((ratio - 0.5) / 0.65) * 100;
    return factor(
      "feasibility",
      cfg,
      score,
      ctx.method === "effort" ? "measured" : "proxy",
      forecast.daysLate! > 0
        ? `At the recent pace, work is projected to finish ${plural(forecast.daysLate!, "day")} after the deadline.`
        : `At the recent pace, work is projected to finish by ${formatDate(forecast.projectedFinish, today)}, before the deadline.`,
      [forecast.note],
    );
  }
  const late = open.filter((t) => t.dueDate && compareDates(t.dueDate, deadline) > 0);
  if (late.length) {
    return factor("feasibility", cfg, 100 - 20 * late.length, "proxy", `${plural(late.length, "open task")} scheduled after the project deadline.`, [
      "Not enough completed work yet for a pace-based forecast; this checks the plan against the deadline instead.",
    ]);
  }
  return unavailable("feasibility", cfg, "Not enough completed work yet to forecast the finish date.");
}

function dependencyFactor(ctx: Ctx): FactorResult {
  const { cfg, input, byId } = ctx;
  const deps = input.dependencies.filter((d) => byId.has(d.predecessorId) && byId.has(d.successorId));
  if (!deps.length) return unavailable("dependencies", cfg, "No dependencies defined between tasks.");
  const openDeps = deps.filter((d) => isOpen(byId.get(d.predecessorId)!) && isOpen(byId.get(d.successorId)!));
  if (!openDeps.length) return factor("dependencies", cfg, 100, "measured", "All dependencies are resolved.");

  const blocked = blockedByOverdue(ctx);
  const conflicts = scheduleConflicts(ctx);
  const bottlenecks = findBottlenecks(ctx);
  const penalty = Math.min(60, blocked.size * 6) + conflicts.length * 10 + bottlenecks.length * 8;
  const parts = [
    blocked.size ? `${plural(blocked.size, "task")} waiting on overdue work` : null,
    conflicts.length ? `${plural(conflicts.length, "scheduling conflict")}` : null,
    bottlenecks.length ? `${plural(bottlenecks.length, "unstarted bottleneck")}` : null,
  ].filter(Boolean);
  return factor(
    "dependencies",
    cfg,
    100 - penalty,
    "proxy",
    parts.length ? `${parts.join(", ")}.` : "No dependency problems detected.",
    ["Simplified dependency heuristic: checks blocked chains, impossible orderings and bottlenecks. It is not a critical-path analysis."],
  );
}

function blockedByOverdue(ctx: Ctx): Set<string> {
  const blocked = new Set<string>();
  for (const t of ctx.overdue) for (const d of ctx.openDownstream(t.id)) blocked.add(d.id);
  return blocked;
}

function scheduleConflicts(ctx: Ctx) {
  const out: { pred: DomainTask; succ: DomainTask }[] = [];
  for (const [p, succs] of ctx.down) {
    const pred = ctx.byId.get(p)!;
    if (!isOpen(pred) || !pred.dueDate) continue;
    for (const s of succs) {
      const succ = ctx.byId.get(s)!;
      if (isOpen(succ) && succ.dueDate && compareDates(pred.dueDate, succ.dueDate) > 0) out.push({ pred, succ });
    }
  }
  return out;
}

function findBottlenecks(ctx: Ctx) {
  return ctx.open.filter((t) => {
    if (t.status !== "backlog" && t.status !== "todo") return false;
    if (ctx.openDownstream(t.id).length < 3) return false;
    const startPassed = t.startDate && compareDates(t.startDate, ctx.today) < 0;
    const dueSoon = t.dueDate && daysBetween(ctx.today, t.dueDate) <= 3;
    return !!(startPassed || dueSoon);
  });
}

function computeWorkload(ctx: Ctx): WorkloadEntry[] {
  const people = new Set(ctx.input.members.map((m) => m.userId));
  for (const t of ctx.open) if (t.assigneeId) people.add(t.assigneeId);
  const totalAssigned = sumW(ctx, ctx.open.filter((t) => t.assigneeId));
  return [...people]
    .map((userId) => {
      const mine = ctx.open.filter((t) => t.assigneeId === userId);
      const effort = sumW(ctx, mine);
      return {
        userId,
        name: ctx.name(userId),
        openTasks: mine.length,
        openEffort: round1(effort),
        overdue: mine.filter((t) => ctx.overdue.includes(t)).length,
        dueSoon: mine.filter((t) => t.dueDate && daysBetween(ctx.today, t.dueDate) >= 0 && daysBetween(ctx.today, t.dueDate) <= 7).length,
        share: totalAssigned > 0 ? effort / totalAssigned : 0,
      };
    })
    .sort((a, b) => b.openEffort - a.openEffort);
}

function workloadFactor(ctx: Ctx, workload: WorkloadEntry[]): FactorResult {
  const { cfg } = ctx;
  if (workload.length < 2) return unavailable("workload", cfg, "Fewer than two people are involved in this project.");
  const assigned = ctx.open.filter((t) => t.assigneeId);
  if (assigned.length < 3) return unavailable("workload", cfg, "Too few assigned open tasks to judge balance.");
  const total = workload.reduce((s, w) => s + w.openEffort, 0);
  const mean = total / workload.length;
  const top = workload[0];
  const ratio = mean > 0 ? top.openEffort / mean : 1;
  const score = ratio <= 1.5 ? 100 : ratio >= 3 ? 20 : 100 - ((ratio - 1.5) / 1.5) * 80;
  return factor(
    "workload",
    cfg,
    score,
    "proxy",
    ratio <= 1.5
      ? "Outstanding work is reasonably balanced."
      : `${top.name} holds ${Math.round(top.share * 100)}% of assigned open work across ${workload.length} people.`,
    ["Compares outstanding work only — individual capacity and availability aren't tracked."],
  );
}

interface StalledHit {
  task: DomainTask;
  kind: "stalled" | "not_started";
  days: number;
  threshold: number;
}

function findStalled(ctx: Ctx): { candidates: number; hits: StalledHit[] } {
  const { cfg, today, open } = ctx;
  const hits: StalledHit[] = [];
  let candidates = 0;
  for (const t of open) {
    if (t.status === "in_progress" || t.status === "in_review") {
      candidates++;
      const since = daysBetween(dateOfTimestamp(t.statusChangedAt, ctx.input.timeZone), today);
      const estimateDays = t.estimateHours ? Math.ceil(t.estimateHours / 6) : 0;
      const threshold = Math.max(cfg.stalledDays[t.priority], Math.ceil(estimateDays * 1.5));
      if (since > threshold) hits.push({ task: t, kind: "stalled", days: since, threshold });
    } else if (t.startDate && compareDates(t.startDate, today) < 0) {
      // Waiting on unfinished predecessors is expected, not stalled.
      const waiting = (ctx.up.get(t.id) ?? []).some((p) => isOpen(ctx.byId.get(p)!));
      if (waiting) continue;
      candidates++;
      const late = daysBetween(t.startDate, today);
      if (late > cfg.notStartedGraceDays) hits.push({ task: t, kind: "not_started", days: late, threshold: cfg.notStartedGraceDays });
    }
  }
  return { candidates, hits };
}

function stalledFactor(ctx: Ctx, stalled: ReturnType<typeof findStalled>): FactorResult {
  const { cfg } = ctx;
  if (!stalled.candidates)
    return unavailable("stalled", cfg, "No tasks are in progress or past their planned start.");
  const n = stalled.hits.length;
  return factor(
    "stalled",
    cfg,
    100 * (1 - n / stalled.candidates),
    "measured",
    n ? `${plural(n, "task")} of ${stalled.candidates} active or due-to-start ${n === 1 ? "has" : "have"} stopped moving.` : "Active work is moving.",
    [
      `A task is stalled after ${cfg.stalledDays.urgent}/${cfg.stalledDays.high}/${cfg.stalledDays.medium}/${cfg.stalledDays.low} days (urgent/high/medium/low) in the same status, longer for large estimates.`,
      "Tasks waiting on unfinished predecessors are not counted.",
    ],
  );
}

function milestoneState(ctx: Ctx) {
  const { today } = ctx;
  const ms = ctx.input.milestones;
  const overdue = ms.filter((m) => !m.completedAt && m.targetDate && compareDates(m.targetDate, today) < 0);
  const atRisk = ms.filter((m) => {
    if (m.completedAt || !m.targetDate) return false;
    const d = daysBetween(today, m.targetDate);
    if (d < 0 || d > 7) return false;
    const linked = ctx.tasks.filter((t) => t.milestoneId === m.id);
    if (!linked.length) return false;
    const done = sumW(ctx, linked.filter((t) => t.status === "done")) / sumW(ctx, linked);
    return done < 0.5;
  });
  return { overdue, atRisk };
}

function milestoneFactor(ctx: Ctx, state: ReturnType<typeof milestoneState>): FactorResult {
  const { cfg } = ctx;
  const ms = ctx.input.milestones;
  if (!ms.length) return unavailable("milestones", cfg, "No milestones defined.");
  if (!ms.some((m) => m.targetDate || m.completedAt)) return unavailable("milestones", cfg, "Milestones have no target dates.");
  const score = 100 - state.overdue.length * 35 - state.atRisk.length * 15;
  const done = ms.filter((m) => m.completedAt).length;
  return factor(
    "milestones",
    cfg,
    score,
    "measured",
    state.overdue.length
      ? `${plural(state.overdue.length, "milestone")} past target date.`
      : state.atRisk.length
        ? `${plural(state.atRisk.length, "milestone")} due within a week with most linked work open.`
        : `${done} of ${ms.length} milestones complete; none overdue.`,
  );
}

// ── Forecast ───────────────────────────────────────────────────────────────

function computeForecast(ctx: Ctx): Forecast {
  const { cfg, input, open, tasks, today } = ctx;
  const deadline = input.project.deadline;
  const remaining = round1(sumW(ctx, open));
  const base = { unit: ctx.unit, remaining, deadline } as const;
  if (!open.length) return { ...base, basis: "complete", velocityPerDay: null, projectedFinish: null, daysLate: null, note: "All tasks complete." };
  if (deadline && compareDates(deadline, today) < 0)
    return { ...base, basis: "deadline_passed", velocityPerDay: null, projectedFinish: null, daysLate: daysBetween(deadline, today), note: "The deadline has passed." };

  const done = tasks.filter((t) => t.status === "done" && t.completedAt);
  const age = daysBetween(dateOfTimestamp(input.project.createdAt, input.timeZone), today);
  if (done.length < cfg.minCompletionsForForecast || age < cfg.minProjectAgeForForecast) {
    return {
      ...base,
      basis: "none",
      velocityPerDay: null,
      projectedFinish: null,
      daysLate: null,
      note: `A forecast needs at least ${cfg.minCompletionsForForecast} completed tasks and ${cfg.minProjectAgeForForecast} days of history.`,
    };
  }
  const windowStart = addDays(today, -cfg.velocityWindowDays);
  const recent = done.filter((t) => compareDates(dateOfTimestamp(t.completedAt!, input.timeZone), windowStart) > 0);
  const window = Math.min(cfg.velocityWindowDays, Math.max(1, age));
  const velocity = sumW(ctx, recent) / window;
  if (velocity === 0) {
    return { ...base, basis: "velocity", velocityPerDay: 0, projectedFinish: null, daysLate: null, note: `No tasks completed in the last ${cfg.velocityWindowDays} days.` };
  }
  const projectedFinish = addDays(today, Math.ceil(remaining / velocity));
  return {
    ...base,
    basis: "velocity",
    velocityPerDay: Math.round(velocity * 100) / 100,
    projectedFinish,
    daysLate: deadline ? daysBetween(deadline, projectedFinish) : null,
    note: `Assumes the next weeks match the last ${window} days: ${fmtEffort(ctx, sumW(ctx, recent))} completed, ${fmtEffort(ctx, remaining)} remaining. Linear extrapolation, not a probability.`,
  };
}

// ── Risks ──────────────────────────────────────────────────────────────────

function detectRisks(
  ctx: Ctx,
  forecast: Forecast,
  workload: WorkloadEntry[],
  stalled: ReturnType<typeof findStalled>,
  ms: ReturnType<typeof milestoneState>,
): Risk[] {
  const { today, input, open } = ctx;
  const risks: Risk[] = [];
  const deadline = input.project.deadline;
  const dueLine = (t: DomainTask) => (t.dueDate ? `Due ${formatDate(t.dueDate, today)}` : "No due date");

  if (deadline && compareDates(deadline, today) < 0 && open.length) {
    risks.push({
      id: "deadline_passed",
      kind: "deadline_passed",
      severity: "critical",
      basis: "observed",
      title: "The project deadline has passed",
      evidence: [`Deadline was ${formatDate(deadline, today)} (${plural(daysBetween(deadline, today), "day")} ago).`, `${plural(open.length, "task")} still open.`],
      consequence: "Deliverables tied to this deadline are late.",
      recommendation: "Agree a revised deadline with stakeholders, or cut scope to what's essential.",
      actions: [{ kind: "open_list", label: "Review open tasks" }],
      taskIds: [],
      milestoneIds: [],
      weight: 100,
    });
  }

  for (const t of ctx.overdue) {
    const days = ctx.daysOverdue(t);
    const downstream = ctx.openDownstream(t.id);
    const rank = PRIORITY_RANK[t.priority];
    const severity: Severity =
      (rank >= 2 && downstream.length >= 2) || (rank >= 2 && days > 7)
        ? "critical"
        : rank >= 2 || downstream.length >= 1
          ? "high"
          : rank === 1
            ? "medium"
            : "low";
    const evidence = [
      `${dueLine(t)} — ${plural(days, "day")} overdue.`,
      `Priority: ${PRIORITY_LABEL[t.priority]}. ${t.assigneeId ? `Assigned to ${ctx.name(t.assigneeId)}.` : "Unassigned."}`,
    ];
    if (downstream.length) evidence.push(`Blocks ${plural(downstream.length, "open task")}: ${listTitles(downstream)}.`);
    const actions: Risk["actions"] = [{ kind: "open_task", label: "Open task", taskId: t.id }];
    if (!t.assigneeId) actions.push({ kind: "assign", label: "Assign someone", taskId: t.id });
    actions.push({ kind: "reschedule", label: "Update due date", taskId: t.id });
    risks.push({
      id: `overdue:${t.id}`,
      kind: "overdue_task",
      severity,
      basis: downstream.length ? "rule" : "observed",
      title: downstream.length ? `“${t.title}” is overdue and blocking work` : `“${t.title}” is overdue`,
      evidence,
      consequence: downstream.length
        ? `Dependent work can't proceed on schedule until this is finished.`
        : rank >= 2
          ? "High-priority work is slipping past its planned date."
          : null,
      recommendation: downstream.length
        ? "Unblock this first: confirm what's left, add help if needed, or re-sequence dependent work."
        : "Confirm the remaining work and set a realistic new date.",
      actions,
      taskIds: [t.id, ...downstream.map((d) => d.id)],
      milestoneIds: [],
      weight: rank * 10 + downstream.length * 5 + Math.min(days, 30),
    });
  }

  for (const { pred, succ } of scheduleConflicts(ctx)) {
    risks.push({
      id: `conflict:${pred.id}:${succ.id}`,
      kind: "schedule_conflict",
      severity: "medium",
      basis: "rule",
      title: `“${succ.title}” is due before the task it depends on`,
      evidence: [`“${succ.title}” is due ${formatDate(succ.dueDate, today)}.`, `It depends on “${pred.title}”, due ${formatDate(pred.dueDate, today)}.`],
      consequence: `As planned, “${succ.title}” can't be finished on time.`,
      recommendation: "Move one of the dates or remove the dependency if it isn't real.",
      actions: [
        { kind: "open_task", label: `Open “${succ.title}”`, taskId: succ.id },
        { kind: "review_dependencies", label: "Review dependencies", taskId: succ.id },
      ],
      taskIds: [succ.id, pred.id],
      milestoneIds: [],
      weight: 20,
    });
  }

  for (const t of findBottlenecks(ctx)) {
    if (ctx.overdue.includes(t)) continue; // already reported as an overdue, blocking task
    const downstream = ctx.openDownstream(t.id);
    risks.push({
      id: `bottleneck:${t.id}`,
      kind: "bottleneck",
      severity: "high",
      basis: "rule",
      title: `“${t.title}” hasn't started but ${downstream.length} tasks depend on it`,
      evidence: [
        `Status: ${t.status === "todo" ? "To Do" : "Backlog"}.`,
        t.startDate && compareDates(t.startDate, today) < 0 ? `Planned start was ${formatDate(t.startDate, today)}.` : `${dueLine(t)}.`,
        `Downstream: ${listTitles(downstream)}.`,
      ],
      consequence: "Any delay here passes on to every dependent task.",
      recommendation: "Start this task or make sure it has an owner with time for it.",
      actions: [{ kind: "open_task", label: "Open task", taskId: t.id }, ...(t.assigneeId ? [] : [{ kind: "assign" as const, label: "Assign someone", taskId: t.id }])],
      taskIds: [t.id, ...downstream.map((d) => d.id)],
      milestoneIds: [],
      weight: 25 + downstream.length * 5,
    });
  }

  for (const h of stalled.hits) {
    const t = h.task;
    if (ctx.overdue.includes(t) && h.kind === "not_started") continue; // already reported as overdue
    const high = PRIORITY_RANK[t.priority] >= 2;
    risks.push({
      id: `${h.kind}:${t.id}`,
      kind: h.kind === "stalled" ? "stalled_task" : "not_started",
      severity: high ? "high" : "medium",
      basis: "rule",
      title: h.kind === "stalled" ? `“${t.title}” has stalled` : `“${t.title}” hasn't started`,
      evidence:
        h.kind === "stalled"
          ? [
              `In ${t.status === "in_review" ? "In Review" : "In Progress"} for ${plural(h.days, "day")} without a status change (threshold ${h.threshold}).`,
              `Priority: ${PRIORITY_LABEL[t.priority]}. ${dueLine(t)}.`,
            ]
          : [`Planned start was ${formatDate(t.startDate, today)} — ${plural(h.days, "day")} ago.`, "Its predecessors are complete, so nothing is blocking it."],
      consequence: t.dueDate ? `Risks missing its due date of ${formatDate(t.dueDate, today)}.` : null,
      recommendation:
        h.kind === "stalled" ? "Check in with the assignee: is it blocked, larger than expected, or just not updated?" : "Start it, or move the planned start if priorities changed.",
      actions: [{ kind: "open_task", label: "Open task", taskId: t.id }],
      taskIds: [t.id],
      milestoneIds: [],
      weight: PRIORITY_RANK[t.priority] * 5 + h.days,
    });
  }

  if (workload.length >= 2 && ctx.open.filter((t) => t.assigneeId).length >= 3) {
    const total = workload.reduce((s, w) => s + w.openEffort, 0);
    const mean = total / workload.length;
    const top = workload[0];
    if (mean > 0 && top.openEffort / mean > 1.5 && top.openTasks >= 3) {
      const lightest = workload[workload.length - 1];
      risks.push({
        id: `workload:${top.userId}`,
        kind: "workload_imbalance",
        severity: top.openEffort / mean >= 2.5 && top.dueSoon >= 2 ? "high" : "medium",
        basis: "rule",
        title: `${top.name} has a much larger share of open work`,
        evidence: [
          `${top.name}: ${plural(top.openTasks, "open task")} (${fmtEffort(ctx, top.openEffort)}), ${Math.round(top.share * 100)}% of assigned work.`,
          `Average across ${workload.length} people: ${fmtEffort(ctx, mean)}. ${lightest.name}: ${fmtEffort(ctx, lightest.openEffort)}.`,
          ...(top.dueSoon ? [`${plural(top.dueSoon, "of their tasks is", "of their tasks are")} due within 7 days.`] : []),
        ],
        consequence: "Work concentrated on one person tends to queue up and finish late.",
        recommendation: "Consider reassigning or splitting a suitable task. Capacity isn't tracked, so check availability first.",
        actions: [{ kind: "open_list", label: "Review assignments" }],
        taskIds: ctx.open.filter((t) => t.assigneeId === top.userId).map((t) => t.id),
        milestoneIds: [],
        weight: Math.round(top.share * 50),
      });
    }
  }

  const unassigned = open.filter(
    (t) => !t.assigneeId && (PRIORITY_RANK[t.priority] >= 2 || (t.dueDate && daysBetween(today, t.dueDate) <= 7)),
  );
  if (unassigned.length) {
    risks.push({
      id: "unassigned",
      kind: "unassigned_work",
      severity: unassigned.some((t) => t.dueDate && daysBetween(today, t.dueDate) <= 3) ? "high" : "medium",
      basis: "observed",
      title: `${plural(unassigned.length, "important task")} ${unassigned.length === 1 ? "has" : "have"} no owner`,
      evidence: [`Unassigned high-priority or due-soon work: ${listTitles(unassigned)}.`],
      consequence: "Work without an owner is easy for everyone to assume someone else is doing.",
      recommendation: "Give each of these a single owner.",
      actions: unassigned.slice(0, 3).map((t) => ({ kind: "assign" as const, label: `Assign “${t.title}”`, taskId: t.id })),
      taskIds: unassigned.map((t) => t.id),
      milestoneIds: [],
      weight: unassigned.length * 4,
    });
  }

  const soon = open.filter((t) => PRIORITY_RANK[t.priority] >= 2 && t.dueDate && daysBetween(today, t.dueDate) >= 0 && daysBetween(today, t.dueDate) <= 1);
  if (soon.length >= 2) {
    risks.push({
      id: "due_soon",
      kind: "due_soon_cluster",
      severity: "medium",
      basis: "observed",
      title: `${soon.length} high-priority tasks are due by tomorrow`,
      evidence: soon.slice(0, 4).map((t) => `“${t.title}” — ${dueLine(t)}, ${ctx.name(t.assigneeId)}.`),
      consequence: null,
      recommendation: "Check each one is on track today; renegotiate early if not.",
      actions: soon.slice(0, 3).map((t) => ({ kind: "open_task" as const, label: `Open “${t.title}”`, taskId: t.id })),
      taskIds: soon.map((t) => t.id),
      milestoneIds: [],
      weight: soon.length * 5,
    });
  }

  if (forecast.basis === "velocity" && forecast.daysLate !== null && forecast.daysLate > 0) {
    risks.push({
      id: "forecast_late",
      kind: "forecast_late",
      severity: forecast.daysLate > 7 ? "high" : "medium",
      basis: "forecast",
      title: `At the current pace, the project finishes about ${plural(forecast.daysLate, "day")} late`,
      evidence: [
        `Projected finish ${formatDate(forecast.projectedFinish, today)} vs deadline ${formatDate(forecast.deadline, today)}.`,
        forecast.note,
      ],
      consequence: "The deadline will slip unless pace increases or scope shrinks.",
      recommendation: "Look for scope to cut or defer, unblock overdue work, or agree a later deadline early.",
      actions: [{ kind: "open_list", label: "Review remaining work" }],
      taskIds: [],
      milestoneIds: [],
      weight: forecast.daysLate,
    });
  }

  if (deadline && compareDates(deadline, today) >= 0) {
    const late = open.filter((t) => t.dueDate && compareDates(t.dueDate, deadline) > 0);
    if (late.length) {
      risks.push({
        id: "after_deadline",
        kind: "scheduled_after_deadline",
        severity: "medium",
        basis: "rule",
        title: `${plural(late.length, "task is", "tasks are")} scheduled after the project deadline`,
        evidence: [`Deadline ${formatDate(deadline, today)}. Late: ${listTitles(late)}.`],
        consequence: "The plan as written doesn't fit the deadline.",
        recommendation: "Bring these dates forward or confirm they're intentionally out of scope.",
        actions: late.slice(0, 3).map((t) => ({ kind: "reschedule" as const, label: `Reschedule “${t.title}”`, taskId: t.id })),
        taskIds: late.map((t) => t.id),
        milestoneIds: [],
        weight: late.length * 3,
      });
    }
  }

  for (const m of ms.overdue) {
    risks.push({
      id: `milestone_overdue:${m.id}`,
      kind: "milestone_overdue",
      severity: "high",
      basis: "observed",
      title: `Milestone “${m.name}” is past its target date`,
      evidence: [`Target was ${formatDate(m.targetDate, today)} (${plural(daysBetween(m.targetDate!, today), "day")} ago) and it isn't marked complete.`],
      consequence: "Later work planned around this milestone may also be late.",
      recommendation: "Mark it complete if it's done, or set a new target and tell the team.",
      actions: [{ kind: "open_milestones", label: "Review milestones" }],
      taskIds: [],
      milestoneIds: [m.id],
      weight: 30,
    });
  }
  for (const m of ms.atRisk) {
    const linked = ctx.tasks.filter((t) => t.milestoneId === m.id);
    const openLinked = linked.filter(isOpen);
    risks.push({
      id: `milestone_risk:${m.id}`,
      kind: "milestone_at_risk",
      severity: "medium",
      basis: "rule",
      title: `Milestone “${m.name}” is close with most work open`,
      evidence: [`Target ${formatDate(m.targetDate, today)}.`, `${openLinked.length} of ${linked.length} linked tasks still open.`],
      consequence: "The milestone may be missed.",
      recommendation: "Focus the team on the linked tasks or move the target.",
      actions: [{ kind: "open_milestones", label: "Review milestones" }],
      taskIds: openLinked.map((t) => t.id),
      milestoneIds: [m.id],
      weight: 15,
    });
  }

  // Activity drop: compares two equal 14-day windows so weekends are included in both.
  const done = ctx.tasks.filter((t) => t.status === "done" && t.completedAt).map((t) => dateOfTimestamp(t.completedAt!, input.timeZone));
  const recentStart = addDays(today, -14);
  const priorStart = addDays(today, -28);
  const recentCount = done.filter((d) => compareDates(d, recentStart) > 0).length;
  const priorCount = done.filter((d) => compareDates(d, priorStart) > 0 && compareDates(d, recentStart) <= 0).length;
  if (open.length && priorCount >= 4 && recentCount <= priorCount * 0.25) {
    risks.push({
      id: "activity_drop",
      kind: "activity_drop",
      severity: "medium",
      basis: "rule",
      title: "Completion activity has dropped sharply",
      evidence: [`${plural(recentCount, "task")} completed in the last 14 days vs ${priorCount} in the 14 days before.`],
      consequence: "If this continues, remaining work will take much longer than planned.",
      recommendation: "Check whether this is expected (holidays, exams) or a sign the team is blocked.",
      actions: [{ kind: "open_list", label: "Review open work" }],
      taskIds: [],
      milestoneIds: [],
      weight: priorCount - recentCount,
    });
  }

  return risks.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.weight - a.weight);
}

// ── Assessment ─────────────────────────────────────────────────────────────

export function statusForScore(score: number, cfg: PulseConfig = DEFAULT_CONFIG): HealthStatus {
  if (score >= cfg.bands.healthy) return "healthy";
  if (score >= cfg.bands.attention) return "attention";
  if (score >= cfg.bands.atRisk) return "at_risk";
  return "critical";
}

export function assessProject(input: PulseInput): Assessment {
  const ctx = buildContext(input);
  const cfg = ctx.cfg;
  const forecast = computeForecast(ctx);
  const workload = computeWorkload(ctx);
  const stalled = findStalled(ctx);
  const ms = milestoneState(ctx);

  const byKey: Record<FactorKey, FactorResult> = {
    pace: paceFactor(ctx),
    overdue: overdueFactor(ctx),
    feasibility: feasibilityFactor(ctx, forecast),
    dependencies: dependencyFactor(ctx),
    workload: workloadFactor(ctx, workload),
    stalled: stalledFactor(ctx, stalled),
    milestones: milestoneFactor(ctx, ms),
  };
  const factors = FACTOR_KEYS.map((k) => byKey[k]);

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  const availableWeight = factors.filter((f) => f.available).reduce((s, f) => s + f.weight, 0);
  const weightCoverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
  for (const f of factors) f.effectiveWeight = f.available && availableWeight > 0 ? f.weight / availableWeight : 0;

  const limitations: string[] = [];
  const progress = computeProgress(ctx.tasks);
  let score: number | null = null;
  let status: HealthStatus = "insufficient_data";
  let confidence: Assessment["confidence"] = "none";

  if (ctx.tasks.length < cfg.minTasks) {
    limitations.push(`Pulse needs at least ${cfg.minTasks} tasks to assess a project (this one has ${ctx.tasks.length}).`);
  } else if (weightCoverage < cfg.minWeightCoverage) {
    limitations.push(`Only ${Math.round(weightCoverage * 100)}% of the health model could be measured, so no score is shown.`);
  } else {
    score = Math.round(factors.reduce((s, f) => s + (f.score ?? 0) * f.effectiveWeight, 0));
    status = statusForScore(score, cfg);
    const proxies = factors.filter((f) => f.available && f.quality === "proxy").reduce((s, f) => s + f.weight, 0);
    confidence = weightCoverage >= 0.85 && proxies / availableWeight <= 0.4 ? "high" : weightCoverage >= 0.6 ? "medium" : "low";
  }

  for (const f of factors) if (!f.available) limitations.push(`${f.label} not assessed: ${f.summary}`);
  if (progress.method === "count" && ctx.tasks.length)
    limitations.push(
      `Only ${Math.round(progress.estimateCoverage * 100)}% of tasks have effort estimates, so progress counts tasks rather than effort.`,
    );
  const noDue = ctx.open.filter((t) => !t.dueDate).length;
  if (noDue) limitations.push(`${plural(noDue, "open task")} ${noDue === 1 ? "has" : "have"} no due date and can't be checked for lateness.`);

  return {
    projectId: input.project.id,
    score,
    status,
    confidence,
    weightCoverage,
    factors,
    risks: detectRisks(ctx, forecast, workload, stalled, ms),
    limitations,
    progress,
    forecast,
    workload,
    counts: {
      total: ctx.tasks.length,
      open: ctx.open.length,
      done: ctx.tasks.length - ctx.open.length,
      overdue: ctx.overdue.length,
      blocked: blockedByOverdue(ctx).size,
      stalled: stalled.hits.length,
      unassigned: ctx.open.filter((t) => !t.assigneeId).length,
    },
    today: input.today,
    assessedAt: input.now.toISOString(),
    algorithmVersion: ALGORITHM_VERSION,
  };
}
