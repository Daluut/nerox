import type { Priority } from "../domain/types";

/**
 * Nerox Pulse configuration.
 *
 * The weights and thresholds below are product defaults chosen to behave sensibly
 * on the test scenarios in tests/unit/pulse.test.ts. They are not scientifically
 * established. Workspaces can override weights in Settings → Pulse; everything is
 * versioned so stored assessments can be traced back to the model that made them.
 */
export const ALGORITHM_VERSION = "pulse-1.0.0";

export const FACTOR_KEYS = ["pace", "overdue", "feasibility", "dependencies", "workload", "stalled", "milestones"] as const;
export type FactorKey = (typeof FACTOR_KEYS)[number];

export const FACTOR_LABEL: Record<FactorKey, string> = {
  pace: "Completion pace",
  overdue: "Overdue work",
  feasibility: "Deadline feasibility",
  dependencies: "Dependency risk",
  workload: "Workload balance",
  stalled: "Stalled tasks",
  milestones: "Milestone progress",
};

export interface PulseConfig {
  weights: Record<FactorKey, number>;
  /** Lower bounds of each status band. Below `atRisk` is critical. */
  bands: { healthy: number; attention: number; atRisk: number };
  /** Days in In Progress / In Review without a status change before a task counts as stalled. */
  stalledDays: Record<Priority, number>;
  /** Days past a planned start date before an unstarted task is flagged. */
  notStartedGraceDays: number;
  /** Fraction of total weight that must be measurable to publish a score. */
  minWeightCoverage: number;
  /** Fewer tasks than this and Pulse reports insufficient data. */
  minTasks: number;
  /** Look-back window for completion velocity. */
  velocityWindowDays: number;
  /** Completed tasks needed before a velocity-based forecast is made. */
  minCompletionsForForecast: number;
  /** Days a project must have existed before a velocity-based forecast is made. */
  minProjectAgeForForecast: number;
}

export const DEFAULT_CONFIG: PulseConfig = {
  weights: { pace: 20, overdue: 20, feasibility: 15, dependencies: 15, workload: 10, stalled: 10, milestones: 10 },
  bands: { healthy: 80, attention: 60, atRisk: 40 },
  stalledDays: { urgent: 3, high: 5, medium: 7, low: 10 },
  notStartedGraceDays: 3,
  minWeightCoverage: 0.4,
  minTasks: 3,
  velocityWindowDays: 14,
  minCompletionsForForecast: 3,
  minProjectAgeForForecast: 7,
};

const num = (v: unknown, fallback: number, min = 0, max = Infinity) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : fallback;

/** Merges a stored (untrusted) partial config over the defaults, ignoring invalid values. */
export function resolveConfig(partial?: unknown): PulseConfig {
  const p = (partial && typeof partial === "object" ? partial : {}) as Record<string, unknown>;
  const w = (p.weights && typeof p.weights === "object" ? p.weights : {}) as Record<string, unknown>;
  const weights = Object.fromEntries(
    FACTOR_KEYS.map((k) => [k, num(w[k], DEFAULT_CONFIG.weights[k], 0, 100)]),
  ) as Record<FactorKey, number>;
  if (Object.values(weights).every((v) => v === 0)) Object.assign(weights, DEFAULT_CONFIG.weights);

  const b = (p.bands && typeof p.bands === "object" ? p.bands : {}) as Record<string, unknown>;
  let bands = {
    healthy: num(b.healthy, DEFAULT_CONFIG.bands.healthy, 1, 100),
    attention: num(b.attention, DEFAULT_CONFIG.bands.attention, 1, 100),
    atRisk: num(b.atRisk, DEFAULT_CONFIG.bands.atRisk, 1, 100),
  };
  if (!(bands.healthy > bands.attention && bands.attention > bands.atRisk)) bands = { ...DEFAULT_CONFIG.bands };

  const s = (p.stalledDays && typeof p.stalledDays === "object" ? p.stalledDays : {}) as Record<string, unknown>;
  return {
    ...DEFAULT_CONFIG,
    weights,
    bands,
    stalledDays: {
      urgent: num(s.urgent, DEFAULT_CONFIG.stalledDays.urgent, 1, 90),
      high: num(s.high, DEFAULT_CONFIG.stalledDays.high, 1, 90),
      medium: num(s.medium, DEFAULT_CONFIG.stalledDays.medium, 1, 90),
      low: num(s.low, DEFAULT_CONFIG.stalledDays.low, 1, 90),
    },
  };
}
