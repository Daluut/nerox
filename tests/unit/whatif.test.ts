import { describe, expect, it } from "vitest";
import { describeChange, fingerprint, simulate, validateChanges } from "@/lib/whatif/engine";
import { dep, input, project, task } from "./fixtures";

// Scenario A/B from the brief: db → api → fe → test → ship, with slack between fe and test.
const tasks = () => [
  task({ id: "db", title: "Database", status: "done", startDate: "2026-10-05", dueDate: "2026-10-09", assigneeId: "u1" }),
  task({ id: "api", title: "API", status: "in_progress", startDate: "2026-10-12", dueDate: "2026-10-20", estimateHours: 30, assigneeId: "u2" }),
  task({ id: "fe", title: "Frontend integration", startDate: "2026-10-21", dueDate: "2026-10-27", estimateHours: 20, assigneeId: "u3" }),
  task({ id: "test", title: "Testing", startDate: "2026-10-30", dueDate: "2026-11-04", estimateHours: 12, assigneeId: "u1" }),
  task({ id: "ship", title: "Final delivery", startDate: "2026-11-05", dueDate: "2026-11-06", estimateHours: 4, assigneeId: "u1", milestoneId: "m1" }),
  task({ id: "docs", title: "Docs", startDate: "2026-10-26", dueDate: "2026-10-30", estimateHours: 6, assigneeId: "u3" }),
];
const deps = [dep("db", "api"), dep("api", "fe"), dep("fe", "test"), dep("test", "ship")];
const base = () =>
  input({
    project: project({ deadline: "2026-11-10" }),
    tasks: tasks(),
    dependencies: deps,
    milestones: [{ id: "m1", name: "Release", targetDate: "2026-11-07", completedAt: null }],
  });

describe("What If — delay propagation", () => {
  it("passes a delay down the dependency chain, absorbing slack", () => {
    const r = simulate(base(), [{ kind: "delay", taskId: "api", days: 5 }]);
    const shift = Object.fromEntries(r.moves.map((m) => [m.taskId, m.shiftDays]));
    expect(shift.api).toBe(5);
    expect(shift.fe).toBe(5);
    // fe → test had 2 days of slack (27 Oct → 30 Oct), so test moves 3.
    expect(shift.test).toBe(3);
    expect(shift.ship).toBe(3);
    expect(shift.docs).toBeUndefined(); // unrelated work doesn't move
    expect(r.moves.find((m) => m.taskId === "fe")!).toMatchObject({ cause: "dependency", causeTaskTitle: "API" });
  });

  it("reports the new finish against the deadline and affected milestones", () => {
    const r = simulate(base(), [{ kind: "delay", taskId: "api", days: 5 }]);
    expect(r.baselineFinish).toBe("2026-11-06");
    expect(r.scenarioFinish).toBe("2026-11-09");
    expect(r.finishShiftDays).toBe(3);
    expect(r.scenarioDaysVsDeadline).toBe(-1);
    expect(r.milestones[0]).toMatchObject({ name: "Release", wasLate: false, nowLate: true });
    expect(r.summary).toMatch(/4 tasks would move.*3 days later.*within the deadline/);
  });

  it("does not modify the input data", () => {
    const i = base();
    simulate(i, [{ kind: "delay", taskId: "api", days: 5 }]);
    expect(i.tasks.find((t) => t.id === "api")!.dueDate).toBe("2026-10-20");
  });

  it("plans the exact updates that applying would make", () => {
    const r = simulate(base(), [{ kind: "delay", taskId: "api", days: 5 }]);
    expect(r.updates.find((u) => u.taskId === "api")).toEqual({ taskId: "api", title: "API", dueDate: "2026-10-25" });
    expect(r.updates.find((u) => u.taskId === "fe")).toEqual({ taskId: "fe", title: "Frontend integration", dueDate: "2026-11-01", startDate: "2026-10-26" });
  });

  it("models a task taking twice as long", () => {
    const r = simulate(base(), [{ kind: "duration", taskId: "fe", factor: 2 }]);
    expect(r.moves.find((m) => m.taskId === "fe")!.shiftDays).toBe(7); // 7-day task becomes 14
    expect(r.moves.find((m) => m.taskId === "test")!.shiftDays).toBe(5);
  });

  it("never moves later work earlier when something finishes early", () => {
    const r = simulate(base(), [{ kind: "finish_early", taskId: "api", days: 3 }]);
    expect(r.moves.map((m) => m.taskId)).toEqual(["api"]);
    expect(r.finishShiftDays).toBe(0);
  });
});

describe("What If — people", () => {
  it("pauses an absent person's overlapping work", () => {
    const r = simulate(base(), [{ kind: "unavailable", userId: "u3", from: "2026-10-26", days: 3 }]);
    const shift = Object.fromEntries(r.moves.map((m) => [m.taskId, m.shiftDays]));
    expect(shift.fe).toBe(2); // overlaps 26–27 Oct
    expect(shift.docs).toBe(3); // overlaps 26–28 Oct
    expect(r.assumptions.join(" ")).toMatch(/pause/);
  });

  it("shows workload changes and handover cost for a reassignment", () => {
    const r = simulate(base(), [{ kind: "reassign", taskId: "fe", toUserId: "u2", handoverDays: 1 }]);
    expect(r.workload.map((w) => [w.userId, w.before, w.after])).toEqual([
      ["u2", 30, 50],
      ["u3", 26, 6],
    ]);
    expect(r.moves.find((m) => m.taskId === "fe")!.shiftDays).toBe(1);
    expect(r.updates.find((u) => u.taskId === "fe")!.assigneeId).toBe("u2");
  });

  it("states when handover is assumed to be free", () => {
    const r = simulate(base(), [{ kind: "reassign", taskId: "fe", toUserId: "u2", handoverDays: 0 }]);
    expect(r.assumptions.join(" ")).toMatch(/no time/);
  });
});

describe("What If — deadline and health", () => {
  it("compares health before and after using Pulse", () => {
    const r = simulate(base(), [{ kind: "deadline", date: "2026-11-01" }]);
    expect(r.projectDeadlineUpdate).toEqual({ from: "2026-11-10", to: "2026-11-01" });
    expect(r.scenarioDaysVsDeadline).toBe(5);
    expect(r.health.after!).toBeLessThan(r.health.before!);
    expect(r.health.newRisks.some((t) => /after the project deadline/.test(t))).toBe(true);
  });

  it("rejects changes to completed tasks and tasks without dates", () => {
    const i = base();
    i.tasks.push(task({ id: "nodate", title: "Loose end" }));
    expect(validateChanges(i, [{ kind: "delay", taskId: "db", days: 2 }])[0]).toMatch(/already complete/);
    expect(validateChanges(i, [{ kind: "delay", taskId: "nodate", days: 2 }])[0]).toMatch(/no due date/);
    expect(simulate(i, [{ kind: "delay", taskId: "db", days: 2 }]).valid).toBe(false);
  });
});

describe("What If — helpers", () => {
  it("fingerprints change when the project changes", () => {
    const a = fingerprint({ deadline: "2026-11-10" }, tasks(), deps);
    const moved = tasks().map((t) => (t.id === "fe" ? { ...t, dueDate: "2026-10-28" } : t));
    expect(fingerprint({ deadline: "2026-11-10" }, tasks(), deps)).toBe(a);
    expect(fingerprint({ deadline: "2026-11-10" }, moved, deps)).not.toBe(a);
    expect(fingerprint({ deadline: "2026-11-11" }, tasks(), deps)).not.toBe(a);
  });

  it("describes changes in plain English", () => {
    const t = () => "API";
    const n = (id: string | null) => (id === "u2" ? "Ben" : "Unassigned");
    expect(describeChange({ kind: "delay", taskId: "api", days: 3 }, t, n)).toBe("“API” finishes 3 days late");
    expect(describeChange({ kind: "duration", taskId: "api", factor: 2 }, t, n)).toBe("“API” takes twice as long");
    expect(describeChange({ kind: "unavailable", userId: "u2", from: "2026-10-20", days: 1 }, t, n)).toBe("Ben is away for 1 day from 2026-10-20");
  });
});
