import { describe, expect, it } from "vitest";
import { buildMemory, categorise, planningSuggestions, retrospective, type MemoryProject } from "@/lib/memory/engine";
import { dep, task } from "./fixtures";

const done = (id: string, title: string, o: { est?: number; act?: number; due?: string; on?: string } = {}) =>
  task({
    id,
    title,
    status: "done",
    estimateHours: o.est ?? null,
    actualHours: o.act ?? null,
    dueDate: o.due ?? null,
    completedAt: `${o.on ?? "2026-09-10"}T12:00:00Z`,
  });

const proj = (id: string, tasks: MemoryProject["tasks"], extra: Partial<MemoryProject> = {}): MemoryProject => ({
  id,
  name: id,
  deadline: "2026-09-30",
  status: "completed",
  completedAt: "2026-09-28T12:00:00Z",
  tasks,
  dependencies: [],
  ...extra,
});

describe("Memory — categories", () => {
  it("recognises kinds of work from task titles", () => {
    expect(categorise("Testing and QA")).toBe("testing");
    expect(categorise("Integrate frontend with API")).toBe("integration");
    expect(categorise("Write first draft")).toBe("writing");
    expect(categorise("Design database schema")).toBe("design");
    expect(categorise("Submit")).toBe("delivery");
    expect(categorise("Buy snacks")).toBe("other");
    expect(categorise("Build UI")).toBe("design"); // "ui" matched as a whole word
  });
});

describe("Memory — insights need enough evidence", () => {
  it("doesn't draw a lesson from too few tasks or a single project", () => {
    const one = proj("p1", [1, 2, 3, 4, 5, 6].map((i) => done(`t${i}`, "Testing", { est: 4, act: 8 })));
    expect(buildMemory([one], "Europe/London").insights).toEqual([]);
    const few = [proj("p1", [done("a", "Testing", { est: 4, act: 8 })]), proj("p2", [done("b", "Testing", { est: 4, act: 8 })])];
    expect(buildMemory(few, "Europe/London").insights).toEqual([]);
  });

  it("finds a consistent estimate overrun across projects, with its evidence", () => {
    const projects = [
      proj("p1", [done("a", "Testing", { est: 4, act: 6 }), done("b", "QA pass", { est: 2, act: 3 }), done("c", "Fix bug list", { est: 4, act: 6 })]),
      proj("p2", [done("d", "Testing", { est: 6, act: 9 }), done("e", "Test plan", { est: 2, act: 3 }), done("x", "Write report", { est: 4, act: 4 })]),
    ];
    const m = buildMemory(projects, "Europe/London");
    const i = m.insights.find((x) => x.key === "estimate:testing")!;
    expect(i.title).toBe("Testing usually takes about 50% longer than estimated");
    expect(i.observations).toBe(5);
    expect(i.projectIds.sort()).toEqual(["p1", "p2"]);
    expect(i.multiplier).toBe(1.5);
    expect(m.insights.some((x) => x.category === "writing")).toBe(false);
  });

  it("finds work that is often late, and late work that blocked others", () => {
    const late = (id: string, on: string) => done(id, "Integrate payments", { due: "2026-09-10", on });
    const p1 = proj("p1", [late("a", "2026-09-14"), late("b", "2026-09-12"), late("c", "2026-09-10"), task({ id: "n1", title: "Next" })], {
      dependencies: [dep("a", "n1"), dep("b", "n1")],
    });
    const p2 = proj("p2", [late("d", "2026-09-13"), late("e", "2026-09-11"), task({ id: "n2", title: "Next" })], { dependencies: [dep("d", "n2")] });
    const m = buildMemory([p1, p2], "Europe/London");
    const lateness = m.insights.find((x) => x.key === "lateness:integration")!;
    expect(lateness.detail).toBe("4 of 5 integration tasks with a due date were finished late, by 2.5 days on average.");
    expect(m.insights.find((x) => x.key === "blocking")!.observations).toBe(3);
  });

  it("notices projects that usually miss their deadline", () => {
    const p = (id: string, completed: string) => proj(id, [done(`${id}t`, "Thing")], { completedAt: `${completed}T12:00:00Z` });
    const m = buildMemory([p("a", "2026-10-02"), p("b", "2026-10-05"), p("c", "2026-09-20")], "Europe/London");
    expect(m.insights.find((x) => x.kind === "deadlines")!.detail).toBe("2 of 3 completed projects finished late.");
  });
});

describe("Memory — retrospectives and planning", () => {
  it("summarises a finished project from its data", () => {
    const p = proj(
      "p1",
      [
        done("a", "Design", { due: "2026-09-10", on: "2026-09-10", est: 4, act: 4 }),
        done("b", "Integration", { due: "2026-09-12", on: "2026-09-16", est: 4, act: 9 }),
        task({ id: "c", title: "Later" }),
      ],
      { dependencies: [dep("b", "c")], status: "active", completedAt: null },
    );
    const r = retrospective(p, "Europe/London");
    expect(r).toMatchObject({ tasksDone: 2, tasksTotal: 3, onTimeShare: 0.5, finishedOn: null });
    expect(r.lateTasks).toEqual([{ id: "b", title: "Integration", daysLate: 4, blocked: 1 }]);
    expect(r.overruns).toEqual([{ id: "b", title: "Integration", estimate: 4, actual: 9 }]);
  });

  it("suggests bigger estimates only for matching new tasks", () => {
    const projects = [
      proj("p1", [1, 2, 3].map((i) => done(`a${i}`, "Testing", { est: 4, act: 8 }))),
      proj("p2", [1, 2].map((i) => done(`b${i}`, "QA", { est: 4, act: 8 }))),
    ];
    const s = planningSuggestions(buildMemory(projects, "Europe/London"), ["Testing and QA", "Write documentation"]);
    expect(s).toEqual([expect.objectContaining({ category: "testing", multiplier: 2, affected: ["Testing and QA"] })]);
  });
});
