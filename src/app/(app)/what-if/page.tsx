import type { Metadata } from "next";
import Link from "next/link";
import { Split } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadProjectBundle, loadWorkspaceBundles } from "@/lib/data/queries";
import { isActiveProject } from "@/lib/data/views";
import { can } from "@/lib/domain/permissions";
import { describeChange, fingerprint, type Change } from "@/lib/whatif/engine";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";
import { WhatIfLab } from "./lab";

export const metadata: Metadata = { title: "What If?" };

export default async function WhatIfPage({ searchParams }: { searchParams: Promise<{ project?: string; delay?: string }> }) {
  const ctx = await getAppContext();
  const sp = await searchParams;
  const active = (await loadWorkspaceBundles(ctx)).filter(isActiveProject);
  const selected = active.find((b) => b.project.id === sp.project) ?? active[0];

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-10">
      <PageHeader
        title="What If?"
        description="Try out a change before you make it, and see exactly what it would do to your project."
        icon={<Split className="size-6" />}
        color="var(--c-whatif)"
      />

      <ol className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          ["Pick a change", "A task running late, someone off sick, a deadline moving, work changing hands."],
          ["See the knock-on effects", "Nerox follows your task links to show which dates move, who's affected and how the health score changes."],
          ["Apply it, or don't", "Nothing changes in your real project until you press Apply and confirm."],
        ].map(([t, b], i) => (
          <li key={t} className="rounded-2xl border border-line bg-panel p-5 shadow-card">
            <span className="flex size-8 items-center justify-center rounded-lg bg-c-whatif text-[15px] font-bold text-white">{i + 1}</span>
            <p className="mt-3 text-[16px] font-semibold">{t}</p>
            <p className="mt-1 text-[14px] text-muted">{b}</p>
          </li>
        ))}
      </ol>

      {!selected ? (
        <EmptyState
          className="mt-6"
          title="You need a project to try things out on"
          action={
            can(ctx.role, "project.create") ? (
              <ButtonLink href="/projects/new" variant="primary">
                Create a project
              </ButtonLink>
            ) : undefined
          }
        >
          What If? works on the tasks, dates and links in a real project.
        </EmptyState>
      ) : (
        <Lab ctx={ctx} projectId={selected.project.id} projects={active.map((b) => ({ id: b.project.id, name: b.project.name }))} delayTaskId={sp.delay} />
      )}
    </div>
  );
}

async function Lab({
  ctx,
  projectId,
  projects,
  delayTaskId,
}: {
  ctx: Awaited<ReturnType<typeof getAppContext>>;
  projectId: string;
  projects: { id: string; name: string }[];
  delayTaskId?: string;
}) {
  const b = await loadProjectBundle(ctx, projectId);
  const fp = fingerprint(b.project, b.tasks, b.dependencies);
  const { data: saved } = await ctx.supabase
    .from("scenarios")
    .select("id, name, changes, baseline_fingerprint, results, applied_at, created_at, creator_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  const titles = new Map(b.tasks.map((t) => [t.id, t.title]));
  const name = (id: string | null) => (id ? (ctx.members.find((m) => m.userId === id)?.name ?? "Former member") : "nobody");
  const openTasks = b.tasks.filter((t) => t.status !== "done");

  return (
    <>
      {projects.length > 1 && (
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Choose a project">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/what-if?project=${p.id}`}
              aria-current={p.id === projectId ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-xl px-4 text-[14px] font-semibold",
                p.id === projectId ? "bg-c-whatif text-white" : "border border-line bg-panel text-muted hover:text-fg",
              )}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      )}
      <WhatIfLab
        projectId={projectId}
        projectName={b.project.name}
        deadline={b.project.deadline}
        canEdit={can(ctx.role, "project.edit")}
        tasks={openTasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, assigneeId: t.assigneeId }))}
        people={ctx.members.filter((m) => m.status === "active").map((m) => ({ userId: m.userId, name: m.name }))}
        initialDelayTaskId={delayTaskId && openTasks.some((t) => t.id === delayTaskId && t.dueDate) ? delayTaskId : undefined}
        saved={(saved ?? []).map((s) => {
          const changes = s.changes as Change[];
          return {
            id: s.id as string,
            name: s.name as string,
            changes,
            labels: changes.map((c) => describeChange(c, (id) => titles.get(id) ?? "a deleted task", name)),
            summary: (s.results as { summary?: string })?.summary ?? "",
            stale: s.baseline_fingerprint !== fp,
            appliedAt: s.applied_at as string | null,
            createdAt: s.created_at as string,
            creator: name(s.creator_id as string | null),
          };
        })}
      />
    </>
  );
}
