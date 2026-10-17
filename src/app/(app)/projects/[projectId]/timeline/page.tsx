import type { Metadata } from "next";
import Link from "next/link";
import { getAppContext, memberName } from "@/lib/data/context";
import { loadProjectBundle } from "@/lib/data/queries";
import { addDays, daysBetween, formatDate, maxDate, minDate } from "@/lib/domain/dates";
import { topologicalOrder } from "@/lib/domain/graph";
import { STATUS_LABEL } from "@/lib/domain/types";
import type { Task } from "@/lib/data/types";
import { AddTaskButton } from "@/components/tasks/add-task-button";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Timeline" };

const ROW = 34;
const HEAD = 40;

/**
 * Planned dates drawn against the calendar, with dependency links and the project
 * deadline. This shows the plan as entered; it does not auto-schedule tasks.
 */
export default async function TimelinePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  const b = await loadProjectBundle(ctx, projectId);
  const today = ctx.today;

  const scheduled = b.tasks.filter((t) => t.dueDate);
  const unscheduled = b.tasks.filter((t) => !t.dueDate);
  if (!scheduled.length && !b.milestones.some((m) => m.targetDate)) {
    return (
      <div className="max-w-xl">
        <h2 className="text-[17px] font-semibold">Nothing to place on the timeline yet</h2>
        <p className="mt-2 text-muted">Tasks appear here once they have a due date. Add a start date too and they show as bars with their dependencies drawn between them.</p>
        <div className="mt-5">
          <AddTaskButton projectId={projectId} />
        </div>
      </div>
    );
  }

  // Order: dependency order first, then by start/due date.
  const topo = topologicalOrder(scheduled.map((t) => t.id), b.dependencies) ?? scheduled.map((t) => t.id);
  const rank = new Map(topo.map((id, i) => [id, i]));
  const rows = [...scheduled].sort((x, y) => {
    const ax = x.startDate ?? x.dueDate!;
    const ay = y.startDate ?? y.dueDate!;
    return ax === ay ? rank.get(x.id)! - rank.get(y.id)! : ax < ay ? -1 : 1;
  });

  const from = addDays(
    minDate(b.project.startDate, today, ...rows.map((t) => t.startDate ?? t.dueDate), ...b.milestones.map((m) => m.targetDate))!,
    -2,
  );
  const to = addDays(maxDate(b.project.deadline, today, ...rows.map((t) => t.dueDate), ...b.milestones.map((m) => m.targetDate))!, 3);
  const span = daysBetween(from, to) + 1;
  const dayW = span <= 45 ? 28 : span <= 120 ? 14 : 7;
  const width = span * dayW;
  const x = (d: string) => daysBetween(from, d) * dayW;
  const rowIndex = new Map(rows.map((t, i) => [t.id, i]));
  const msRowY = rows.length * ROW;
  const height = rows.length * ROW + (b.milestones.length ? ROW : 0);

  const ticks: string[] = [];
  for (let i = 0; i < span; i++) {
    const d = addDays(from, i);
    const isMonday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1;
    if (dayW >= 28 || (dayW >= 14 && isMonday) || (dayW < 14 && d.endsWith("-01"))) ticks.push(d);
  }

  const barColor = (t: Task) =>
    t.status === "done" ? "var(--success)" : t.dueDate! < today ? "var(--danger)" : t.status === "in_progress" || t.status === "in_review" ? "var(--cyan)" : "var(--violet)";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4 text-[12px] text-muted">
        <Legend color="var(--violet)" label="Planned" />
        <Legend color="var(--cyan)" label="In progress" />
        <Legend color="var(--danger)" label="Overdue" />
        <Legend color="var(--success)" label="Done" />
        <span className="flex items-center gap-1.5">
          <span className="size-2 rotate-45 bg-cyan" /> Milestone
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-px bg-warning" /> Today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-danger" /> Deadline
        </span>
        <span className="ml-auto text-faint">Tasks without a start date show as a due-date marker.</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel">
        <div className="flex">
          <div className="w-[220px] shrink-0 border-r border-line md:w-[260px]">
            <div className="flex items-end border-b border-line px-3 pb-2 text-[12px] text-muted" style={{ height: HEAD }}>
              Task
            </div>
            {rows.map((t) => (
              <Link
                key={t.id}
                href={`?task=${t.id}`}
                scroll={false}
                className="flex items-center gap-2 truncate border-b border-line/60 px-3 text-[13px] hover:bg-hover/40"
                style={{ height: ROW }}
                title={`${t.title} (${STATUS_LABEL[t.status]}, ${memberName(ctx, t.assigneeId)})`}
              >
                <span className={cn("truncate", t.status === "done" && "text-muted line-through")}>{t.title}</span>
              </Link>
            ))}
            {b.milestones.length > 0 && (
              <div className="flex items-center px-3 text-[12px] text-muted" style={{ height: ROW }}>
                Milestones
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="relative" style={{ width, height: HEAD + height }}>
              {/* Header ticks */}
              <div className="absolute inset-x-0 top-0 border-b border-line" style={{ height: HEAD }}>
                {ticks.map((d) => (
                  <span key={d} className="absolute bottom-2 -translate-x-1/2 whitespace-nowrap text-[11px] text-faint" style={{ left: x(d) + dayW / 2 }}>
                    {dayW >= 28 ? (d.endsWith("-01") || d === ticks[0] ? formatDate(d, today) : String(Number(d.slice(8)))) : formatDate(d, today)}
                  </span>
                ))}
              </div>
              <svg className="absolute left-0" style={{ top: HEAD }} width={width} height={height} aria-hidden>
                {/* Weekend shading */}
                {dayW >= 14 &&
                  Array.from({ length: span }, (_, i) => addDays(from, i))
                    .filter((d) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()))
                    .map((d) => <rect key={d} x={x(d)} y={0} width={dayW} height={height} fill="var(--raised)" opacity="0.5" />)}
                {rows.map((_, i) => (
                  <line key={i} x1={0} x2={width} y1={(i + 1) * ROW} y2={(i + 1) * ROW} stroke="var(--border)" strokeOpacity="0.6" />
                ))}
                {/* Dependency links: from the end of the predecessor to the start of the successor. */}
                {b.dependencies.map((d) => {
                  const pi = rowIndex.get(d.predecessorId);
                  const si = rowIndex.get(d.successorId);
                  if (pi === undefined || si === undefined) return null;
                  const p = rows[pi];
                  const s = rows[si];
                  const x1 = x(p.dueDate!) + dayW;
                  const x2 = x(s.startDate ?? s.dueDate!);
                  const y1 = pi * ROW + ROW / 2;
                  const y2 = si * ROW + ROW / 2;
                  const conflict = p.status !== "done" && p.dueDate! > s.dueDate!;
                  const mid = Math.max(x1 + 6, Math.min(x2 - 6, x1 + 12));
                  return (
                    <path
                      key={d.id}
                      d={`M${x1},${y1} H${mid} V${y2} H${x2}`}
                      fill="none"
                      stroke={conflict ? "var(--danger)" : "var(--faint)"}
                      strokeWidth="1.2"
                      markerEnd={conflict ? "url(#arrow-bad)" : "url(#arrow)"}
                    />
                  );
                })}
                <defs>
                  <marker id="arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0,0 L6,3 L0,6 z" fill="var(--faint)" />
                  </marker>
                  <marker id="arrow-bad" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M0,0 L6,3 L0,6 z" fill="var(--danger)" />
                  </marker>
                </defs>
              </svg>
              {/* Bars */}
              {rows.map((t, i) => {
                const top = HEAD + i * ROW;
                const label = `${t.title}: ${t.startDate ? `${formatDate(t.startDate, today)} to ` : "due "}${formatDate(t.dueDate, today)}, ${STATUS_LABEL[t.status]}`;
                if (!t.startDate) {
                  return (
                    <Link key={t.id} href={`?task=${t.id}`} scroll={false} title={label} aria-label={label} className="absolute" style={{ top: top + ROW / 2 - 5, left: x(t.dueDate!) + dayW / 2 - 5 }}>
                      <span className="block size-2.5 rotate-45 rounded-[2px] border-2" style={{ borderColor: barColor(t) }} />
                    </Link>
                  );
                }
                return (
                  <Link
                    key={t.id}
                    href={`?task=${t.id}`}
                    scroll={false}
                    title={label}
                    aria-label={label}
                    className="absolute rounded-[4px] hover:brightness-125"
                    style={{
                      top: top + 9,
                      height: ROW - 18,
                      left: x(t.startDate) + 1,
                      width: Math.max(dayW - 2, (daysBetween(t.startDate, t.dueDate!) + 1) * dayW - 2),
                      background: barColor(t),
                      opacity: t.status === "done" ? 0.45 : 0.85,
                    }}
                  />
                );
              })}
              {/* Milestones */}
              {b.milestones
                .filter((m) => m.targetDate)
                .map((m) => (
                  <span
                    key={m.id}
                    title={`${m.name}: ${formatDate(m.targetDate, today)}${m.completedAt ? " (complete)" : ""}`}
                    className="absolute size-2.5 rotate-45"
                    style={{
                      top: HEAD + msRowY + ROW / 2 - 5,
                      left: x(m.targetDate!) + dayW / 2 - 5,
                      background: m.completedAt ? "var(--success)" : m.targetDate! < today ? "var(--danger)" : "var(--cyan)",
                    }}
                  />
                ))}
              {/* Today and deadline lines */}
              <span className="pointer-events-none absolute w-px bg-warning/70" style={{ left: x(today) + dayW / 2, top: HEAD - 6, bottom: 0 }} title="Today" />
              {b.project.deadline && (
                <span className="pointer-events-none absolute w-0.5 bg-danger/80" style={{ left: x(b.project.deadline) + dayW, top: HEAD - 6, bottom: 0 }} title={`Deadline ${formatDate(b.project.deadline, today)}`} />
              )}
            </div>
          </div>
        </div>
      </div>
      {unscheduled.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-medium text-muted">Without a due date ({unscheduled.length})</h3>
          <ul className="flex flex-wrap gap-2">
            {unscheduled.map((t) => (
              <li key={t.id}>
                <Link href={`?task=${t.id}`} scroll={false} className="block rounded-md border border-line-strong px-2.5 py-1 text-[12px] text-muted hover:text-fg">
                  {t.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-[12px] text-faint">
        The timeline shows dates as planned. Red links mark a task due before the task it depends on. Changing a date in a task updates this view and Pulse straight away; nothing is rescheduled automatically.
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-4 rounded-sm" style={{ background: color, opacity: 0.85 }} /> {label}
    </span>
  );
}
