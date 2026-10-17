import type { Progress } from "../domain/progress";
import type {
  DateOnly,
  DomainDependency,
  DomainMember,
  DomainMilestone,
  DomainProject,
  DomainTask,
} from "../domain/types";
import type { FactorKey, PulseConfig } from "./config";

export type HealthStatus = "healthy" | "attention" | "at_risk" | "critical" | "insufficient_data";

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  at_risk: "At risk",
  critical: "Critical",
  insufficient_data: "Insufficient data",
};

/**
 * How a statement was produced. Pulse never mixes these up in the UI:
 *  - observed: a fact read directly from project data ("2 days overdue")
 *  - rule: a deterministic detection over that data ("blocks 3 open tasks")
 *  - forecast: an extrapolation that may not come true ("projected to finish late")
 * (AI-generated interpretations are a separate, later layer and are labelled as such.)
 */
export type Basis = "observed" | "rule" | "forecast";

export type Severity = "critical" | "high" | "medium" | "low";
export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export type FactorQuality = "measured" | "proxy" | "insufficient";

export interface FactorResult {
  key: FactorKey;
  label: string;
  weight: number; // configured weight
  effectiveWeight: number; // share of the published score (0–1); 0 when unavailable
  score: number | null; // 0–100, 100 = healthy
  available: boolean;
  quality: FactorQuality;
  summary: string;
  details: string[];
}

export type RiskActionKind =
  | "open_task"
  | "assign"
  | "reschedule"
  | "add_estimate"
  | "review_dependencies"
  | "open_milestones"
  | "open_list";

export interface RiskAction {
  kind: RiskActionKind;
  label: string;
  taskId?: string;
}

export type RiskKind =
  | "deadline_passed"
  | "overdue_task"
  | "schedule_conflict"
  | "bottleneck"
  | "stalled_task"
  | "not_started"
  | "workload_imbalance"
  | "unassigned_work"
  | "due_soon_cluster"
  | "forecast_late"
  | "scheduled_after_deadline"
  | "milestone_overdue"
  | "milestone_at_risk"
  | "activity_drop";

export interface Risk {
  id: string; // stable for the same underlying condition
  kind: RiskKind;
  severity: Severity;
  basis: Basis;
  title: string;
  evidence: string[];
  consequence: string | null;
  recommendation: string;
  actions: RiskAction[];
  taskIds: string[];
  milestoneIds: string[];
  weight: number; // tie-breaker within a severity band
}

export interface WorkloadEntry {
  userId: string;
  name: string;
  openTasks: number;
  openEffort: number; // hours, or task count when estimates are sparse
  overdue: number;
  dueSoon: number; // due within 7 days
  share: number; // 0–1 of open assigned work
}

export interface Forecast {
  basis: "velocity" | "deadline_passed" | "complete" | "none";
  unit: "hours" | "tasks";
  velocityPerDay: number | null;
  remaining: number;
  projectedFinish: DateOnly | null;
  deadline: DateOnly | null;
  daysLate: number | null; // positive = projected after the deadline
  note: string;
}

export interface PulseInput {
  project: DomainProject;
  tasks: DomainTask[];
  dependencies: DomainDependency[];
  milestones: DomainMilestone[];
  members: DomainMember[];
  today: DateOnly;
  timeZone: string;
  now: Date;
  config?: PulseConfig;
}

export interface Assessment {
  projectId: string;
  score: number | null;
  status: HealthStatus;
  confidence: "high" | "medium" | "low" | "none";
  weightCoverage: number;
  factors: FactorResult[];
  risks: Risk[];
  limitations: string[];
  progress: Progress;
  forecast: Forecast;
  workload: WorkloadEntry[];
  counts: { total: number; open: number; done: number; overdue: number; blocked: number; stalled: number; unassigned: number };
  today: DateOnly;
  assessedAt: string;
  algorithmVersion: string;
}
