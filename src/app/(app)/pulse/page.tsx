import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadAcknowledgements, loadWorkspaceBundles, recordSnapshots } from "@/lib/data/queries";
import { isActiveProject } from "@/lib/data/views";
import { SEVERITY_RANK } from "@/lib/pulse/types";
import { HealthStrip } from "@/components/pulse/health";
import { PulseExplainer } from "@/components/pulse/pulse-explainer";
import { RiskCard } from "@/components/pulse/risk-card";
import { HealthBadge } from "@/components/ui/badges";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Pulse" };

export default async function PulsePage() {
  const ctx = await getAppContext();
  const active = (await loadWorkspaceBundles(ctx)).filter(isActiveProject);
  await recordSnapshots(ctx, active);
  const acks = await loadAcknowledgements(ctx, active.map((b) => b.project.id));
  const risks = active
    .flatMap((b) => b.assessment.risks.map((r) => ({ r, b })))
    .filter(({ r, b }) => !acks.has(`${b.project.id}:${r.id}`))
    .sort((x, y) => SEVERITY_RANK[y.r.severity] - SEVERITY_RANK[x.r.severity] || y.r.weight - x.r.weight);
  const sorted = [...active].sort((x, y) => (x.assessment.score ?? 101) - (y.assessment.score ?? 101));

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 md:px-10">
      <PageHeader
        title="Pulse"
        description="A health check for every project, with the reasons behind each warning."
        icon={<Activity className="size-6" />}
        color="var(--c-pulse)"
      />
      <div className="mt-6">
        <PulseExplainer open={!active.some((b) => b.assessment.score !== null)} />
      </div>

      {!active.length ? (
        <EmptyState className="mt-6" icon={<Activity className="size-5" />} title="No active projects to assess" action={<ButtonLink href="/projects/new" variant="primary" size="sm">Create a project</ButtonLink>}>
          Pulse starts working as soon as a project has a few tasks.
        </EmptyState>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <section aria-label="Projects by health" className="flex flex-col gap-2">
            {sorted.map((b) => (
              <Link key={b.project.id} href={`/projects/${b.project.id}/pulse`} className="rounded-2xl border border-line bg-panel p-4 shadow-card hover:border-line-strong">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold">{b.project.name}</span>
                  <HealthBadge status={b.assessment.status} score={b.assessment.score} />
                </div>
                <HealthStrip assessment={b.assessment} height={4} className="mt-2.5" />
                <p className="mt-2 text-[12px] text-faint">
                  {b.assessment.risks.length ? `${b.assessment.risks.length} ${b.assessment.risks.length === 1 ? "risk" : "risks"}` : "No risks"}, {b.assessment.progress.percent}% done
                </p>
              </Link>
            ))}
          </section>
          <section>
            <h2 className="mb-3 text-[17px] font-semibold">
              Open risks across projects <span className="num text-[13px] font-normal text-faint">{risks.length}</span>
            </h2>
            {risks.length ? (
              <div className="flex flex-col gap-2">
                {risks.slice(0, 40).map(({ r, b }) => (
                  <RiskCard key={`${b.project.id}:${r.id}`} risk={r} projectId={b.project.id} projectName={b.project.name} compact />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-line bg-panel px-4 py-4 text-[13px] text-muted">No open risks right now.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
