"use client";

import Link from "next/link";
import { useState } from "react";
import { updateTask } from "@/lib/actions/tasks";
import { daysBetween, formatDate, lateLabel, relativeDay } from "@/lib/domain/dates";
import { STATUS_LABEL, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/domain/types";
import { canWrite, nameOf, useAppData } from "@/components/shell/app-context";
import { PriorityIcon, StatusIcon } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";

export interface TaskRowData {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  dueDate: string | null;
  note?: string | null; // e.g. "Waiting on 2 tasks"
}

/** One task in a list: quick status change, opens the detail drawer on click. */
export function TaskRow({ task, showProject = true, showAssignee = true }: { task: TaskRowData; showProject?: boolean; showAssignee?: boolean }) {
  const data = useAppData();
  const toast = useToast();
  const [status, setStatus] = useState(task.status);
  const [pending, setPending] = useState(false);
  const done = status === "done";
  const overdue = !done && task.dueDate && task.dueDate < data.today;

  async function change(next: TaskStatus) {
    const prev = status;
    setStatus(next);
    setPending(true);
    const r = await updateTask(task.id, { status: next }).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Status not changed." }));
    setPending(false);
    if (!r.ok) {
      setStatus(prev);
      toast.error(r.error);
    } else toast.success(next === "done" ? "Task completed." : `Moved to ${STATUS_LABEL[next]}.`);
  }

  return (
    <li className={cn("group flex items-center gap-3 px-4 py-2 hover:bg-hover/50", pending && "opacity-60")}>
      {canWrite(data.role) ? (
        <label className="relative flex shrink-0 cursor-pointer items-center" title={`Status: ${STATUS_LABEL[status]}`}>
          <StatusIcon status={status} />
          <select
            aria-label={`Status of ${task.title}`}
            value={status}
            onChange={(e) => change(e.target.value as TaskStatus)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <StatusIcon status={status} />
      )}
      <PriorityIcon priority={task.priority} />
      <Link href={`/projects/${task.projectId}?task=${task.id}`} scroll={false} className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13px]", done ? "text-muted line-through" : "text-fg")}>{task.title}</span>
        {(showProject && task.projectName) || task.note ? (
          <span className="block truncate text-[12px] text-faint">
            {[showProject ? task.projectName : null, task.note].filter(Boolean).join(", ")}
          </span>
        ) : null}
      </Link>
      {task.dueDate && (
        <span className={cn("shrink-0 text-[12px] whitespace-nowrap", overdue ? "text-danger" : "text-faint")} title={formatDate(task.dueDate)}>
          {overdue ? lateLabel(daysBetween(task.dueDate, data.today)) : Math.abs(daysBetween(data.today, task.dueDate)) < 7 ? relativeDay(task.dueDate, data.today) : formatDate(task.dueDate, data.today)}
        </span>
      )}
      {showAssignee && <span className="hidden sm:block">{task.assigneeId ? <Avatar name={nameOf(data, task.assigneeId)} size={22} /> : <span className="block size-[22px] rounded-full border border-dashed border-line-strong" title="Unassigned" />}</span>}
    </li>
  );
}
