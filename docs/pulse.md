# Nerox Pulse — scoring model (pulse-1.0.0)

Pulse is a deterministic function, `assessProject(input) → Assessment`, in `src/lib/pulse/engine.ts`. Given the same project data, date and configuration it always returns the same result. Every screen (Overview, Projects, project header, Pulse pages) uses this one function via `assess()` in `src/lib/data/queries.ts`, so scores never disagree between screens.

## Inputs

Project (start date, deadline, created time), tasks (status, priority, assignee, start/due dates, estimate, status-change time, completion time, milestone), dependencies, milestones, project members, today's date **in the workspace timezone**, and the workspace's Pulse configuration.

## Progress

If at least 70% of tasks have effort estimates, progress is effort-weighted (tasks without an estimate count as the median estimate). Otherwise it's a task count, and the UI says "by count".

## Factors (each 0–100, 100 = healthy)

| Factor | Default weight | How it's scored | Not measured when |
| --- | --- | --- | --- |
| Completion pace | 20 | Expected progress by today (from task due dates if ≥60% have them, otherwise linear time between start and deadline) minus actual progress. Score = 100 − 200 × shortfall. | No tasks, or no due dates and no start/deadline |
| Overdue work | 20 | Each overdue task subtracts 8 × priority (0.5/1/1.5/2) × (1 + 0.5 × open downstream tasks, max 4) × 1.5 if more than a week late. | No task has a due date |
| Deadline feasibility | 15 | With ≥3 completions and ≥7 days of history: days left ÷ projected days at recent velocity (14-day window). ≥1.15 → 100, ≤0.5 → 0. Without history: −20 per open task scheduled after the deadline. Deadline passed with open work → 0. | No deadline, or no history and no scheduling conflict |
| Dependency risk | 15 | −6 per open task waiting on overdue work (max −60), −10 per successor due before its predecessor, −8 per unstarted task blocking ≥3 open tasks that should have started. **Simplified heuristic, not critical-path analysis.** | No dependencies |
| Workload balance | 10 | Largest share of open work ÷ average across project members. ≤1.5× → 100, ≥3× → 20. **Capacity isn't tracked.** | Fewer than 2 people or fewer than 3 assigned open tasks |
| Stalled tasks | 10 | Share of active tasks that have stopped: In Progress / In Review longer than 3/5/7/10 days (urgent/high/medium/low; longer for large estimates), or To Do more than 3 days past planned start with all predecessors complete. | Nothing active or due to have started |
| Milestone progress | 10 | −35 per overdue milestone, −15 per milestone due within 7 days with less than half its linked work done. | No milestones with dates |

## Combining

`score = Σ factor score × weight / Σ weights of measured factors`.

- Fewer than 3 tasks, or under 40% of total weight measurable → **Insufficient data**, no score.
- Confidence: **high** when ≥85% of weight is measured and no more than 40% of it uses proxies; **medium** at ≥60%; otherwise **low**.
- Bands: 80+ Healthy, 60–79 Needs attention, 40–59 At risk, under 40 Critical.

## Risks

Each risk has an id that is stable for the same underlying condition (so acknowledgements stick), a severity, a **basis**, evidence lines built from the data, a possible consequence, a suggested next step and action links. Kinds: deadline passed, overdue task (rule-based when it blocks work), schedule conflict, bottleneck, stalled task, not started, workload imbalance, unassigned important work, high-priority cluster due by tomorrow, forecast late (**forecast**), tasks scheduled after the deadline, milestone overdue, milestone at risk, and a completion-activity drop (two equal 14-day windows, so weekends appear in both).

Pulse never changes data. Every recommendation is a link for a person to act on.

## Configuration

`resolveConfig()` merges a workspace's stored settings over `DEFAULT_CONFIG`, ignoring invalid values. Admins can change factor weights in Settings. Stored snapshots record `algorithm_version` so history stays traceable if the model changes.

## Tests

`tests/unit/pulse.test.ts` covers a healthy project, the brief's Scenario B (an overdue API task blocking integration and testing), honest handling of missing data, each detection, determinism and configuration.
