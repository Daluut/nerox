import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type TaskStatus } from "@/lib/domain/types";
import { HEALTH_LABEL, type Basis, type HealthStatus, type Severity } from "@/lib/pulse/types";
import { cn } from "./cn";

export const HEALTH_COLOR: Record<HealthStatus, string> = {
  healthy: "var(--success)",
  attention: "var(--warning)",
  at_risk: "#ec8a3c",
  critical: "var(--danger)",
  insufficient_data: "var(--faint)",
};

export function HealthBadge({ status, score, className }: { status: HealthStatus; score?: number | null; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap", className)} style={{ color: HEALTH_COLOR[status] }}>
      <span className="size-1.5 rounded-full" style={{ background: HEALTH_COLOR[status] }} aria-hidden />
      {score != null && <span className="num font-semibold">{score}</span>}
      <span className={score != null ? "text-muted" : undefined}>{HEALTH_LABEL[status]}</span>
    </span>
  );
}

const STATUS_DOT: Record<TaskStatus, string> = {
  backlog: "border-faint border-dashed",
  todo: "border-muted",
  in_progress: "border-cyan bg-[conic-gradient(var(--cyan)_0_50%,transparent_50%)]",
  in_review: "border-violet bg-[conic-gradient(var(--violet)_0_75%,transparent_75%)]",
  done: "border-success bg-success",
};

export function StatusIcon({ status, className }: { status: TaskStatus; className?: string }) {
  return <span aria-hidden className={cn("inline-block size-3 shrink-0 rounded-full border-[1.5px]", STATUS_DOT[status], className)} />;
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap text-muted">
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_BARS: Record<Priority, number> = { low: 1, medium: 2, high: 3, urgent: 4 };

export function PriorityIcon({ priority, withLabel }: { priority: Priority; withLabel?: boolean }) {
  const n = PRIORITY_BARS[priority];
  const color = priority === "urgent" ? "var(--danger)" : priority === "high" ? "var(--warning)" : "var(--muted)";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" title={`${PRIORITY_LABEL[priority]} priority`}>
      <span className="inline-flex h-3 items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="w-[3px] rounded-[1px]" style={{ height: 3 + i * 2, background: i <= n ? color : "var(--border-strong)" }} />
        ))}
      </span>
      {withLabel ? PRIORITY_LABEL[priority] : <span className="sr-only">{PRIORITY_LABEL[priority]} priority</span>}
    </span>
  );
}

const SEVERITY_STYLE: Record<Severity, string> = {
  critical: "bg-danger-soft text-danger",
  high: "bg-[rgb(236_138_60/0.13)] text-[#ec8a3c]",
  medium: "bg-warning-soft text-warning",
  low: "bg-hover text-muted",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium capitalize", SEVERITY_STYLE[severity])}>{severity}</span>;
}

const BASIS_TEXT: Record<Basis, { label: string; title: string }> = {
  observed: { label: "Observed", title: "A fact read directly from project data." },
  rule: { label: "Rule-based", title: "A deterministic detection over project data." },
  forecast: { label: "Forecast", title: "An extrapolation from recent pace. It may not come true." },
};

export function BasisTag({ basis }: { basis: Basis }) {
  return (
    <span title={BASIS_TEXT[basis].title} className={cn("rounded border px-1.5 py-0.5 text-[11px]", basis === "forecast" ? "border-cyan/40 text-cyan" : "border-line-strong text-muted")}>
      {BASIS_TEXT[basis].label}
    </span>
  );
}
