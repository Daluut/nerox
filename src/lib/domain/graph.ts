import type { DomainDependency } from "./types";

/**
 * Task dependencies form a directed graph: predecessor → successor
 * ("successor depends on predecessor"). These helpers are pure so they can be
 * shared by the UI (pre-validation), server actions and the Pulse engine.
 * The database enforces the same no-cycle rule with a trigger.
 */

export type Adjacency = Map<string, string[]>;

export function buildAdjacency(deps: DomainDependency[]): { down: Adjacency; up: Adjacency } {
  const down: Adjacency = new Map();
  const up: Adjacency = new Map();
  for (const { predecessorId: p, successorId: s } of deps) {
    if (!down.has(p)) down.set(p, []);
    if (!up.has(s)) up.set(s, []);
    down.get(p)!.push(s);
    up.get(s)!.push(p);
  }
  return { down, up };
}

function reach(start: string, adj: Adjacency): Set<string> {
  const seen = new Set<string>();
  const stack = [...(adj.get(start) ?? [])];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    for (const m of adj.get(n) ?? []) if (!seen.has(m)) stack.push(m);
  }
  return seen;
}

/** Every task that (transitively) depends on `taskId`. */
export function downstreamOf(taskId: string, deps: DomainDependency[]): Set<string> {
  return reach(taskId, buildAdjacency(deps).down);
}

/** Every task that `taskId` (transitively) depends on. */
export function upstreamOf(taskId: string, deps: DomainDependency[]): Set<string> {
  return reach(taskId, buildAdjacency(deps).up);
}

export type DependencyCheck =
  | { ok: true }
  | { ok: false; reason: "self" | "duplicate" | "cycle"; message: string; path?: string[] };

/**
 * Can "successor depends on predecessor" be added without creating a cycle?
 * A cycle appears exactly when the predecessor is already reachable downstream
 * of the successor. When it is, the offending path is returned for explanation.
 */
export function checkNewDependency(
  predecessorId: string,
  successorId: string,
  deps: DomainDependency[],
): DependencyCheck {
  if (predecessorId === successorId) {
    return { ok: false, reason: "self", message: "A task can't depend on itself." };
  }
  if (deps.some((d) => d.predecessorId === predecessorId && d.successorId === successorId)) {
    return { ok: false, reason: "duplicate", message: "This dependency already exists." };
  }
  const path = findPath(successorId, predecessorId, buildAdjacency(deps).down);
  if (path) {
    return {
      ok: false,
      reason: "cycle",
      message:
        "This would create a circular dependency: the chosen task already depends, directly or indirectly, on this one.",
      path,
    };
  }
  return { ok: true };
}

function findPath(from: string, to: string, adj: Adjacency): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const n = queue.shift()!;
    if (n === to) {
      const path: string[] = [];
      for (let c: string | null = n; c !== null; c = prev.get(c) ?? null) path.unshift(c);
      return path;
    }
    for (const m of adj.get(n) ?? []) {
      if (!prev.has(m)) {
        prev.set(m, n);
        queue.push(m);
      }
    }
  }
  return null;
}

/** Topological order (Kahn). Returns null if the graph contains a cycle. */
export function topologicalOrder(taskIds: string[], deps: DomainDependency[]): string[] | null {
  const indeg = new Map(taskIds.map((id) => [id, 0]));
  const { down } = buildAdjacency(deps);
  for (const d of deps) if (indeg.has(d.successorId)) indeg.set(d.successorId, indeg.get(d.successorId)! + 1);
  const queue = taskIds.filter((id) => indeg.get(id) === 0);
  const out: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    out.push(n);
    for (const m of down.get(n) ?? []) {
      if (!indeg.has(m)) continue;
      indeg.set(m, indeg.get(m)! - 1);
      if (indeg.get(m) === 0) queue.push(m);
    }
  }
  return out.length === taskIds.length ? out : null;
}
