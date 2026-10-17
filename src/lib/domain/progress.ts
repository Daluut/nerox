import type { DomainTask } from "./types";

/**
 * Project progress.
 *
 * If at least `ESTIMATE_COVERAGE` of tasks carry an effort estimate, progress is
 * effort-weighted (tasks without an estimate count as the median estimate).
 * Otherwise it falls back to task counts and says so — counting ten small tasks
 * the same as one large deliverable is a known imprecision.
 */
export const ESTIMATE_COVERAGE = 0.7;

export interface Progress {
  percent: number; // 0–100, rounded
  ratio: number; // 0–1
  method: "effort" | "count";
  completed: number; // effort hours or task count
  total: number;
  estimateCoverage: number; // 0–1
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Returns a function giving each task's weight under the chosen method. */
export function effortWeights(tasks: DomainTask[]): {
  method: "effort" | "count";
  weight: (t: DomainTask) => number;
  coverage: number;
} {
  const estimates = tasks.map((t) => t.estimateHours).filter((e): e is number => e != null && e > 0);
  const coverage = tasks.length ? estimates.length / tasks.length : 0;
  if (tasks.length > 0 && coverage >= ESTIMATE_COVERAGE) {
    const fallback = median(estimates);
    return { method: "effort", coverage, weight: (t) => (t.estimateHours && t.estimateHours > 0 ? t.estimateHours : fallback) };
  }
  return { method: "count", coverage, weight: () => 1 };
}

export function computeProgress(tasks: DomainTask[]): Progress {
  const { method, weight, coverage } = effortWeights(tasks);
  let total = 0;
  let completed = 0;
  for (const t of tasks) {
    const w = weight(t);
    total += w;
    if (t.status === "done") completed += w;
  }
  const ratio = total > 0 ? completed / total : 0;
  return {
    percent: Math.round(ratio * 100),
    ratio,
    method,
    completed: Math.round(completed * 10) / 10,
    total: Math.round(total * 10) / 10,
    estimateCoverage: coverage,
  };
}
