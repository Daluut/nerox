import { getAppContext } from "@/lib/data/context";
import { loadProjectBundle, recordSnapshots } from "@/lib/data/queries";
import { formatDate, daysBetween } from "@/lib/domain/dates";
import { can, canDeleteProject } from "@/lib/domain/permissions";
import { FolderKanban } from "lucide-react";
import { HEALTH_COLOR } from "@/components/ui/badges";
import { HEALTH_LABEL } from "@/lib/pulse/types";
import { Avatar, IconBadge } from "@/components/ui/primitives";
import { ProjectActions } from "@/components/projects/project-actions";
import { ProjectTabs } from "@/components/projects/project-tabs";
import { cn } from "@/components/ui/cn";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  const b = await loadProjectBundle(ctx, projectId);
  await recordSnapshots(ctx, [b]);
  const p = b.project;
  const a = b.assessment;
  const daysLeft = p.deadline ? daysBetween(ctx.today, p.deadline) : null;
  const members = b.memberIds.map((id) => ctx.members.find((m) => m.userId === id)).filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-8 md:px-10">
      {p.archivedAt && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-[14px]">
          This project is archived, so it&apos;s hidden from Overview and Pulse. Restore it from the project menu to resume work.
        </p>
      )}
      <header className="rounded-2xl border border-line bg-panel p-6 shadow-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <IconBadge color="var(--c-projects)" size={48}>
              <FolderKanban className="size-6" />
            </IconBadge>
            <div className="min-w-0">
              <h1 className="truncate text-[26px] font-bold tracking-tight">{p.name}</h1>
              {p.description && <p className="mt-0.5 line-clamp-1 max-w-2xl text-[15px] text-muted">{p.description}</p>}
            </div>
          </div>
          <ProjectActions
            project={{ id: p.id, name: p.name, description: p.description, startDate: p.startDate, deadline: p.deadline, ownerId: p.ownerId, status: p.status, archived: !!p.archivedAt }}
            memberIds={b.memberIds}
            canEdit={can(ctx.role, "project.edit")}
            canDelete={canDeleteProject(ctx.role, ctx.userId, p.ownerId)}
          />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl p-4" style={{ background: `color-mix(in srgb, ${HEALTH_COLOR[a.status]} 12%, transparent)` }}>
            <dt className="text-[13px] font-medium text-muted">Health</dt>
            <dd className="mt-1 flex items-baseline gap-2" style={{ color: HEALTH_COLOR[a.status] }}>
              <span className="num text-[26px] font-bold leading-none">{a.score ?? "–"}</span>
              <span className="text-[14px] font-semibold">{HEALTH_LABEL[a.status]}</span>
            </dd>
          </div>
          <div className="rounded-xl bg-raised p-4">
            <dt className="text-[13px] font-medium text-muted">Progress</dt>
            <dd className="mt-1">
              <span className="num text-[26px] font-bold leading-none">{a.progress.percent}%</span>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-hover">
                <span className="block h-full rounded-full bg-c-projects" style={{ width: `${a.progress.percent}%` }} />
              </span>
            </dd>
          </div>
          <div className="rounded-xl bg-raised p-4">
            <dt className="text-[13px] font-medium text-muted">Deadline</dt>
            <dd className={cn("mt-1 text-[18px] font-bold", daysLeft !== null && daysLeft < 0 && p.status !== "completed" && "text-danger")}>
              {p.deadline ? formatDate(p.deadline, ctx.today) : "Not set"}
              {daysLeft !== null && p.status !== "completed" && (
                <span className="block text-[13px] font-medium text-muted">{daysLeft < 0 ? `${-daysLeft} days ago` : daysLeft === 0 ? "Today" : `${daysLeft} days left`}</span>
              )}
            </dd>
          </div>
          <div className="rounded-xl bg-raised p-4">
            <dt className="text-[13px] font-medium text-muted">Team</dt>
            <dd className="mt-2 flex -space-x-2">
              {members.slice(0, 6).map((m) => (
                <Avatar key={m.userId} name={m.name} size={30} className="ring-2 ring-panel" />
              ))}
              {members.length > 6 && <span className="ml-4 text-[13px] text-muted">+{members.length - 6}</span>}
              {!members.length && <span className="text-[14px] text-muted">No members yet</span>}
            </dd>
          </div>
        </dl>
        {p.status !== "active" && (
          <p className={cn("mt-4 text-[14px] font-medium", p.status === "completed" ? "text-success" : "text-warning")}>
            {p.status === "completed" ? "This project is marked as completed." : "This project is on hold."}
          </p>
        )}
      </header>
      <ProjectTabs projectId={p.id} riskCount={a.risks.length} />
      <div className="py-6">{children}</div>
    </div>
  );
}
