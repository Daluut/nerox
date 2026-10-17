import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, Plus } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadWorkspaceBundles } from "@/lib/data/queries";
import { isActiveProject, toHealthRow } from "@/lib/data/views";
import { can } from "@/lib/domain/permissions";
import { ProjectHealthList } from "@/components/projects/project-health-list";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";
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
    <div className="mx-auto max-w-[1100px] px-4 py-8 md:px-10">
      <PageHeader
        title="Projects"
        description="All your team's projects and how healthy each one is."
        icon={<FolderKanban className="size-6" />}
        color="var(--c-projects)"
        action={
          can(ctx.role, "project.create") && (
            <ButtonLink href="/projects/new" variant="primary">
              <Plus className="size-4" /> New project
            </ButtonLink>
          )
        }
      />
      <nav className="mt-8 flex gap-2" aria-label="Project status">
        {(["active", "completed", "archived"] as const).map((t) => (
          <Link
            key={t}
            href={t === "active" ? "/projects" : `/projects?show=${t}`}
            aria-current={tab === t ? "page" : undefined}
            className={cn("inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-semibold capitalize", tab === t ? "bg-violet text-white" : "border border-line bg-panel text-muted hover:text-fg")}
          >
            {t} <span className="num text-[12px] opacity-75">{groups[t].length}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
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
