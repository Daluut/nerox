import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, resolveConfig } from "@/lib/pulse/config";
import { assessProject, statusForScore } from "@/lib/pulse/engine";
import { dep, input, project, task } from "./fixtures";

const healthyTasks = () => [
  task({ id: "a", status: "done", dueDate: "2026-10-01", estimateHours: 8, assigneeId: "u1", completedAt: "2026-10-01T15:00:00Z" }),
  task({ id: "b", status: "done", dueDate: "2026-10-08", estimateHours: 8, assigneeId: "u2", completedAt: "2026-10-07T15:00:00Z" }),
  task({ id: "c", status: "done", dueDate: "2026-10-14", estimateHours: 8, assigneeId: "u3", completedAt: "2026-10-13T15:00:00Z" }),
  task({ id: "d", status: "in_progress", dueDate: "2026-10-24", estimateHours: 8, assigneeId: "u2", statusChangedAt: "2026-10-15T09:00:00Z" }),
  task({ id: "e", status: "todo", startDate: "2026-10-25", dueDate: "2026-11-05", estimateHours: 8, assigneeId: "u3" }),
  task({ id: "f", status: "todo", startDate: "2026-11-01", dueDate: "2026-11-12", estimateHours: 8, assigneeId: "u1" }),
];
const healthyDeps = [dep("c", "d"), dep("d", "e"), dep("e", "f")];

describe("Pulse — healthy project", () => {
  const a = assessProject(
    input({ tasks: healthyTasks(), dependencies: healthyDeps, milestones: [{ id: "m1", name: "Beta", targetDate: "2026-11-01", completedAt: null }] }),
  );

  it("scores a project on plan as healthy with high confidence", () => {
    expect(a.status).toBe("healthy");
    expect(a.score).toBe(100);
    expect(a.confidence).toBe("high");
    expect(a.weightCoverage).toBe(1);
    expect(a.risks).toEqual([]);
  });

  it("uses effort-weighted progress", () => {
    expect(a.progress).toMatchObject({ method: "effort", percent: 50 });
  });

  it("forecasts from recent completion velocity and labels it as a forecast", () => {
    expect(a.forecast.basis).toBe("velocity");
    expect(a.forecast.projectedFinish).toBe("2026-11-07"); // 24 h remaining at 16 h / 14 days
    expect(a.forecast.daysLate).toBeLessThan(0);
    expect(a.forecast.note).toMatch(/not a probability/);
  });

  it("records version and timestamp for traceability", () => {
    expect(a.algorithmVersion).toBe("pulse-1.0.0");
    expect(a.assessedAt).toBe("2026-10-17T12:00:00.000Z");
  });

  it("is deterministic", () => {
    const again = assessProject(
      input({ tasks: healthyTasks(), dependencies: healthyDeps, milestones: [{ id: "m1", name: "Beta", targetDate: "2026-11-01", completedAt: null }] }),
    );
    expect(again).toEqual(a);
  });
});

describe("Pulse — Scenario B: overdue task blocking downstream work", () => {
  const tasks = [
    task({ id: "db", title: "Database schema", status: "done", dueDate: "2026-10-05", estimateHours: 8, assigneeId: "u1" }),
    task({ id: "api", title: "API implementation", status: "in_progress", priority: "high", dueDate: "2026-10-12", estimateHours: 16, assigneeId: "u2", statusChangedAt: "2026-10-05T09:00:00Z" }),
    task({ id: "fe", title: "Frontend integration", dueDate: "2026-10-24", estimateHours: 12, assigneeId: "u3" }),
    task({ id: "test", title: "Testing", dueDate: "2026-10-30", estimateHours: 8, assigneeId: "u1" }),
  ];
  const a = assessProject(input({ tasks, dependencies: [dep("db", "api"), dep("api", "fe"), dep("fe", "test")] }));
  const risk = a.risks.find((r) => r.id === "overdue:api")!;

  it("ranks the blocking overdue task as the top, critical risk", () => {
    expect(a.risks[0].id).toBe("overdue:api");
    expect(risk.severity).toBe("critical");
    expect(risk.basis).toBe("rule");
    expect(risk.title).toContain("blocking work");
  });

  it("explains the evidence and links affected tasks", () => {
    expect(risk.evidence.join(" ")).toMatch(/5 days overdue/);
    expect(risk.evidence.join(" ")).toMatch(/Blocks 2 open tasks: “Frontend integration”, “Testing”/);
    expect(risk.taskIds).toEqual(["api", "fe", "test"]);
    expect(risk.actions.map((x) => x.kind)).toContain("open_task");
    expect(risk.consequence).toBeTruthy();
  });

  it("lowers the score and counts blocked work", () => {
    expect(a.counts).toMatchObject({ overdue: 1, blocked: 2 });
    expect(a.status).not.toBe("healthy");
    expect(a.factors.find((f) => f.key === "overdue")!.score).toBeLessThan(80);
  });

  it("doesn't report an overdue blocker twice as a bottleneck", () => {
    const t = [
      task({ id: "root", status: "todo", priority: "high", startDate: "2026-10-01", dueDate: "2026-10-10" }),
      ...["a", "b", "c"].map((id) => task({ id, dueDate: "2026-10-30" })),
    ];
    const r = assessProject(input({ tasks: t, dependencies: [dep("root", "a"), dep("a", "b"), dep("b", "c")] }));
    expect(r.risks.some((x) => x.id === "overdue:root")).toBe(true);
    expect(r.risks.some((x) => x.kind === "bottleneck")).toBe(false);
  });

  it("also detects that the task has stalled", () => {
    expect(a.risks.some((r) => r.id === "stalled:api")).toBe(true);
  });

  it("weights a blocking high-priority overdue task more than a low-impact one", () => {
    const lowImpact = assessProject(
      input({
        tasks: [
          task({ id: "x", priority: "low", dueDate: "2026-10-12" }),
          task({ id: "y", dueDate: "2026-10-30" }),
          task({ id: "z", dueDate: "2026-10-30" }),
        ],
      }),
    );
    const overdueScore = (x: typeof a) => x.factors.find((f) => f.key === "overdue")!.score!;
    expect(overdueScore(lowImpact)).toBeGreaterThan(overdueScore(a));
    expect(lowImpact.risks.find((r) => r.id === "overdue:x")!.severity).toBe("low");
  });

  it("never changes data — recommendations are suggestions only", () => {
    expect(tasks.find((t) => t.id === "api")!.dueDate).toBe("2026-10-12");
  });
});

describe("Pulse — honest handling of missing data", () => {
  it("does not score projects with too few tasks", () => {
    const a = assessProject(input({ tasks: [task({ id: "a" }), task({ id: "b" })] }));
    expect(a.status).toBe("insufficient_data");
    expect(a.score).toBeNull();
    expect(a.confidence).toBe("none");
  });

  it("does not treat missing data as perfect performance", () => {
    const a = assessProject(
      input({ project: project({ deadline: null, startDate: null }), tasks: [task({ id: "a" }), task({ id: "b" }), task({ id: "c" })] }),
    );
    expect(a.score).toBeNull();
    expect(a.status).toBe("insufficient_data");
    expect(a.factors.every((f) => !f.available)).toBe(true);
    expect(a.limitations.length).toBeGreaterThan(3);
  });

  it("rescales weights over measurable factors and lowers confidence", () => {
    const a = assessProject(
      input({
        tasks: [
          task({ id: "a", status: "done", dueDate: "2026-10-01" }),
          task({ id: "b", dueDate: "2026-10-30" }),
          task({ id: "c", dueDate: "2026-11-05" }),
        ],
      }),
    );
    const available = a.factors.filter((f) => f.available);
    expect(a.weightCoverage).toBeLessThan(1);
    expect(available.reduce((s, f) => s + f.effectiveWeight, 0)).toBeCloseTo(1);
    expect(a.factors.filter((f) => !f.available).every((f) => f.effectiveWeight === 0)).toBe(true);
    expect(a.confidence).not.toBe("high");
    expect(a.limitations.some((l) => /counts tasks rather than effort/.test(l))).toBe(true);
  });
});

describe("Pulse — individual detections", () => {
  it("detects workload imbalance without inventing capacity", () => {
    const tasks = [
      ...[1, 2, 3, 4, 5].map((i) => task({ id: `a${i}`, assigneeId: "u1", estimateHours: 8, dueDate: "2026-10-22" })),
      task({ id: "b1", assigneeId: "u2", estimateHours: 8, dueDate: "2026-10-30" }),
    ];
    const a = assessProject(input({ tasks }));
    const w = a.factors.find((f) => f.key === "workload")!;
    expect(w.score).toBe(47);
    expect(w.quality).toBe("proxy");
    expect(w.details[0]).toMatch(/capacity/);
    const r = a.risks.find((x) => x.kind === "workload_imbalance")!;
    expect(r.title).toContain("Ana");
    expect(r.severity).toBe("high"); // 2.5× average with 5 tasks due within a week
    expect(a.workload[0]).toMatchObject({ userId: "u1", openTasks: 5, dueSoon: 5 });
  });

  it("flags stalled work but not tasks legitimately waiting on predecessors", () => {
    const tasks = [
      task({ id: "rev", status: "in_review", statusChangedAt: "2026-10-05T09:00:00Z", dueDate: "2026-10-30" }),
      task({ id: "pred", status: "in_progress", statusChangedAt: "2026-10-16T09:00:00Z", dueDate: "2026-10-25" }),
      task({ id: "waiting", status: "todo", startDate: "2026-10-10", dueDate: "2026-10-30" }),
      task({ id: "idle", status: "todo", startDate: "2026-10-10", dueDate: "2026-10-30" }),
    ];
    const a = assessProject(input({ tasks, dependencies: [dep("pred", "waiting")] }));
    const kinds = Object.fromEntries(a.risks.map((r) => [r.id, r.kind]));
    expect(kinds["stalled:rev"]).toBe("stalled_task");
    expect(kinds["not_started:idle"]).toBe("not_started");
    expect(kinds["not_started:waiting"]).toBeUndefined();
    expect(a.counts.stalled).toBe(2);
    expect(a.factors.find((f) => f.key === "stalled")!.score).toBe(33); // 2 of 3 candidates
  });

  it("allows more time before calling a large task stalled", () => {
    const big = task({ id: "big", status: "in_progress", statusChangedAt: "2026-10-09T09:00:00Z", estimateHours: 60, dueDate: "2026-11-10" });
    const a = assessProject(input({ tasks: [big, task({ id: "x" }), task({ id: "y" })] }));
    expect(a.risks.some((r) => r.id === "stalled:big")).toBe(false); // 8 days < 1.5 × 10-day estimate
  });

  it("forecasts a late finish and labels it as a forecast", () => {
    const tasks = [
      ...[1, 2, 3].map((i) => task({ id: `d${i}`, status: "done", estimateHours: 2, dueDate: "2026-10-10", completedAt: "2026-10-12T10:00:00Z" })),
      ...[1, 2, 3, 4, 5].map((i) => task({ id: `o${i}`, estimateHours: 8, dueDate: "2026-10-24" })),
    ];
    const a = assessProject(input({ project: project({ deadline: "2026-10-25" }), tasks }));
    const r = a.risks.find((x) => x.kind === "forecast_late")!;
    expect(r.basis).toBe("forecast");
    expect(a.forecast.daysLate).toBeGreaterThan(30);
    expect(a.factors.find((f) => f.key === "feasibility")!.score).toBe(0);
  });

  it("doesn't forecast without enough history", () => {
    const a = assessProject(input({ tasks: healthyTasks().map((t) => ({ ...t, status: "todo" as const, completedAt: null })) }));
    expect(a.forecast.basis).toBe("none");
    expect(a.risks.some((r) => r.kind === "forecast_late")).toBe(false);
  });

  it("detects a successor due before its predecessor", () => {
    const tasks = [task({ id: "p", dueDate: "2026-10-30" }), task({ id: "s", dueDate: "2026-10-25" }), task({ id: "x" })];
    const a = assessProject(input({ tasks, dependencies: [dep("p", "s")] }));
    expect(a.risks.find((r) => r.kind === "schedule_conflict")!.taskIds).toEqual(["s", "p"]);
  });

  it("reports a passed deadline as critical", () => {
    const a = assessProject(input({ project: project({ deadline: "2026-10-10" }), tasks: healthyTasks() }));
    expect(a.risks[0]).toMatchObject({ kind: "deadline_passed", severity: "critical", basis: "observed" });
    expect(a.factors.find((f) => f.key === "feasibility")!.score).toBe(0);
  });

  it("keeps priority and risk separate", () => {
    const a = assessProject(
      input({ tasks: [task({ id: "u", priority: "urgent", assigneeId: "u1", dueDate: "2026-10-27" }), task({ id: "x", dueDate: "2026-11-01" }), task({ id: "y", dueDate: "2026-11-02" })] }),
    );
    expect(a.risks.some((r) => r.taskIds.includes("u"))).toBe(false);
    expect(a.counts.overdue).toBe(0);
  });

  it("flags unassigned high-priority work and clusters due by tomorrow", () => {
    const a = assessProject(
      input({
        tasks: [
          task({ id: "h1", priority: "high", dueDate: "2026-10-18" }),
          task({ id: "h2", priority: "urgent", dueDate: "2026-10-17", assigneeId: "u1" }),
          task({ id: "x", dueDate: "2026-11-02" }),
        ],
      }),
    );
    expect(a.risks.find((r) => r.kind === "unassigned_work")!.taskIds).toEqual(["h1"]);
    expect(a.risks.find((r) => r.kind === "due_soon_cluster")!.title).toBe("2 high-priority tasks are due by tomorrow");
  });

  it("detects overdue milestones and close milestones with open work", () => {
    const tasks = [
      task({ id: "t1", milestoneId: "m2", dueDate: "2026-10-20" }),
      task({ id: "t2", milestoneId: "m2", dueDate: "2026-10-21" }),
      task({ id: "t3", dueDate: "2026-11-01" }),
    ];
    const a = assessProject(
      input({
        tasks,
        milestones: [
          { id: "m1", name: "Alpha", targetDate: "2026-10-10", completedAt: null },
          { id: "m2", name: "Beta", targetDate: "2026-10-22", completedAt: null },
        ],
      }),
    );
    expect(a.risks.find((r) => r.kind === "milestone_overdue")!.milestoneIds).toEqual(["m1"]);
    expect(a.risks.find((r) => r.kind === "milestone_at_risk")!.milestoneIds).toEqual(["m2"]);
    expect(a.factors.find((f) => f.key === "milestones")!.score).toBe(50);
  });

  it("detects a sharp drop in completions using equal two-week windows", () => {
    const done = [1, 2, 3, 4, 5].map((i) => task({ id: `d${i}`, status: "done", completedAt: `2026-09-${20 + i}T10:00:00Z`, dueDate: "2026-09-30" }));
    const a = assessProject(input({ tasks: [...done, task({ id: "o", dueDate: "2026-11-01" })] }));
    expect(a.risks.some((r) => r.kind === "activity_drop")).toBe(true);
  });
});

describe("Pulse configuration", () => {
  it("maps scores to configurable bands", () => {
    expect(statusForScore(80)).toBe("healthy");
    expect(statusForScore(79)).toBe("attention");
    expect(statusForScore(40)).toBe("at_risk");
    expect(statusForScore(39)).toBe("critical");
    expect(statusForScore(70, { ...DEFAULT_CONFIG, bands: { healthy: 70, attention: 50, atRisk: 30 } })).toBe("healthy");
  });

  it("ignores invalid stored configuration", () => {
    const c = resolveConfig({ weights: { pace: -5, overdue: "x", stalled: 40 }, bands: { healthy: 10, attention: 50, atRisk: 30 } });
    expect(c.weights.pace).toBe(20);
    expect(c.weights.overdue).toBe(20);
    expect(c.weights.stalled).toBe(40);
    expect(c.bands).toEqual(DEFAULT_CONFIG.bands);
    expect(resolveConfig({ weights: Object.fromEntries(Object.keys(DEFAULT_CONFIG.weights).map((k) => [k, 0])) }).weights).toEqual(DEFAULT_CONFIG.weights);
    expect(resolveConfig(null)).toEqual(DEFAULT_CONFIG);
  });

  it("applies custom weights to the score", () => {
    const tasks = [
      task({ id: "late", priority: "high", dueDate: "2026-10-10", assigneeId: "u1" }),
      task({ id: "b", dueDate: "2026-10-30", assigneeId: "u2" }),
      task({ id: "c", dueDate: "2026-11-05", assigneeId: "u3" }),
    ];
    const base = assessProject(input({ tasks }));
    const paceHeavy = assessProject(input({ tasks, config: resolveConfig({ weights: { ...DEFAULT_CONFIG.weights, pace: 80 } }) }));
    const pace = base.factors.find((f) => f.key === "pace")!.score!;
    expect(pace).toBe(33); // 0% done vs 33% expected
    expect(paceHeavy.score!).toBeLessThan(base.score!);
    // The published score is exactly the weighted mean of the available factors.
    const expected = paceHeavy.factors.reduce((s, f) => s + (f.score ?? 0) * f.effectiveWeight, 0);
    expect(paceHeavy.score).toBe(Math.round(expected));
  });
});
