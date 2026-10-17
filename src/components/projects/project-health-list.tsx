"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDate, daysBetween } from "@/lib/domain/dates";
import type { HealthStatus } from "@/lib/pulse/types";
import { HealthBadge } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/primitives";
import { nameOf, useAppData } from "@/components/shell/app-context";
import { cn } from "@/components/ui/cn";

export interface ProjectHealthRow {
  id: string;
  name: string;
  ownerId: string | null;
  progress: number;
  progressMethod: "effort" | "count";
  score: number | null;
  status: HealthStatus;
  deadline: string | null;
  openTasks: number;
  topIssue: string | null;
  strip: { weight: number; score: number | null }[];
  archived?: boolean;
  completed?: boolean;
}

type Sort = "health" | "deadline" | "progress" | "name";
const HEALTH_ORDER: Record<HealthStatus, number> = { critical: 0, at_risk: 1, attention: 2, insufficient_data: 3, healthy: 4 };

/** Sortable, filterable list of projects with their health — used on Overview and Projects. */
export function ProjectHealthList({ rows, initialFilter = "all", showFilters = true }: { rows: ProjectHealthRow[]; initialFilter?: "all" | "risk" | "mine"; showFilters?: boolean }) {
  const data = useAppData();
  const [sort, setSort] = useState<Sort>("health");
  const [filter, setFilter] = useState(initialFilter);

  const visible = useMemo(() => {
    let r = rows;
    if (filter === "risk") r = r.filter((x) => x.status === "at_risk" || x.status === "critical");
    if (filter === "mine") r = r.filter((x) => x.ownerId === data.userId);
    return [...r].sort((a, b) => {
      if (sort === "health") return HEALTH_ORDER[a.status] - HEALTH_ORDER[b.status] || (a.score ?? 101) - (b.score ?? 101);
      if (sort === "deadline") return (a.deadline ?? "9999") < (b.deadline ?? "9999") ? -1 : 1;
      if (sort === "progress") return a.progress - b.progress;
      return a.name.localeCompare(b.name);
    });
  }, [rows, sort, filter, data.userId]);

  return (
    <div>
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-[12px]">
          <div role="group" aria-label="Filter projects" className="flex gap-1">
            {(
              [
                ["all", "All"],
                ["risk", "At risk"],
                ["mine", "I own"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                aria-pressed={filter === k}
                onClick={() => setFilter(k)}
                className={cn("rounded px-2 py-1", filter === k ? "bg-hover text-fg" : "text-muted hover:text-fg")}
              >
                {l}
              </button>
            ))}
          </div>
          <label className="ml-auto flex items-center gap-2 text-muted">
            Sort by
            <select className="field w-auto py-0.5 text-[12px]" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="health">Health</option>
              <option value="deadline">Deadline</option>
              <option value="progress">Progress</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted">{filter === "risk" ? "No projects are at risk right now." : filter === "mine" ? "You don't own any of these projects." : "No projects."}</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((p) => {
            const total = p.strip.reduce((s, x) => s + x.weight, 0) || 1;
            const daysLeft = p.deadline ? daysBetween(data.today, p.deadline) : null;
            return (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 px-4 py-3 hover:bg-hover/40 md:grid-cols-[minmax(0,1.6fr)_120px_140px_110px]">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {p.ownerId && <Avatar name={nameOf(data, p.ownerId)} size={20} />}
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">
                        {p.name}
                        {p.archived && <span className="ml-2 text-[11px] font-normal text-faint">Archived</span>}
                        {p.completed && <span className="ml-2 text-[11px] font-normal text-success">Completed</span>}
                      </span>
                      <span className="block truncate text-[12px] text-muted">{p.topIssue ?? `${p.openTasks} open ${p.openTasks === 1 ? "task" : "tasks"}`}</span>
                    </span>
                  </span>
                  <span className="flex flex-col items-end justify-center gap-1 md:items-start">
                    <HealthBadge status={p.status} score={p.score} />
                    <span className="flex h-1 w-full max-w-[96px] gap-[1px] overflow-hidden rounded-full bg-hover" aria-hidden>
                      {p.strip.map((s, i) => (
                        <span
                          key={i}
                          style={{
                            flexGrow: s.weight / total,
                            background: s.score === null ? "transparent" : s.score >= 80 ? "var(--success)" : s.score >= 60 ? "var(--warning)" : s.score >= 40 ? "#ec8a3c" : "var(--danger)",
                          }}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="hidden flex-col justify-center gap-1 md:flex">
                    <span className="num text-[12px] text-muted">
                      {p.progress}%{p.progressMethod === "count" && <span className="ml-1 font-sans text-[11px] text-faint">by count</span>}
                    </span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-hover">
                      <span className="block h-full rounded-full bg-violet" style={{ width: `${p.progress}%` }} />
                    </span>
                  </span>
                  <span className={cn("hidden self-center text-right text-[12px] md:block", daysLeft !== null && daysLeft < 0 && !p.completed ? "text-danger" : "text-muted")}>
                    {p.deadline ? formatDate(p.deadline, data.today) : "No deadline"}
                    {daysLeft !== null && !p.completed && <span className="block text-[11px] text-faint">{daysLeft < 0 ? `${-daysLeft} days ago` : daysLeft === 0 ? "today" : `${daysLeft} days left`}</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
