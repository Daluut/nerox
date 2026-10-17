import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, History } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadActivity, loadWorkspaceBundles } from "@/lib/data/queries";
import { isActiveProject } from "@/lib/data/views";
import { addDays, daysBetween, formatDate, relativeDay } from "@/lib/domain/dates";
import { PRIORITY_RANK, isOpen } from "@/lib/domain/types";
import { ActivityFeed } from "@/components/projects/activity-feed";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Updates" };

/** What's coming up and what just happened, kept off the Home page so Home stays simple. */
export default async function UpdatesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = t === "activity" ? "activity" : "upcoming";

  return (
    <div className="mx-auto max-w-[860px] px-4 py-8 md:px-10">
      <PageHeader title="Updates" description="Deadlines coming up, and what your team has been doing." icon={<Bell className="size-6" />} color="var(--c-tasks)" />
      <nav className="mt-8 flex gap-2" aria-label="Updates">
        {[
          { id: "upcoming", label: "Coming up", icon: CalendarDays },
          { id: "activity", label: "Recent activity", icon: History },
        ].map((x) => (
          <Link
            key={x.id}
            href={x.id === "upcoming" ? "/updates" : "/updates?tab=activity"}
            aria-current={tab === x.id ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-semibold",
              tab === x.id ? "bg-violet text-white" : "border border-line bg-panel text-muted hover:text-fg",
            )}
          >
            <x.icon className="size-4" /> {x.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{tab === "upcoming" ? <Upcoming /> : <Recent />}</div>
    </div>
  );
}

async function Upcoming() {
  const ctx = await getAppContext();
  const active = (await loadWorkspaceBundles(ctx)).filter(isActiveProject);
  const horizon = addDays(ctx.today, 21);
  type Item = { key: string; date: string; title: string; sub: string; href: string; kind: "milestone" | "deadline" | "task"; overdue: boolean };
  const items: Item[] = [
    ...active.flatMap((b) =>
      b.milestones
        .filter((m) => !m.completedAt && m.targetDate && m.targetDate <= horizon)
        .map((m) => ({ key: m.id, date: m.targetDate!, title: m.name, sub: `Milestone in ${b.project.name}`, href: `/projects/${b.project.id}#milestones`, kind: "milestone" as const, overdue: m.targetDate! < ctx.today })),
    ),
    ...active
      .filter((b) => b.project.deadline && b.project.deadline >= addDays(ctx.today, -7) && b.project.deadline <= horizon)
      .map((b) => ({
        key: `d${b.project.id}`,
        date: b.project.deadline!,
        title: `${b.project.name} deadline`,
        sub: `${b.assessment.counts.open} tasks still open`,
        href: `/projects/${b.project.id}`,
        kind: "deadline" as const,
        overdue: b.project.deadline! < ctx.today && b.assessment.counts.open > 0,
      })),
    ...active.flatMap((b) =>
      b.tasks
        .filter((t) => isOpen(t) && t.dueDate && t.dueDate <= horizon && (PRIORITY_RANK[t.priority] >= 2 || t.assigneeId === ctx.userId))
        .map((t) => ({ key: t.id, date: t.dueDate!, title: t.title, sub: b.project.name, href: `/projects/${b.project.id}?task=${t.id}`, kind: "task" as const, overdue: t.dueDate! < ctx.today })),
    ),
  ].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (!items.length) {
    return <p className="rounded-2xl border border-line bg-panel p-6 text-[15px] text-muted">Nothing due in the next three weeks.</p>;
  }
  const KIND = { milestone: ["Milestone", "var(--c-projects)"], deadline: ["Project deadline", "var(--violet)"], task: ["Task", "var(--c-tasks)"] } as const;
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((u) => (
        <li key={u.key}>
          <Link href={u.href} scroll={false} className="flex items-center gap-4 rounded-2xl border border-line bg-panel p-4 shadow-card hover:border-line-strong">
            <span
              className="flex w-16 shrink-0 flex-col items-center rounded-xl py-1.5"
              style={{ background: `color-mix(in srgb, ${u.overdue ? "var(--danger)" : KIND[u.kind][1]} 14%, transparent)`, color: u.overdue ? "var(--danger)" : KIND[u.kind][1] }}
            >
              <span className="num text-[20px] font-bold leading-tight">{u.date.slice(8)}</span>
              <span className="text-[12px] font-medium">{formatDate(u.date, ctx.today).split(" ")[1]}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{u.title}</span>
              <span className="block truncate text-[13px] text-muted">
                {KIND[u.kind][0]}, {u.sub}
              </span>
            </span>
            <span className={cn("text-[13px] font-medium whitespace-nowrap", u.overdue ? "text-danger" : "text-muted")}>
              {u.overdue ? `${-daysBetween(ctx.today, u.date)} days overdue` : relativeDay(u.date, ctx.today)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

async function Recent() {
  const ctx = await getAppContext();
  const [events, bundles] = await Promise.all([loadActivity(ctx, { limit: 60 }), loadWorkspaceBundles(ctx)]);
  const names = Object.fromEntries(ctx.members.map((m) => [m.userId, m.name]));
  const projectNames = Object.fromEntries(bundles.map((b) => [b.project.id, b.project.name]));
  return (
    <Panel>
      <ActivityFeed events={events} names={names} projectNames={projectNames} empty="Nothing has happened in this workspace yet." />
    </Panel>
  );
}
