"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { daysBetween, formatDate, lateLabel } from "@/lib/domain/dates";
import { PRIORITIES, PRIORITY_LABEL, PRIORITY_RANK, STATUS_LABEL, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/domain/types";
import { nameOf, useAppData } from "@/components/shell/app-context";
import { PriorityIcon, StatusBadge } from "@/components/ui/badges";
import { AddTaskButton } from "@/components/tasks/add-task-button";
import { cn } from "@/components/ui/cn";

export interface TableTask {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  completedAt: string | null;
  waitsOn: string[];
  blocks: number;
}

type Key = "title" | "status" | "priority" | "assignee" | "due" | "estimate";
const STATUS_ORDER = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, i]));

export function TaskTable({ projectId, rows }: { projectId: string; rows: TableTask[] }) {
  const data = useAppData();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "due", dir: 1 });

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cmp: Record<Key, (a: TableTask, b: TableTask) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
      priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      assignee: (a, b) => nameOf(data, a.assigneeId).localeCompare(nameOf(data, b.assigneeId)),
      due: (a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
      estimate: (a, b) => (a.estimateHours ?? -1) - (b.estimateHours ?? -1),
    };
    return rows
      .filter((r) => !term || r.title.toLowerCase().includes(term))
      .filter((r) => !status || (status === "open" ? r.status !== "done" : r.status === status))
      .filter((r) => !priority || r.priority === priority)
      .filter((r) => !assignee || (assignee === "none" ? !r.assigneeId : r.assigneeId === assignee))
      .sort((a, b) => cmp[sort.key](a, b) * sort.dir || a.title.localeCompare(b.title));
  }, [rows, q, status, priority, assignee, sort, data]);

  const head = (key: Key, label: string, className?: string) => (
    <th scope="col" className={cn("px-3 py-2 font-medium", className)} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} className="inline-flex items-center gap-1 hover:text-fg">
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input aria-label="Search tasks" className="field w-56 py-1 pl-8 text-[12px]" placeholder="Search tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label="Status" className="field w-auto py-1 text-[12px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="open">Not done</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select aria-label="Priority" className="field w-auto py-1 text-[12px]" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select aria-label="Assignee" className="field w-auto py-1 text-[12px]" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {data.members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
        </select>
        <span className="text-faint">
          {visible.length} of {rows.length}
        </span>
        <span className="ml-auto">
          <AddTaskButton projectId={projectId} />
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-panel">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="border-b border-line text-left text-[12px] text-muted">
            <tr>
              {head("title", "Task", "w-[38%]")}
              {head("status", "Status")}
              {head("priority", "Priority")}
              {head("assignee", "Assignee")}
              {head("due", "Due")}
              <th scope="col" className="px-3 py-2 font-medium">
                Dependencies
              </th>
              {head("estimate", "Estimate", "text-right")}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => {
              const late = r.status !== "done" && r.dueDate && r.dueDate < data.today ? daysBetween(r.dueDate, data.today) : 0;
              return (
                <tr key={r.id} className="hover:bg-hover/40">
                  <td className="px-3 py-2">
                    <Link href={`?task=${r.id}`} scroll={false} className={cn("hover:underline", r.status === "done" && "text-muted line-through")}>
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    <PriorityIcon priority={r.priority} withLabel />
                  </td>
                  <td className="px-3 py-2 text-muted">{nameOf(data, r.assigneeId)}</td>
                  <td className={cn("px-3 py-2 whitespace-nowrap", late ? "text-danger" : "text-muted")}>
                    {r.dueDate ? formatDate(r.dueDate, data.today) : "—"}
                    {late > 0 && <span className="ml-1.5 text-[11px]">{lateLabel(late)}</span>}
                    {r.status === "done" && r.completedAt && <span className="ml-1.5 text-[11px] text-success">Done</span>}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-muted">
                    {r.waitsOn.length > 0 && <span className="text-warning">Waits on {r.waitsOn.length}</span>}
                    {r.waitsOn.length > 0 && r.blocks > 0 && ", "}
                    {r.blocks > 0 && <span>Blocks {r.blocks}</span>}
                    {!r.waitsOn.length && !r.blocks && <span className="text-faint">—</span>}
                  </td>
                  <td className="num px-3 py-2 text-right text-muted">{r.estimateHours != null ? `${r.estimateHours} h` : "—"}</td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted">
                  {rows.length ? "No tasks match these filters." : "No tasks yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
