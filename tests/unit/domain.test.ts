import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatDate,
  fractionOfInterval,
  isValidDateOnly,
  relativeDay,
  todayInTimeZone,
} from "@/lib/domain/dates";
import { checkNewDependency, downstreamOf, topologicalOrder, upstreamOf } from "@/lib/domain/graph";
import { can, canChangeRole, canDeleteProject, canRemoveMember } from "@/lib/domain/permissions";
import { computeProgress } from "@/lib/domain/progress";
import { TEMPLATES, materialiseTemplate } from "@/lib/domain/templates";
import { task } from "./fixtures";

describe("dates", () => {
  it("validates calendar dates strictly", () => {
    expect(isValidDateOnly("2026-02-28")).toBe(true);
    expect(isValidDateOnly("2026-02-29")).toBe(false);
    expect(isValidDateOnly("2028-02-29")).toBe(true);
    expect(isValidDateOnly("2026-13-01")).toBe(false);
    expect(isValidDateOnly("2026-1-01")).toBe(false);
    expect(isValidDateOnly(null)).toBe(false);
  });

  it("counts whole days without timezone drift, across DST changes", () => {
    expect(daysBetween("2026-10-17", "2026-10-31")).toBe(14);
    // UK clocks go back on 25 Oct 2026; still exactly one calendar day.
    expect(daysBetween("2026-10-24", "2026-10-25")).toBe(1);
    expect(daysBetween("2026-10-25", "2026-10-26")).toBe(1);
    expect(daysBetween("2026-10-20", "2026-10-17")).toBe(-3);
  });

  it("adds days across month and leap-year boundaries", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("resolves 'today' in the workspace timezone, not UTC", () => {
    const lateEvening = new Date("2026-10-17T23:30:00Z"); // 00:30 BST on the 18th in London
    expect(todayInTimeZone("Europe/London", lateEvening)).toBe("2026-10-18");
    expect(todayInTimeZone("America/New_York", lateEvening)).toBe("2026-10-17");
    expect(todayInTimeZone("Not/AZone", lateEvening)).toBe("2026-10-17");
  });

  it("formats dates without shifting them", () => {
    expect(formatDate("2026-11-02", "2026-10-17")).toBe("2 Nov");
    expect(formatDate("2027-01-05", "2026-10-17")).toBe("5 Jan 2027");
    expect(formatDate(null)).toBe("—");
    expect(relativeDay("2026-10-18", "2026-10-17")).toBe("tomorrow");
    expect(relativeDay("2026-10-14", "2026-10-17")).toBe("3 days ago");
  });

  it("computes the position of a date in an interval", () => {
    expect(fractionOfInterval("2026-10-11", "2026-10-01", "2026-10-21")).toBeCloseTo(0.5);
    expect(fractionOfInterval("2026-09-01", "2026-10-01", "2026-10-21")).toBe(0);
    expect(fractionOfInterval("2026-12-01", "2026-10-01", "2026-10-21")).toBe(1);
  });
});

describe("dependency graph", () => {
  // db → api → integ → test ; ui → integ
  const deps = [
    { predecessorId: "db", successorId: "api" },
    { predecessorId: "api", successorId: "integ" },
    { predecessorId: "ui", successorId: "integ" },
    { predecessorId: "integ", successorId: "test" },
  ];

  it("finds transitive downstream and upstream tasks", () => {
    expect([...downstreamOf("db", deps)].sort()).toEqual(["api", "integ", "test"]);
    expect([...upstreamOf("test", deps)].sort()).toEqual(["api", "db", "integ", "ui"]);
    expect(downstreamOf("test", deps).size).toBe(0);
  });

  it("rejects self, duplicate and circular dependencies with an explanation", () => {
    expect(checkNewDependency("db", "db", deps)).toMatchObject({ ok: false, reason: "self" });
    expect(checkNewDependency("db", "api", deps)).toMatchObject({ ok: false, reason: "duplicate" });
    const cycle = checkNewDependency("test", "db", deps); // db would depend on test
    expect(cycle).toMatchObject({ ok: false, reason: "cycle" });
    if (!cycle.ok) expect(cycle.path).toEqual(["db", "api", "integ", "test"]);
  });

  it("accepts valid new edges", () => {
    expect(checkNewDependency("db", "test", deps)).toEqual({ ok: true });
    expect(checkNewDependency("ui", "api", deps)).toEqual({ ok: true });
  });

  it("orders tasks topologically and detects cycles", () => {
    const order = topologicalOrder(["test", "integ", "api", "db", "ui"], deps)!;
    expect(order.indexOf("db")).toBeLessThan(order.indexOf("api"));
    expect(order.indexOf("integ")).toBeLessThan(order.indexOf("test"));
    expect(topologicalOrder(["a", "b"], [
      { predecessorId: "a", successorId: "b" },
      { predecessorId: "b", successorId: "a" },
    ])).toBeNull();
  });
});

describe("permissions", () => {
  it("gives viewers read-only access", () => {
    expect(can("viewer", "workspace.read")).toBe(true);
    expect(can("viewer", "task.write")).toBe(false);
    expect(can("viewer", "comment.write")).toBe(false);
    expect(can(null, "workspace.read")).toBe(false);
  });

  it("lets members work but not manage the workspace", () => {
    expect(can("member", "task.write")).toBe(true);
    expect(can("member", "project.create")).toBe(true);
    expect(can("member", "members.manage")).toBe(false);
    expect(can("member", "workspace.manage")).toBe(false);
  });

  it("restricts project deletion to admins or the project owner", () => {
    expect(canDeleteProject("member", "u1", "u1")).toBe(true);
    expect(canDeleteProject("member", "u1", "u2")).toBe(false);
    expect(canDeleteProject("admin", "u1", "u2")).toBe(true);
    expect(canDeleteProject("viewer", "u1", "u1")).toBe(false);
  });

  it("protects the owner and reserves admin changes for the owner", () => {
    expect(canChangeRole("admin", "member", "viewer")).toBe(true);
    expect(canChangeRole("admin", "member", "admin")).toBe(false);
    expect(canChangeRole("owner", "member", "admin")).toBe(true);
    expect(canChangeRole("owner", "owner", "member")).toBe(false);
    expect(canRemoveMember("admin", "owner")).toBe(false);
    expect(canRemoveMember("admin", "admin")).toBe(false);
    expect(canRemoveMember("owner", "admin")).toBe(true);
    expect(canRemoveMember("member", "viewer")).toBe(false);
  });
});

describe("progress", () => {
  it("weights by effort when most tasks have estimates", () => {
    const tasks = [
      task({ id: "a", status: "done", estimateHours: 2 }),
      task({ id: "b", status: "done", estimateHours: 2 }),
      task({ id: "c", status: "todo", estimateHours: 16 }),
    ];
    const p = computeProgress(tasks);
    expect(p.method).toBe("effort");
    expect(p.percent).toBe(20); // 4 of 20 hours, not 2 of 3 tasks
  });

  it("falls back to task counts and says so when estimates are sparse", () => {
    const tasks = [task({ id: "a", status: "done", estimateHours: 2 }), task({ id: "b" }), task({ id: "c" })];
    const p = computeProgress(tasks);
    expect(p.method).toBe("count");
    expect(p.percent).toBe(33);
  });

  it("handles empty projects", () => {
    expect(computeProgress([]).percent).toBe(0);
  });
});

describe("templates", () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))("%s has valid, acyclic dependencies and fits the dates", (_, tpl) => {
    const keys = tpl.tasks.map((t) => t.key);
    const deps = tpl.tasks.flatMap((t) => (t.dependsOn ?? []).map((p) => ({ predecessorId: p, successorId: t.key })));
    for (const d of deps) expect(keys).toContain(d.predecessorId);
    expect(topologicalOrder(keys, deps)).not.toBeNull();
    const { tasks, milestones } = materialiseTemplate(tpl, "2026-10-19", "2026-11-16");
    for (const t of tasks) {
      expect(t.startDate! >= "2026-10-19" && t.dueDate! <= "2026-11-16").toBe(true);
      expect(t.startDate! <= t.dueDate!).toBe(true);
    }
    for (const m of milestones) expect(m.targetDate! <= "2026-11-16").toBe(true);
    // No successor is due before its predecessor.
    const due = new Map(tasks.map((t) => [t.key, t.dueDate!]));
    for (const d of deps) expect(due.get(d.predecessorId)! <= due.get(d.successorId)!).toBe(true);
  });

  it("leaves dates empty when there is no deadline", () => {
    const { tasks } = materialiseTemplate(TEMPLATES[0], "2026-10-19", null);
    expect(tasks.every((t) => t.dueDate === null)).toBe(true);
  });
});
