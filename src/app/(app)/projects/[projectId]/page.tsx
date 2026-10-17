import Link from "next/link";
import { getAppContext } from "@/lib/data/context";
import { loadAcknowledgements, loadActivity, loadProjectBundle } from "@/lib/data/queries";
import { toRow, waitingOn } from "@/lib/data/views";
import { addDays } from "@/lib/domain/dates";
import { isOpen } from "@/lib/domain/types";
import { ActivityFeed } from "@/components/projects/activity-feed";
import { MilestonesPanel } from "@/components/projects/milestones-panel";
import { ScoreBlock, HealthStrip } from "@/components/pulse/health";
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
  const [activity, acks] = await Promise.all([loadActivity(ctx, { projectId, limit: 10 }), loadAcknowledgements(ctx, [projectId])]);
  const names = Object.fromEntries(ctx.members.map((m) => [m.userId, m.name]));

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
        <Panel title="Health" action={<Link href={`/projects/${projectId}/pulse`} className="text-[12px] text-muted hover:text-fg">Full analysis</Link>}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ScoreBlock assessment={a} size="md" />
            <dl className="flex gap-6 text-[12px]">
              {[
                ["Overdue", a.counts.overdue, a.counts.overdue ? "text-danger" : ""],
                ["Blocked", a.counts.blocked, a.counts.blocked ? "text-warning" : ""],
                ["Stalled", a.counts.stalled, a.counts.stalled ? "text-warning" : ""],
                ["Unassigned", a.counts.unassigned, ""],
              ].map(([l, v, c]) => (
                <div key={l as string}>
                  <dt className="text-faint">{l}</dt>
                  <dd className={`num text-[17px] ${c}`}>{v}</dd>
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

        <Panel title="Due in the next two weeks" bodyClassName="p-0" action={<AddTaskButton projectId={projectId} compact />}>
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
          <Panel title={`Waiting on other tasks (${blocked.length})`} bodyClassName="p-0">
            <ul className="divide-y divide-line">
              {blocked.slice(0, 8).map((t) => (
                <TaskRow key={t.id} task={toRow(b, t)} showProject={false} />
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Milestones" className="scroll-mt-20">
          <div id="milestones" />
          <MilestonesPanel
            projectId={projectId}
            milestones={b.milestones.map((m) => {
              const linked = b.tasks.filter((t) => t.milestoneId === m.id);
              return { ...m, linked: linked.length, linkedDone: linked.filter((t) => t.status === "done").length };
            })}
          />
        </Panel>

        <Panel title="Workload">
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

        <Panel title="Recent activity" action={<Link href={`/projects/${projectId}/activity`} className="text-[12px] text-muted hover:text-fg">All activity</Link>}>
          <ActivityFeed events={activity} names={names} />
        </Panel>
      </div>
    </div>
  );
}
