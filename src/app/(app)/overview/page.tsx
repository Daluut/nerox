import type { Metadata } from "next";
import Link from "next/link";
import { Activity, FolderKanban, GitBranch, ListChecks } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadAcknowledgements, loadActivity, loadWorkspaceBundles, recordSnapshots } from "@/lib/data/queries";
import { attentionScore, isActiveProject, toHealthRow, toRow } from "@/lib/data/views";
import { addDays, daysBetween, formatDate, relativeDay } from "@/lib/domain/dates";
import { can } from "@/lib/domain/permissions";
import { PRIORITY_RANK, isOpen } from "@/lib/domain/types";
import { SEVERITY_RANK } from "@/lib/pulse/types";
import { ProjectHealthList } from "@/components/projects/project-health-list";
import { ActivityFeed } from "@/components/projects/activity-feed";
import { RiskCard } from "@/components/pulse/risk-card";
import { TaskRow } from "@/components/tasks/task-row";
import { ButtonLink, EmptyState, Panel } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Overview" };

function greeting(timezone: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()));
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage() {
  const ctx = await getAppContext();
  const bundles = await loadWorkspaceBundles(ctx);
  const first = ctx.displayName.split(" ")[0];

  if (!bundles.length) return <NewUserState name={first} canCreate={can(ctx.role, "project.create")} greet={greeting(ctx.timezone)} />;

  const active = bundles.filter(isActiveProject);
  await recordSnapshots(ctx, active);
  const [activity, acks] = await Promise.all([loadActivity(ctx, { limit: 12 }), loadAcknowledgements(ctx, active.map((b) => b.project.id))]);

  const mine = active.flatMap((b) => b.tasks.filter((t) => isOpen(t) && t.assigneeId === ctx.userId).map((t) => ({ b, t, score: attentionScore(b, t, ctx.today) })));
  const attention = mine.filter((m) => m.score >= 25).sort((a, b) => b.score - a.score);
  const priorities = (attention.length ? attention : mine.sort((a, b) => b.score - a.score)).slice(0, 7);
  const horizon = addDays(ctx.today, 14);
  const allOpen = active.flatMap((b) => b.tasks.filter(isOpen));
  const dueSoon = allOpen.filter((t) => t.dueDate && t.dueDate >= ctx.today && t.dueDate <= horizon).length;
  const atRisk = active.filter((b) => b.assessment.status === "at_risk" || b.assessment.status === "critical");

  const highlights = active
    .flatMap((b) => b.assessment.risks.map((r) => ({ r, b })))
    .filter(({ r, b }) => !acks.has(`${b.project.id}:${r.id}`))
    .sort((x, y) => SEVERITY_RANK[y.r.severity] - SEVERITY_RANK[x.r.severity] || y.r.weight - x.r.weight)
    .slice(0, 5);

  type Upcoming = { key: string; date: string; title: string; sub: string; href: string; kind: "milestone" | "deadline" | "task"; overdue: boolean };
  const upcoming: Upcoming[] = [
    ...active.flatMap((b) =>
      b.milestones
        .filter((m) => !m.completedAt && m.targetDate && m.targetDate <= horizon)
        .map((m) => ({ key: m.id, date: m.targetDate!, title: m.name, sub: `Milestone in ${b.project.name}`, href: `/projects/${b.project.id}#milestones`, kind: "milestone" as const, overdue: m.targetDate! < ctx.today })),
    ),
    ...active
      .filter((b) => b.project.deadline && b.project.deadline >= addDays(ctx.today, -7) && b.project.deadline <= horizon)
      .map((b) => ({ key: `d${b.project.id}`, date: b.project.deadline!, title: `${b.project.name} deadline`, sub: `${b.assessment.counts.open} tasks open`, href: `/projects/${b.project.id}`, kind: "deadline" as const, overdue: b.project.deadline! < ctx.today && b.assessment.counts.open > 0 })),
    ...active.flatMap((b) =>
      b.tasks
        .filter((t) => isOpen(t) && PRIORITY_RANK[t.priority] >= 2 && t.dueDate && t.dueDate >= ctx.today && t.dueDate <= horizon)
        .map((t) => ({ key: t.id, date: t.dueDate!, title: t.title, sub: b.project.name, href: `/projects/${b.project.id}?task=${t.id}`, kind: "task" as const, overdue: false })),
    ),
  ]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 8);

  const names = Object.fromEntries(ctx.members.map((m) => [m.userId, m.name]));
  const projectNames = Object.fromEntries(bundles.map((b) => [b.project.id, b.project.name]));
  const myOverdue = mine.filter((m) => m.t.dueDate && m.t.dueDate < ctx.today).length;

  const metrics = [
    { label: "Active projects", value: active.length, href: "/projects", tone: "" },
    { label: "My tasks needing attention", value: attention.length, href: "/my-tasks", tone: attention.length ? "text-warning" : "", sub: myOverdue ? `${myOverdue} overdue` : undefined },
    { label: "Tasks due in 14 days", value: dueSoon, href: "/my-tasks?view=upcoming&scope=all", tone: "" },
    { label: "Projects at risk", value: atRisk.length, href: "/projects?health=risk", tone: atRisk.length ? "text-danger" : "" },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold">
            {greeting(ctx.timezone)}, {first}
          </h1>
          <p className="mt-1 text-muted">
            {active.length} active {active.length === 1 ? "project" : "projects"} in {ctx.workspace.name}, {allOpen.length} open tasks.
          </p>
        </div>
        {can(ctx.role, "project.create") && (
          <ButtonLink href="/projects/new" variant="secondary" size="sm">
            <FolderKanban className="size-3.5" /> New project
          </ButtonLink>
        )}
      </div>

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-panel lg:grid-cols-4">
        {metrics.map((m, i) => (
          <Link key={m.label} href={m.href} className={cn("group px-4 py-3.5 hover:bg-hover/50", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line lg:border-t-0", i === 2 && "lg:border-l")}>
            <dt className="text-[12px] text-muted group-hover:text-fg">{m.label}</dt>
            <dd className={cn("num mt-1 text-[24px] font-semibold leading-none", m.tone)}>
              {m.value}
              {m.sub && <span className="ml-2 font-sans text-[12px] font-normal text-danger">{m.sub}</span>}
            </dd>
          </Link>
        ))}
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Project health" bodyClassName="p-0" action={<Link href="/pulse" className="text-[12px] text-muted hover:text-fg">Open Pulse</Link>}>
            <ProjectHealthList rows={active.map(toHealthRow)} />
          </Panel>

          <Panel title="My priorities" bodyClassName="p-0" action={<Link href="/my-tasks" className="text-[12px] text-muted hover:text-fg">All my tasks</Link>}>
            {priorities.length ? (
              <ul className="divide-y divide-line py-1">
                {priorities.map(({ b, t }) => (
                  <TaskRow key={t.id} task={toRow(b, t)} showAssignee={false} />
                ))}
              </ul>
            ) : (
              <EmptyState className="px-4" title="Nothing assigned to you right now">
                Tasks assigned to you across every project show up here, most urgent first.
              </EmptyState>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Panel title="Pulse highlights" bodyClassName="p-3">
            {highlights.length ? (
              <div className="flex flex-col gap-2">
                {highlights.map(({ r, b }) => (
                  <RiskCard key={`${b.project.id}:${r.id}`} risk={r} projectId={b.project.id} projectName={b.project.name} compact />
                ))}
              </div>
            ) : (
              <p className="px-1 py-2 text-[13px] text-muted">
                {active.every((b) => b.assessment.status === "insufficient_data")
                  ? "Pulse needs due dates and a few more tasks before it can spot risks."
                  : "No open risks. Pulse checks overdue work, stalled tasks, dependencies and workload each time you load a page."}
              </p>
            )}
          </Panel>

          <Panel title="Next two weeks" className="scroll-mt-20" bodyClassName="p-0">
            {upcoming.length ? (
              <ol className="divide-y divide-line" id="upcoming">
                {upcoming.map((u) => (
                  <li key={u.key}>
                    <Link href={u.href} scroll={false} className="flex items-center gap-3 px-4 py-2.5 hover:bg-hover/40">
                      <span className={cn("w-14 shrink-0 text-[12px]", u.overdue ? "text-danger" : "text-muted")}>{formatDate(u.date, ctx.today)}</span>
                      <span
                        aria-hidden
                        className={cn("size-2 shrink-0", u.kind === "milestone" ? "rotate-45 bg-cyan" : u.kind === "deadline" ? "rounded-sm bg-violet" : "rounded-full bg-faint", u.overdue && "bg-danger")}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]">{u.title}</span>
                        <span className="block truncate text-[12px] text-faint">
                          {u.sub}
                          {u.overdue ? `, ${-daysBetween(ctx.today, u.date)} days overdue` : `, ${relativeDay(u.date, ctx.today)}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-4 py-4 text-[13px] text-muted">No milestones, deadlines or high-priority tasks in the next 14 days.</p>
            )}
          </Panel>

          <Panel title="Recent activity">
            <ActivityFeed events={activity} names={names} projectNames={projectNames} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function NewUserState({ name, canCreate, greet }: { name: string; canCreate: boolean; greet: string }) {
  return (
    <div className="mx-auto max-w-[760px] px-5 py-14 md:py-20">
      <h1 className="text-[28px] font-semibold">
        {greet}, {name}
      </h1>
      <p className="mt-3 max-w-lg text-[15px] text-muted">
        There are no projects in this workspace yet. Create one and Nerox starts tracking it — there&apos;s nothing to read until there&apos;s real work in it.
      </p>
      {canCreate ? (
        <ButtonLink href="/projects/new" variant="primary" className="mt-8">
          Create your first project
        </ButtonLink>
      ) : (
        <p className="mt-8 text-[13px] text-faint">You have view-only access. Ask an admin to add a project or give you member access.</p>
      )}
      <ol className="mt-16 grid gap-6 border-t border-line pt-8 sm:grid-cols-3">
        {[
          { icon: ListChecks, title: "Add tasks", body: "Give them owners and due dates. A template can start you off." },
          { icon: GitBranch, title: "Connect them", body: "Mark which tasks wait on others so delays can be traced." },
          { icon: Activity, title: "Read the Pulse", body: "A health score with the evidence behind it. It gets sharper as real progress is recorded." },
        ].map((s, i) => (
          <li key={s.title}>
            <s.icon className="size-4 text-violet-strong" />
            <p className="mt-3 text-[13px] font-medium">
              {i + 1}. {s.title}
            </p>
            <p className="mt-1 text-[13px] text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
