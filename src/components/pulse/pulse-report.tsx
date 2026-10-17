import type { Snapshot } from "@/lib/data/types";
import { formatDate } from "@/lib/domain/dates";
import type { Assessment } from "@/lib/pulse/types";
import { FACTOR_LABEL } from "@/lib/pulse/config";
import { Panel } from "@/components/ui/primitives";
import { FactorRow, HealthStrip, ScoreBlock } from "./health";
import { RiskCard } from "./risk-card";
import { HealthTrend } from "./trend";

/** The full Pulse analysis for one project. Everything shown is derived from `assessment` and stored snapshots. */
export function PulseReport({
  projectId,
  assessment: a,
  snapshots,
  acks,
  today,
}: {
  projectId: string;
  assessment: Assessment;
  snapshots: Snapshot[];
  acks: Map<string, { userId: string; at: string }>;
  today: string;
}) {
  const previous = [...snapshots].reverse().find((s) => s.snapshotDate < today && s.score !== null);
  const delta = previous && a.score !== null ? a.score - previous.score! : null;
  const open = a.risks.filter((r) => !acks.has(`${projectId}:${r.id}`));
  const acknowledged = a.risks.filter((r) => acks.has(`${projectId}:${r.id}`));
  const f = a.forecast;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <section className="rounded-lg border border-line bg-panel p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <ScoreBlock assessment={a} />
            <div className="text-right text-[12px] text-faint">
              {delta !== null && (
                <p className={delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted"}>
                  {delta > 0 ? "+" : ""}
                  {delta} since {formatDate(previous!.snapshotDate, today)}
                </p>
              )}
              <p>Live assessment, recalculated on every page load</p>
              <p>Model {a.algorithmVersion}</p>
            </div>
          </div>
          <HealthStrip assessment={a} height={10} className="mt-5" />
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-faint">
            {a.factors.map((x) => (
              <li key={x.key}>
                {FACTOR_LABEL[x.key]} {x.available ? <span className="num text-muted">{x.score}</span> : "not measured"}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-[15px] font-semibold">
            Risks <span className="num text-[13px] font-normal text-faint">{open.length}</span>
          </h2>
          {open.length ? (
            <div className="flex flex-col gap-2">
              {open.map((r) => (
                <RiskCard key={r.id} risk={r} projectId={projectId} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-line bg-panel px-4 py-4 text-[13px] text-muted">
              {a.status === "insufficient_data" ? "Not enough data to detect risks yet. See what's missing on the right." : "No open risks detected in the current data."}
            </p>
          )}
          {acknowledged.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer text-[13px] text-muted hover:text-fg">Acknowledged ({acknowledged.length}), still counted until resolved</summary>
              <div className="mt-2 flex flex-col gap-2">
                {acknowledged.map((r) => (
                  <RiskCard key={r.id} risk={r} projectId={projectId} acknowledged={acks.get(`${projectId}:${r.id}`)} compact />
                ))}
              </div>
            </details>
          )}
        </section>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Panel title="Contributing factors" bodyClassName="px-4 py-1">
          <ul className="divide-y divide-line">
            {a.factors.map((x) => (
              <FactorRow key={x.key} factor={x} />
            ))}
          </ul>
        </Panel>

        <Panel title="Finish forecast">
          {f.basis === "velocity" && f.projectedFinish ? (
            <div className="text-[13px]">
              <p>
                Projected finish <span className="font-medium">{formatDate(f.projectedFinish, today)}</span>
                {f.deadline && (
                  <span className={f.daysLate! > 0 ? "text-danger" : "text-success"}>
                    {" "}
                    ({f.daysLate! > 0 ? `${f.daysLate} days after` : f.daysLate === 0 ? "on" : `${-f.daysLate!} days before`} the deadline)
                  </span>
                )}
              </p>
              <p className="mt-2 text-[12px] text-muted">{f.note}</p>
              <p className="mt-2 text-[11px] text-cyan">Forecast: a straight-line extrapolation, not a promise.</p>
            </div>
          ) : (
            <p className="text-[13px] text-muted">{f.note}</p>
          )}
        </Panel>

        <Panel title="Health over time">
          <HealthTrend snapshots={snapshots} today={today} />
        </Panel>

        {a.limitations.length > 0 && (
          <Panel title="What Pulse can't see">
            <ul className="list-disc space-y-1.5 pl-4 text-[12px] text-muted marker:text-faint">
              {a.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Panel>
        )}

        <details className="rounded-lg border border-line bg-panel px-4 py-3 text-[12px] text-muted">
          <summary className="cursor-pointer text-[13px] font-medium text-fg">How the score is calculated</summary>
          <div className="mt-2 space-y-2">
            <p>Each factor is scored 0–100, where 100 is healthy. The health score is their weighted average. Factors that can&apos;t be measured are left out and the remaining weights are scaled up; the confidence level reflects how much was left out.</p>
            <p>Bands: 80+ healthy, 60–79 needs attention, 40–59 at risk, below 40 critical. Weights are product defaults, adjustable by admins in Settings.</p>
            <p>Every risk is labelled as observed (a fact), rule-based (a deterministic check) or a forecast (an extrapolation). No AI is used to produce the score.</p>
          </div>
        </details>
      </div>
    </div>
  );
}
