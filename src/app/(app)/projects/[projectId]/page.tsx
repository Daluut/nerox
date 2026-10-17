import Link from "next/link";
import { Activity, CalendarDays, Flag, GitBranch, Users } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadAcknowledgements, loadProjectBundle } from "@/lib/data/queries";
import { toRow, waitingOn } from "@/lib/data/views";
import { addDays } from "@/lib/domain/dates";
import { isOpen } from "@/lib/domain/types";
import { MilestonesPanel } from "@/components/projects/milestones-panel";
import { HealthStrip } from "@/components/pulse/health";
import { RiskCard } from "@/components/pulse/risk-card";
import { TaskRow } from "@/components/tasks/task-row";
import { Panel } from "@/components/ui/primitives";
import { Avatar } from "@/components/ui/primitives";
import { AddTaskButton } from "@/components/tasks/add-task-button";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  const b = await loadProjectBundle(ctx, projectId);
  const a = b.assessment;
  const acks = await loadAcknowledgements(ctx, [projectId]);

  const blocked = b.tasks.filter((t) => isOpen(t) && waitingOn(b, t.id).length > 0);
  const upcoming = b.tasks
    .filter((t) => isOpen(t) && t.dueDate && t.dueDate <= addDays(ctx.today, 14))
    .sort((x, y) => (x.dueDate! < y.dueDate! ? -1 : 1))
    .slice(0, 8);
  const maxLoad = Math.max(1, ...a.workload.map((w) => w.openEffort));
  const unassigned = b.tasks.filter((t) => isOpen(t) && !t.assigneeId).length;

  if (!b.tasks.length) {
    return (
      <div className="max-w-xl py-6">
        <h2 className="text-[17px] font-semibold">Add the first tasks</h2>
        <p className="mt-2 text-muted">
          Pulse assesses the project once it has at least three tasks. Due dates, estimates and dependencies make the assessment sharper — without them it will tell you what it can&apos;t measure.
        </p>
        <div className="mt-6">
          <AddTaskButton projectId={projectId} label="Add a task" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel
          title="What Pulse found"
          icon={<Activity className="size-4" />}
          accent="var(--c-pulse)"
          action={<Link href={`/projects/${projectId}/pulse`} className="text-[14px] font-medium text-violet hover:underline">Full analysis</Link>}
        >
          <div className="flex flex-wrap items-end justify-between gap-4">
            <dl className="grid w-full grid-cols-4 gap-3 text-[13px]">
              {[
                ["Overdue", a.counts.overdue, a.counts.overdue ? "text-danger" : ""],
                ["Blocked", a.counts.blocked, a.counts.blocked ? "text-warning" : ""],
                ["Stalled", a.counts.stalled, a.counts.stalled ? "text-warning" : ""],
                ["Unassigned", a.counts.unassigned, ""],
              ].map(([l, v, c]) => (
                <div key={l as string} className="rounded-xl bg-raised px-3 py-2.5">
                  <dt className="text-muted">{l}</dt>
                  <dd className={`num text-[22px] font-bold ${c}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HealthStrip assessment={a} className="mt-4" height={6} />
          {a.risks.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              {a.risks.slice(0, 3).map((r) => (
                <RiskCard key={r.id} risk={r} projectId={projectId} acknowledged={acks.get(`${projectId}:${r.id}`)} compact />
              ))}
              {a.risks.length > 3 && (
                <Link href={`/projects/${projectId}/pulse`} className="mt-1 text-[12px] text-muted hover:text-fg">
                  {a.risks.length - 3} more in Pulse
                </Link>
              )}
            </div>
          )}
          {a.status === "insufficient_data" && <p className="mt-4 text-[13px] text-muted">{a.limitations[0]}</p>}
        </Panel>

        <Panel title="Due in the next two weeks" icon={<CalendarDays className="size-4" />} accent="var(--c-tasks)" bodyClassName="px-2 pb-3 pt-2" action={<AddTaskButton projectId={projectId} compact />}>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((t) => (
                <TaskRow key={t.id} task={toRow(b, t)} showProject={false} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-[13px] text-muted">Nothing due in the next 14 days.</p>
          )}
        </Panel>

        {blocked.length > 0 && (
          <Panel title={`Waiting on other tasks (${blocked.length})`} icon={<GitBranch className="size-4" />} accent="var(--warning)" bodyClassName="px-2 pb-3 pt-2">
            <ul className="divide-y divide-line">
              {blocked.slice(0, 8).map((t) => (
                <TaskRow key={t.id} task={toRow(b, t)} showProject={false} />
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Milestones" icon={<Flag className="size-4" />} accent="var(--c-projects)" className="scroll-mt-20">
          <div id="milestones" />
          <MilestonesPanel
            projectId={projectId}
            milestones={b.milestones.map((m) => {
              const linked = b.tasks.filter((t) => t.milestoneId === m.id);
              return { ...m, linked: linked.length, linkedDone: linked.filter((t) => t.status === "done").length };
            })}
          />
        </Panel>

        <Panel title="Who's doing what" icon={<Users className="size-4" />} accent="var(--c-team)">
          {a.workload.length ? (
            <ul className="flex flex-col gap-3">
              {a.workload.map((w) => (
                <li key={w.userId} className="flex items-center gap-2.5">
                  <Avatar name={w.name} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-[12px]">
                      <span className="truncate">{w.name}</span>
                      <span className="num text-muted">
                        {w.openTasks} {w.openTasks === 1 ? "task" : "tasks"}
                        {a.progress.method === "effort" ? `, ${w.openEffort} h` : ""}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-hover">
                      <div className="h-full rounded-full bg-cyan" style={{ width: `${(w.openEffort / maxLoad) * 100}%` }} />
                    </div>
                    {(w.overdue > 0 || w.dueSoon > 0) && (
                      <p className="mt-0.5 text-[11px] text-faint">
                        {w.overdue > 0 && <span className="text-danger">{w.overdue} overdue </span>}
                        {w.dueSoon > 0 && `${w.dueSoon} due this week`}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Add team members to the project to see how work is spread.</p>
          )}
          {unassigned > 0 && <p className="mt-3 text-[12px] text-faint">{unassigned} open tasks are unassigned.</p>}
          <p className="mt-3 text-[11px] text-faint">Outstanding {a.progress.method === "effort" ? "estimated hours" : "tasks"} per person. Capacity isn&apos;t tracked.</p>
        </Panel>

      </div>
    </div>
  );
}
