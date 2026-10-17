import { getAppContext } from "@/lib/data/context";
import { loadProjectBundle, recordSnapshots } from "@/lib/data/queries";
import { formatDate, daysBetween } from "@/lib/domain/dates";
import { can, canDeleteProject } from "@/lib/domain/permissions";
import { HealthBadge } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/primitives";
import { HealthStrip } from "@/components/pulse/health";
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
    <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-8">
      {p.archivedAt && (
        <p className="mb-4 rounded-md border border-line-strong bg-raised px-3 py-2 text-[13px] text-muted">
          This project is archived, so it&apos;s hidden from Overview and Pulse. Restore it from the project menu to resume work.
        </p>
      )}
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-[22px] font-semibold">{p.name}</h1>
            {p.description && <p className="mt-1 line-clamp-2 max-w-2xl text-muted">{p.description}</p>}
          </div>
          <ProjectActions
            project={{ id: p.id, name: p.name, description: p.description, startDate: p.startDate, deadline: p.deadline, ownerId: p.ownerId, status: p.status, archived: !!p.archivedAt }}
            memberIds={b.memberIds}
            canEdit={can(ctx.role, "project.edit")}
            canDelete={canDeleteProject(ctx.role, ctx.userId, p.ownerId)}
          />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px] sm:flex sm:flex-wrap sm:items-center">
          <div className="min-w-[180px]">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <HealthBadge status={a.status} score={a.score} />
            </div>
            <HealthStrip assessment={a} height={5} className="max-w-[200px]" />
          </div>
          <div>
            <p className="text-[12px] text-faint">Progress</p>
            <p className="num">
              {a.progress.percent}%<span className="ml-1.5 font-sans text-[12px] text-faint">{a.progress.method === "effort" ? "of estimated effort" : `${a.counts.done} of ${a.counts.total} tasks`}</span>
            </p>
          </div>
          <div>
            <p className="text-[12px] text-faint">Deadline</p>
            <p className={cn(daysLeft !== null && daysLeft < 0 && p.status !== "completed" && "text-danger")}>
              {p.deadline ? formatDate(p.deadline, ctx.today) : "Not set"}
              {daysLeft !== null && p.status !== "completed" && <span className="ml-1.5 text-[12px] text-faint">{daysLeft < 0 ? `${-daysLeft} days ago` : daysLeft === 0 ? "today" : `${daysLeft} days left`}</span>}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-faint">Team</p>
            <div className="mt-0.5 flex -space-x-1.5">
              {members.slice(0, 6).map((m) => (
                <Avatar key={m.userId} name={m.name} size={22} className="ring-2 ring-bg" />
              ))}
              {members.length > 6 && <span className="ml-3 text-[12px] text-faint">+{members.length - 6}</span>}
              {!members.length && <span className="text-muted">No members</span>}
            </div>
          </div>
          {p.status !== "active" && (
            <div>
              <p className="text-[12px] text-faint">Status</p>
              <p className={p.status === "completed" ? "text-success" : "text-warning"}>{p.status === "completed" ? "Completed" : "On hold"}</p>
            </div>
          )}
        </div>
      </header>
      <ProjectTabs projectId={p.id} riskCount={a.risks.length} />
      <div className="py-6">{children}</div>
    </div>
  );
}
