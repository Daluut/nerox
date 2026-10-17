import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadWorkspaceBundles } from "@/lib/data/queries";
import { isActiveProject, toHealthRow } from "@/lib/data/views";
import { can } from "@/lib/domain/permissions";
import { ProjectHealthList } from "@/components/projects/project-health-list";
import { ButtonLink, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ health?: string; show?: string }> }) {
  const ctx = await getAppContext();
  const bundles = await loadWorkspaceBundles(ctx);
  const { health, show } = await searchParams;
  const tab = show === "completed" || show === "archived" ? show : "active";
  const groups = {
    active: bundles.filter(isActiveProject),
    completed: bundles.filter((b) => !b.project.archivedAt && b.project.status === "completed"),
    archived: bundles.filter((b) => !!b.project.archivedAt),
  };
  const rows = groups[tab].map(toHealthRow);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold">Projects</h1>
          <p className="mt-1 text-muted">Health is recalculated from current task data every time this page loads.</p>
        </div>
        {can(ctx.role, "project.create") && (
          <ButtonLink href="/projects/new" variant="primary" size="sm">
            New project
          </ButtonLink>
        )}
      </div>
      <nav className="mt-6 flex gap-1 border-b border-line" aria-label="Project status">
        {(["active", "completed", "archived"] as const).map((t) => (
          <Link
            key={t}
            href={t === "active" ? "/projects" : `/projects?show=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={cn("-mb-px border-b-2 px-3 py-2 text-[13px] capitalize", tab === t ? "border-violet text-fg" : "border-transparent text-muted hover:text-fg")}
          >
            {t} <span className="num text-[11px] text-faint">{groups[t].length}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-4 overflow-hidden rounded-lg border border-line bg-panel">
        {rows.length ? (
          <ProjectHealthList rows={rows} initialFilter={health === "risk" ? "risk" : "all"} />
        ) : (
          <EmptyState
            className="px-5"
            icon={<FolderKanban className="size-5" />}
            title={tab === "active" ? "No active projects" : tab === "completed" ? "No completed projects yet" : "Nothing archived"}
            action={
              tab === "active" && can(ctx.role, "project.create") ? (
                <ButtonLink href="/projects/new" variant="primary" size="sm">
                  Create a project
                </ButtonLink>
              ) : undefined
            }
          >
            {tab === "active" ? "A project holds tasks, milestones and the people working on them." : tab === "completed" ? "Projects you mark complete are kept here." : "Archived projects are hidden from Overview and Pulse but kept intact."}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
