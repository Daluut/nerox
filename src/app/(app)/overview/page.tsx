import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowRight, CheckSquare, FolderKanban, GitBranch, ListChecks, Plus } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadAcknowledgements, loadWorkspaceBundles, recordSnapshots } from "@/lib/data/queries";
import { attentionScore, isActiveProject, toRow } from "@/lib/data/views";
import { formatDate, daysBetween } from "@/lib/domain/dates";
import { can } from "@/lib/domain/permissions";
import { isOpen } from "@/lib/domain/types";
import { HEALTH_LABEL, SEVERITY_RANK } from "@/lib/pulse/types";
import { RiskCard } from "@/components/pulse/risk-card";
import { TaskRow } from "@/components/tasks/task-row";
import { HEALTH_COLOR } from "@/components/ui/badges";
import { ButtonLink, EmptyState, IconBadge, Panel } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Home" };

function greeting(timezone: string) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hour12: false }).format(new Date()));
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/**
 * Home: three answers and nothing else — what needs me, how are my projects,
 * and the one thing Pulse most wants me to know. Activity and upcoming dates
 * live on the Updates page.
 */
export default async function HomePage() {
  const ctx = await getAppContext();
  const bundles = await loadWorkspaceBundles(ctx);
  const first = ctx.displayName.split(" ")[0];
  const canCreate = can(ctx.role, "project.create");

  if (!bundles.length) return <NewUserState name={first} canCreate={canCreate} greet={greeting(ctx.timezone)} />;

  const active = bundles.filter(isActiveProject);
  await recordSnapshots(ctx, active);
  const acks = await loadAcknowledgements(ctx, active.map((b) => b.project.id));

  const mine = active
    .flatMap((b) => b.tasks.filter((t) => isOpen(t) && t.assigneeId === ctx.userId).map((t) => ({ b, t, score: attentionScore(b, t, ctx.today) })))
    .sort((a, b) => b.score - a.score);
  const needsMe = mine.filter((m) => m.score >= 25);
  const onTrack = active.filter((b) => b.assessment.status === "healthy").length;
  const atRisk = active.filter((b) => b.assessment.status === "at_risk" || b.assessment.status === "critical");
  const topRisk = active
    .flatMap((b) => b.assessment.risks.map((r) => ({ r, b })))
    .filter(({ r, b }) => !acks.has(`${b.project.id}:${r.id}`))
    .sort((x, y) => SEVERITY_RANK[y.r.severity] - SEVERITY_RANK[x.r.severity] || y.r.weight - x.r.weight)[0];

  const stats = [
    { label: "Tasks that need you", value: needsMe.length, sub: `${mine.length} open in total`, href: "/my-tasks", color: "var(--c-tasks)", icon: <CheckSquare className="size-5" /> },
    { label: "Projects on track", value: `${onTrack}/${active.length}`, sub: "healthy right now", href: "/projects", color: "var(--c-projects)", icon: <FolderKanban className="size-5" /> },
    { label: "Projects at risk", value: atRisk.length, sub: atRisk.length ? "open Pulse to see why" : "nothing urgent", href: "/pulse", color: "var(--c-pulse)", icon: <Activity className="size-5" /> },
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">
            {greeting(ctx.timezone)}, {first}
          </h1>
          <p className="mt-1 text-[16px] text-muted">Here&apos;s where things stand in {ctx.workspace.name}.</p>
        </div>
        {canCreate && (
          <ButtonLink href="/projects/new" variant="primary">
            <Plus className="size-4" /> New project
          </ButtonLink>
        )}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-4 shadow-card transition-transform hover:-translate-y-0.5 sm:p-5"
          >
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.color }} />
            <div className="flex items-center gap-4 sm:block">
              <div className="flex items-center justify-between">
                <IconBadge color={s.color}>{s.icon}</IconBadge>
                <ArrowRight className="hidden size-4 text-faint transition-transform group-hover:translate-x-0.5 sm:block" />
              </div>
              <div>
                <p className="num text-[28px] font-bold leading-none sm:mt-4 sm:text-[34px]">{s.value}</p>
                <p className="mt-1.5 text-[15px] font-semibold sm:mt-2">{s.label}</p>
                <p className="text-[13px] text-muted">{s.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel
          title="Up next for you"
          icon={<CheckSquare className="size-4" />}
          accent="var(--c-tasks)"
          bodyClassName="px-2 pb-3 pt-2"
          action={
            <Link href="/my-tasks" className="text-[14px] font-medium text-violet hover:underline">
              See all
            </Link>
          }
        >
          {mine.length ? (
            <ul className="divide-y divide-line">
              {mine.slice(0, 6).map(({ b, t }) => (
                <TaskRow key={t.id} task={toRow(b, t)} showAssignee={false} />
              ))}
            </ul>
          ) : (
            <EmptyState className="px-3" title="Nothing on your plate">
              When someone assigns you a task, it shows up here with the most urgent first.
            </EmptyState>
          )}
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel
            title="Your projects"
            icon={<FolderKanban className="size-4" />}
            accent="var(--c-projects)"
            bodyClassName="flex flex-col gap-3 px-5 pb-5 pt-3"
            action={
              <Link href="/projects" className="text-[14px] font-medium text-violet hover:underline">
                See all
              </Link>
            }
          >
            {active.length ? (
              active.slice(0, 4).map((b) => {
                const a = b.assessment;
                const color = HEALTH_COLOR[a.status];
                const days = b.project.deadline ? daysBetween(ctx.today, b.project.deadline) : null;
                return (
                  <Link key={b.project.id} href={`/projects/${b.project.id}`} className="flex items-center gap-4 rounded-xl border border-line p-3.5 hover:border-line-strong hover:bg-hover/40">
                    <span
                      className="num flex size-12 shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
                      style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color, boxShadow: `inset 0 0 0 3px ${color}` }}
                      title={HEALTH_LABEL[a.status]}
                    >
                      {a.score ?? "–"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{b.project.name}</span>
                      <span className="block text-[13px]" style={{ color }}>
                        {HEALTH_LABEL[a.status]}
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-hover">
                        <span className="block h-full rounded-full bg-c-projects" style={{ width: `${a.progress.percent}%` }} />
                      </span>
                    </span>
                    <span className="hidden text-right text-[13px] text-muted sm:block">
                      {a.progress.percent}% done
                      {b.project.deadline && (
                        <span className="block text-faint">{days !== null && days < 0 ? "deadline passed" : `due ${formatDate(b.project.deadline, ctx.today)}`}</span>
                      )}
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="text-[14px] text-muted">No active projects. Completed and archived ones are on the Projects page.</p>
            )}
          </Panel>

          <Panel title="Pulse says" icon={<Activity className="size-4" />} accent="var(--c-pulse)" bodyClassName="px-5 pb-5 pt-3">
            {topRisk ? (
              <>
                <RiskCard risk={topRisk.r} projectId={topRisk.b.project.id} projectName={topRisk.b.project.name} compact />
                <Link href="/pulse" className="mt-3 inline-block text-[14px] font-medium text-violet hover:underline">
                  See everything Pulse found
                </Link>
              </>
            ) : (
              <p className="text-[14px] text-muted">
                {active.every((b) => b.assessment.status === "insufficient_data")
                  ? "Add due dates and a few more tasks so Pulse can check your projects."
                  : "Nothing needs attention right now. Nice work."}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function NewUserState({ name, canCreate, greet }: { name: string; canCreate: boolean; greet: string }) {
  const steps = [
    { icon: <ListChecks className="size-5" />, color: "var(--c-tasks)", title: "Add your tasks", body: "Give each one an owner and a due date. A template can do the first draft for you." },
    { icon: <GitBranch className="size-5" />, color: "var(--c-projects)", title: "Link what depends on what", body: "So when one task slips, you can see what it holds up." },
    { icon: <Activity className="size-5" />, color: "var(--c-pulse)", title: "Check the Pulse", body: "A health score for each project, with the reasons behind it." },
  ];
  return (
    <div className="mx-auto max-w-[880px] px-5 py-14 md:py-20">
      <h1 className="text-[34px] font-bold tracking-tight">
        {greet}, {name}
      </h1>
      <p className="mt-3 max-w-xl text-[17px] text-muted">Your workspace is ready. Create your first project and Nerox will start keeping an eye on it for you.</p>
      {canCreate ? (
        <ButtonLink href="/projects/new" variant="primary" size="lg" className="mt-8">
          <Plus className="size-5" /> Create your first project
        </ButtonLink>
      ) : (
        <p className="mt-8 text-[15px] text-muted">You have view-only access. Ask an admin to add a project or give you member access.</p>
      )}
      <ol className="mt-14 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-line bg-panel p-5 shadow-card">
            <IconBadge color={s.color}>{s.icon}</IconBadge>
            <p className="mt-4 text-[16px] font-semibold">
              {i + 1}. {s.title}
            </p>
            <p className="mt-1 text-[14px] text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
