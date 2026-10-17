"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { addDays } from "@/lib/domain/dates";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES, PRIORITY_RANK } from "@/lib/domain/types";
import { canWrite, useAppData } from "@/components/shell/app-context";
import { TaskRow, type TaskRowData } from "@/components/tasks/task-row";
import { QuickCreateTask } from "@/components/tasks/quick-create";
import { Button, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

export interface MyTaskItem extends TaskRowData {
  creatorId: string | null;
  completedAt: string | null;
  attention: number;
}

const VIEWS = [
  { id: "attention", label: "Needs attention" },
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue", label: "Overdue" },
  { id: "completed", label: "Completed" },
  { id: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["id"];
type Scope = "assigned" | "created" | "all";

export function MyTasksView({ items, projects, initialView, initialScope }: { items: MyTaskItem[]; projects: { id: string; name: string }[]; initialView?: string; initialScope?: string }) {
  const data = useAppData();
  const today = data.today;
  const [view, setView] = useState<View>(VIEWS.some((v) => v.id === initialView) ? (initialView as View) : "attention");
  const [scope, setScope] = useState<Scope>(initialScope === "created" || initialScope === "all" ? initialScope : "assigned");
  const [project, setProject] = useState("");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

  const scoped = useMemo(
    () =>
      items.filter((t) =>
        scope === "assigned" ? t.assigneeId === data.userId : scope === "created" ? t.creatorId === data.userId && t.assigneeId !== data.userId : true,
      ),
    [items, scope, data.userId],
  );

  const filtered = useMemo(() => {
    return scoped
      .filter((t) => !project || t.projectId === project)
      .filter((t) => !priority || t.priority === priority)
      .filter((t) => !status || t.status === status)
      .filter((t) => {
        const open = t.status !== "done";
        switch (view) {
          case "attention":
            return open && t.attention >= 25;
          case "today":
            return open && t.dueDate !== null && t.dueDate <= today;
          case "upcoming":
            return open && t.dueDate !== null && t.dueDate > today && t.dueDate <= addDays(today, 14);
          case "overdue":
            return open && t.dueDate !== null && t.dueDate < today;
          case "completed":
            return !open;
          default:
            return true;
        }
      });
  }, [scoped, project, priority, status, view, today]);

  const groups = useMemo(() => {
    if (view === "completed") {
      const items = [...filtered].sort((a, b) => ((b.completedAt ?? "") > (a.completedAt ?? "") ? 1 : -1)).slice(0, 100);
      return items.length ? [{ label: "Completed", items }] : [];
    }
    if (view === "attention") {
      return filtered.length ? [{ label: "", items: [...filtered].sort((a, b) => b.attention - a.attention) }] : [];
    }
    const tomorrow = addDays(today, 1);
    const week = addDays(today, 7);
    const buckets: [string, (t: MyTaskItem) => boolean][] = [
      ["Overdue", (t) => !!t.dueDate && t.dueDate < today && t.status !== "done"],
      ["Today", (t) => t.dueDate === today],
      ["Tomorrow", (t) => t.dueDate === tomorrow],
      ["Next 7 days", (t) => !!t.dueDate && t.dueDate > tomorrow && t.dueDate <= week],
      ["Later", (t) => !!t.dueDate && t.dueDate > week],
      ["No due date", (t) => !t.dueDate],
      ["Completed", () => true],
    ];
    const byDue = (a: MyTaskItem, b: MyTaskItem) =>
      (a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : a.dueDate === b.dueDate ? PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] : 1;
    const open = filtered.filter((t) => t.status !== "done");
    const used = new Set<string>();
    return [
      ...buckets.slice(0, -1).map(([label, test]) => {
        const g = open.filter((t) => !used.has(t.id) && test(t)).sort(byDue);
        g.forEach((t) => used.add(t.id));
        return { label, items: g };
      }),
      { label: "Completed", items: filtered.filter((t) => t.status === "done") },
    ]
      .filter((g) => g.items.length);
  }, [filtered, view, today]);

  const counts = useMemo(() => {
    const open = scoped.filter((t) => t.status !== "done");
    return {
      attention: open.filter((t) => t.attention >= 25).length,
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
    };
  }, [scoped, today]);

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 md:px-10">
      <PageHeader
        title="My Tasks"
        description={scope === "assigned" ? "Everything assigned to you, across projects." : scope === "created" ? "Tasks you created for other people." : "Every task in the workspace."}
        icon={<CheckSquare className="size-6" />}
        color="var(--c-tasks)"
        action={
          canWrite(data.role) && (
            <Button variant="primary" onClick={() => setCreating(true)} disabled={!projects.length}>
              <Plus className="size-4" /> Add task
            </Button>
          )
        }
      />

      <div className="mt-8 flex flex-wrap items-center gap-2" role="tablist" aria-label="Task views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            onClick={() => setView(v.id)}
            className={cn("inline-flex h-10 items-center rounded-xl px-4 text-[14px] font-semibold", view === v.id ? "bg-violet text-white" : "border border-line bg-panel text-muted hover:text-fg")}
          >
            {v.label}
            {v.id === "attention" && counts.attention > 0 && <span className="num ml-2 rounded-full bg-warning px-1.5 text-[11px] text-white">{counts.attention}</span>}
            {v.id === "overdue" && counts.overdue > 0 && <span className="num ml-2 rounded-full bg-danger px-1.5 text-[11px] text-white">{counts.overdue}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <select aria-label="Whose tasks" className="field w-auto py-1.5 text-[14px]" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
          <option value="assigned">Assigned to me</option>
          <option value="created">Created by me for others</option>
          <option value="all">Everyone&apos;s tasks</option>
        </select>
        <select aria-label="Project" className="field w-auto py-1.5 text-[14px]" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="Priority" className="field w-auto py-1.5 text-[14px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select aria-label="Status" className="field w-auto py-1.5 text-[14px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {(project || priority || status) && (
          <button
            onClick={() => {
              setProject("");
              setPriority("");
              setStatus("");
            }}
            className="text-muted hover:text-fg"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
        {groups.length === 0 ? (
          <EmptyState className="px-5" title={view === "attention" ? "Nothing needs your attention" : view === "overdue" ? "Nothing overdue" : "No tasks here"}>
            {view === "attention"
              ? "Overdue work, tasks due in the next few days and tasks blocking others appear here."
              : project || priority || status
                ? "Try clearing the filters."
                : "Tasks will appear here as they're assigned."}
          </EmptyState>
        ) : (
          groups.map((g) => (
            <section key={g.label || "list"}>
              {g.label && (
                <h2 className={cn("border-b border-line bg-raised px-5 py-2.5 text-[14px] font-semibold", g.label === "Overdue" ? "text-danger" : "text-fg")}>
                  {g.label} <span className="num font-normal text-faint">{g.items.length}</span>
                </h2>
              )}
              <ul className="divide-y divide-line">
                {g.items.map((t) => (
                  <TaskRow key={t.id} task={t} showAssignee={scope !== "assigned"} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <QuickCreateTask open={creating} onClose={() => setCreating(false)} defaultProjectId={project || undefined} />
    </div>
  );
}
