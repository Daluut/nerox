import type { Assessment, FactorResult } from "@/lib/pulse/types";
import { HEALTH_LABEL } from "@/lib/pulse/types";
import { HEALTH_COLOR } from "@/components/ui/badges";
import { cn } from "@/components/ui/cn";

export const scoreColor = (s: number | null) =>
  s === null ? "var(--faint)" : s >= 80 ? "var(--success)" : s >= 60 ? "var(--warning)" : s >= 40 ? "#ec8a3c" : "var(--danger)";

/**
 * The Pulse strip: the health score's composition at a glance. Each segment is a
 * factor, as wide as its share of the score and coloured by how healthy it is.
 * Factors that couldn't be measured are shown as a hatched gap rather than hidden.
 */
export function HealthStrip({ assessment, height = 6, className }: { assessment: Assessment; height?: number; className?: string }) {
  const total = assessment.factors.reduce((s, f) => s + f.weight, 0) || 1;
  const measured = assessment.factors.filter((f) => f.available);
  const missing = assessment.factors.filter((f) => !f.available).reduce((s, f) => s + f.weight, 0);
  const label =
    assessment.score === null
      ? "Health not scored: not enough data"
      : `Health ${assessment.score}: ` + measured.map((f) => `${f.label} ${f.score}`).join(", ");
  return (
    <div role="img" aria-label={label} className={cn("flex w-full gap-[2px] overflow-hidden rounded-full", className)} style={{ height }}>
      {measured.map((f) => (
        <span key={f.key} title={`${f.label}: ${f.score}/100`} style={{ flexGrow: f.weight / total, background: scoreColor(f.score) }} className="min-w-[3px]" />
      ))}
      {missing > 0 && (
        <span
          title="Not measured"
          style={{
            flexGrow: missing / total,
            background: "repeating-linear-gradient(135deg, var(--border-strong) 0 2px, transparent 2px 5px)",
          }}
        />
      )}
    </div>
  );
}

export function ScoreBlock({ assessment, size = "lg" }: { assessment: Assessment; size?: "lg" | "md" }) {
  const big = size === "lg";
  return (
    <div className="flex items-end gap-3">
      <span className={cn("num font-semibold leading-none", big ? "text-[44px]" : "text-[28px]")} style={{ color: HEALTH_COLOR[assessment.status] }}>
        {assessment.score ?? "—"}
      </span>
      <span className="pb-1">
        <span className="block text-[14px] font-medium" style={{ color: HEALTH_COLOR[assessment.status] }}>
          {HEALTH_LABEL[assessment.status]}
        </span>
        <span className="block text-[12px] text-faint">
          {assessment.confidence === "none" ? "Not enough data to score" : `${assessment.confidence[0].toUpperCase()}${assessment.confidence.slice(1)} confidence, ${Math.round(assessment.weightCoverage * 100)}% of factors measured`}
        </span>
      </span>
    </div>
  );
}

export function FactorRow({ factor }: { factor: FactorResult }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-medium">{factor.label}</span>
        {factor.available && factor.quality === "proxy" && (
          <span className="text-[11px] text-faint" title="Measured with a simplified proxy; see details.">
            estimate
          </span>
        )}
      </div>
      <span className="num text-[13px]" style={{ color: scoreColor(factor.score) }}>
        {factor.available ? factor.score : "Not measured"}
      </span>
      <div className="col-span-2 h-1 overflow-hidden rounded-full bg-hover">
        {factor.available && <div className="h-full rounded-full" style={{ width: `${factor.score}%`, background: scoreColor(factor.score) }} />}
      </div>
      <p className="col-span-2 text-[12px] text-muted">{factor.summary}</p>
      {factor.details.length > 0 && (
        <p className="col-span-2 text-[11px] text-faint">
          {factor.details.join(" ")} Weight {factor.weight}
          {factor.available ? `, ${Math.round(factor.effectiveWeight * 100)}% of this score.` : "."}
        </p>
      )}
    </li>
  );
}
