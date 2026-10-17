"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Flag, Plus, Save, Trash2, TriangleAlert, UserRound, X } from "lucide-react";
import { applyScenario, deleteScenario, runScenario, saveScenario } from "@/lib/actions/whatif";
import { addDays, formatDate } from "@/lib/domain/dates";
import type { Change, SimResult } from "@/lib/whatif/engine";
import { describeChange } from "@/lib/whatif/engine";
import { HEALTH_LABEL } from "@/lib/pulse/types";
import { useAppData } from "@/components/shell/app-context";
import { HEALTH_COLOR } from "@/components/ui/badges";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button, ErrorNote, Field, Panel } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/components/ui/time";
import { cn } from "@/components/ui/cn";

type Kind = Change["kind"];
const KINDS: { kind: Kind; label: string; help: string }[] = [
  { kind: "delay", label: "A task runs late", help: "It finishes some days after it's due." },
  { kind: "duration", label: "A task takes longer", help: "The work turns out bigger than planned." },
  { kind: "unavailable", label: "Someone is away", help: "Holiday, illness or exams. Their work pauses." },
  { kind: "reassign", label: "Move a task to someone else", help: "Hand work over to balance the load." },
  { kind: "deadline", label: "The deadline changes", help: "Moved earlier or later." },
  { kind: "finish_early", label: "A task finishes early", help: "See how much breathing room it gives." },
];

interface SavedScenario {
  id: string;
  name: string;
  changes: Change[];
  labels: string[];
  summary: string;
  stale: boolean;
  appliedAt: string | null;
  createdAt: string;
  creator: string;
}

export function WhatIfLab({
  projectId,
  projectName,
  deadline,
  canEdit,
  tasks,
  people,
  saved,
  initialDelayTaskId,
}: {
  projectId: string;
  projectName: string;
  deadline: string | null;
  canEdit: boolean;
  tasks: { id: string; title: string; dueDate: string | null; assigneeId: string | null }[];
  people: { userId: string; name: string }[];
  saved: SavedScenario[];
  initialDelayTaskId?: string;
}) {
  const data = useAppData();
  const toast = useToast();
  const scheduled = tasks.filter((t) => t.dueDate);
  const [changes, setChanges] = useState<Change[]>(initialDelayTaskId ? [{ kind: "delay", taskId: initialDelayTaskId, days: 3 }] : []);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [result, setResult] = useState<(SimResult & { fingerprint: string }) | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [saveName, setSaveName] = useState("");

  // Draft for the "add a change" form
  const [kind, setKind] = useState<Kind>("delay");
  const [taskId, setTaskId] = useState(scheduled[0]?.id ?? "");
  const [days, setDays] = useState(3);
  const [factor, setFactor] = useState(2);
  const [personId, setPersonId] = useState(people[0]?.userId ?? "");
  const [from, setFrom] = useState(data.today);
  const [handover, setHandover] = useState(1);
  const [newDeadline, setNewDeadline] = useState(deadline ?? addDays(data.today, 28));

  const title = useCallback((id: string) => tasks.find((t) => t.id === id)?.title ?? "a task", [tasks]);
  const name = useCallback((id: string | null) => (id ? (people.find((p) => p.userId === id)?.name ?? "someone") : "nobody"), [people]);

  const run = useCallback(
    async (cs: Change[]) => {
      if (!cs.length) {
        setResult(null);
        return;
      }
      setRunning(true);
      setError(null);
      const r = await runScenario(projectId, cs).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Try again." }));
      setRunning(false);
      if (!r.ok) {
        setError(r.error);
        setResult(null);
      } else setResult(r.data);
    },
    [projectId],
  );

  useEffect(() => {
    run(changes);
  }, [changes, run]);

  function addChange() {
    let c: Change;
    switch (kind) {
      case "delay":
      case "finish_early":
        c = { kind, taskId, days };
        break;
      case "duration":
        c = { kind, taskId, factor };
        break;
      case "reassign":
        c = { kind, taskId: taskId || tasks[0]?.id, toUserId: personId || null, handoverDays: handover };
        break;
      case "unavailable":
        c = { kind, userId: personId, from, days };
        break;
      case "deadline":
        c = { kind, date: newDeadline || null };
        break;
    }
    setScenarioId(null);
    setChanges((cs) => [...cs.filter((x) => !(x.kind === "deadline" && c.kind === "deadline")), c]);
  }

  const taskChoices = kind === "reassign" ? tasks : scheduled;
  const needsTask = kind !== "unavailable" && kind !== "deadline";
  const r = result;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Panel title="Your scenario" icon={<CalendarClock className="size-4" />} accent="var(--c-whatif)">
          <p className="-mt-1 mb-4 text-[14px] text-muted">For {projectName}. Add one or more changes; results update straight away.</p>
          {changes.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {changes.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-xl bg-violet-soft px-3 py-2.5 text-[14px]">
                  <span className="flex-1">{describeChange(c, title, name)}</span>
                  <button aria-label="Remove this change" onClick={() => setChanges((cs) => cs.filter((_, j) => j !== i))} className="rounded p-0.5 text-faint hover:text-fg">
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <Field label="What if…" htmlFor="wi-kind">
              <select id="wi-kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <p className="-mt-1 text-[13px] text-muted">{KINDS.find((k) => k.kind === kind)!.help}</p>

            {needsTask &&
              (taskChoices.length ? (
                <Field label="Which task" htmlFor="wi-task">
                  <select id="wi-task" className="field" value={taskChoices.some((t) => t.id === taskId) ? taskId : ""} onChange={(e) => setTaskId(e.target.value)}>
                    <option value="" disabled>
                      Choose a task
                    </option>
                    {taskChoices.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                        {t.dueDate ? ` (due ${formatDate(t.dueDate, data.today)})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <p className="text-[13px] text-warning">No open tasks have due dates yet. Add due dates so What If? can work out timings.</p>
              ))}

            {(kind === "delay" || kind === "finish_early" || kind === "unavailable") && (
              <Field label={kind === "unavailable" ? "For how many days" : "By how many days"} htmlFor="wi-days">
                <input id="wi-days" type="number" min={1} max={365} className="field" value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
              </Field>
            )}
            {kind === "duration" && (
              <Field label="How much longer" htmlFor="wi-factor">
                <select id="wi-factor" className="field" value={factor} onChange={(e) => setFactor(Number(e.target.value))}>
                  <option value={1.25}>A quarter longer</option>
                  <option value={1.5}>Half as long again</option>
                  <option value={2}>Twice as long</option>
                  <option value={3}>Three times as long</option>
                </select>
              </Field>
            )}
            {(kind === "unavailable" || kind === "reassign") && (
              <Field label={kind === "unavailable" ? "Who is away" : "Give it to"} htmlFor="wi-person">
                <select id="wi-person" className="field" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                  {people.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind === "unavailable" && (
              <Field label="Starting" htmlFor="wi-from">
                <input id="wi-from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
            )}
            {kind === "reassign" && (
              <Field label="Handover time" htmlFor="wi-handover" hint="Days the new person needs to get up to speed.">
                <select id="wi-handover" className="field" value={handover} onChange={(e) => setHandover(Number(e.target.value))}>
                  <option value={0}>None</option>
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={5}>A week</option>
                </select>
              </Field>
            )}
            {kind === "deadline" && (
              <Field label="New deadline" htmlFor="wi-deadline" hint={deadline ? `Currently ${formatDate(deadline, data.today)}.` : "There's no deadline at the moment."}>
                <input id="wi-deadline" type="date" className="field" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              </Field>
            )}
            <Button variant="primary" onClick={addChange} disabled={needsTask && !taskChoices.some((t) => t.id === taskId)}>
              <Plus className="size-4" /> Add this change
            </Button>
          </div>
        </Panel>

        <Panel title="Saved scenarios" icon={<Save className="size-4" />} accent="var(--c-whatif)">
          {saved.length ? (
            <ul className="flex flex-col gap-2">
              {saved.map((s) => (
                <li key={s.id} className="group rounded-xl border border-line p-3">
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setScenarioId(s.id);
                      setChanges(s.changes);
                      setSaveName(s.name);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex-1 text-[15px] font-semibold">{s.name}</span>
                      {s.appliedAt ? (
                        <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">Applied</span>
                      ) : s.stale ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning" title="The project has changed since this was saved. Open it to re-run.">
                          Out of date
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[13px] text-muted">{s.labels.join("; ")}</span>
                    <span className="mt-1 block text-[12px] text-faint">
                      {s.creator}, {timeAgo(s.createdAt)}
                    </span>
                  </button>
                  {canEdit && (
                    <button
                      onClick={async () => {
                        const res = await deleteScenario(s.id);
                        if (!res.ok) toast.error(res.error);
                        else toast.success("Scenario deleted.");
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[12px] text-faint hover:text-danger"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Save a scenario to come back to it or share it with your team. Saved scenarios are re-run on today&apos;s data when you open them.</p>
          )}
        </Panel>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        {error && <ErrorNote>{error}</ErrorNote>}
        {!changes.length ? (
          <div className="rounded-2xl border border-dashed border-line-strong p-10 text-center">
            <p className="text-[18px] font-semibold">Add a change to see what would happen</p>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">Start with something you&apos;re worried about. For example: what if the most important task runs three days late?</p>
          </div>
        ) : r && r.valid ? (
          <>
            <section className={cn("rounded-2xl border p-6 shadow-card", running ? "opacity-60" : "", r.scenarioDaysVsDeadline !== null && r.scenarioDaysVsDeadline > 0 ? "border-danger/40 bg-danger-soft" : "border-line bg-panel")}>
              <p className="text-[13px] font-semibold text-c-whatif">Result</p>
              <p className="mt-1 text-[20px] font-bold leading-snug">{r.summary}</p>
              <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                <Compare label="Projected finish" before={r.baselineFinish ? formatDate(r.baselineFinish, data.today) : "—"} after={r.scenarioFinish ? formatDate(r.scenarioFinish, data.today) : "—"} worse={(r.finishShiftDays ?? 0) > 0} />
                <Compare
                  label="Against the deadline"
                  before={vsLabel(r.baselineDaysVsDeadline, r.baselineDeadline)}
                  after={vsLabel(r.scenarioDaysVsDeadline, r.scenarioDeadline)}
                  worse={(r.scenarioDaysVsDeadline ?? -1) > 0 && (r.baselineDaysVsDeadline ?? -1) <= 0}
                />
                <div className="rounded-xl bg-raised p-3">
                  <dt className="text-[13px] text-muted">Health score</dt>
                  <dd className="mt-1 flex items-center gap-2 text-[18px] font-bold">
                    <span style={{ color: HEALTH_COLOR[r.health.beforeStatus] }}>{r.health.before ?? "–"}</span>
                    <ArrowRight className="size-4 text-faint" />
                    <span style={{ color: HEALTH_COLOR[r.health.afterStatus] }}>{r.health.after ?? "–"}</span>
                  </dd>
                  <p className="text-[12px] text-muted">{HEALTH_LABEL[r.health.afterStatus]}</p>
                </div>
              </dl>
              {r.health.before != null && r.health.after != null && r.health.after > r.health.before && (r.finishShiftDays ?? 0) > 0 && (
                <p className="mt-4 rounded-xl bg-panel px-4 py-3 text-[13px] text-muted">
                  <span className="font-semibold text-fg">Why does the score go up?</span> Moving due dates later means some tasks would no longer count as overdue. The work itself isn&apos;t any further along, and the project would finish later than it does now.
                </p>
              )}
              {canEdit && (
                <div className="mt-6 flex flex-wrap items-end gap-3 border-t border-line pt-5">
                  <Field label="Save as" htmlFor="wi-save" className="min-w-[220px] flex-1">
                    <input id="wi-save" className="field" placeholder="e.g. API three days late" value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={120} />
                  </Field>
                  <Button
                    disabled={!saveName.trim()}
                    onClick={async () => {
                      const res = await saveScenario(projectId, saveName, changes);
                      if (!res.ok) return toast.error(res.error);
                      setScenarioId(res.data.id);
                      toast.success("Scenario saved.");
                    }}
                  >
                    <Save className="size-4" /> Save
                  </Button>
                  <Button variant="primary" disabled={!r.updates.length && !r.projectDeadlineUpdate} onClick={() => setConfirmApply(true)}>
                    <CheckCircle2 className="size-4" /> Apply to project
                  </Button>
                </div>
              )}
            </section>

            <Panel title={`Tasks that would move (${r.moves.length})`} icon={<Clock className="size-4" />} accent="var(--c-tasks)" bodyClassName="px-5 pb-5 pt-2">
              {r.moves.length ? (
                <ul className="divide-y divide-line">
                  {r.moves.map((m) => (
                    <li key={m.taskId} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">{m.title}</span>
                        <span className="block text-[13px] text-muted">{m.cause === "changed" ? "Changed directly" : `Waits on “${m.causeTaskTitle}”`}</span>
                      </span>
                      <span className="text-[14px] text-muted">
                        Due {formatDate(m.fromDue, data.today)} <ArrowRight className="inline size-3.5" /> <span className="font-semibold text-fg">{formatDate(m.toDue, data.today)}</span>
                      </span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", m.shiftDays > 0 ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
                        {m.shiftDays > 0 ? `+${m.shiftDays}` : m.shiftDays} {Math.abs(m.shiftDays) === 1 ? "day" : "days"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[14px] text-muted">No dates would change.</p>
              )}
            </Panel>

            <div className="grid gap-6 md:grid-cols-2">
              {r.milestones.length > 0 && (
                <Panel title="Milestones" icon={<Flag className="size-4" />} accent="var(--c-projects)">
                  <ul className="flex flex-col gap-2 text-[14px]">
                    {r.milestones.map((m) => (
                      <li key={m.milestoneId}>
                        <span className="font-semibold">{m.name}</span>
                        <span className="block text-muted">
                          Linked work finishes {formatDate(m.scenarioFinish, data.today)} (target {formatDate(m.targetDate, data.today)})
                          {m.nowLate && !m.wasLate && <span className="font-semibold text-danger">, now late</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {r.workload.length > 0 && (
                <Panel title="Workload" icon={<UserRound className="size-4" />} accent="var(--c-team)">
                  <ul className="flex flex-col gap-2 text-[14px]">
                    {r.workload.map((w) => (
                      <li key={w.userId} className="flex justify-between gap-3">
                        <span>{w.name}</span>
                        <span className="num text-muted">
                          {w.before} <ArrowRight className="inline size-3.5" /> <span className="font-semibold text-fg">{w.after}</span> {w.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {(r.health.newRisks.length > 0 || r.health.resolvedRisks.length > 0) && (
                <Panel title="Risks Pulse would see" icon={<TriangleAlert className="size-4" />} accent="var(--c-pulse)" className="md:col-span-2">
                  <ul className="flex flex-col gap-1.5 text-[14px]">
                    {r.health.newRisks.map((t) => (
                      <li key={`n${t}`}>
                        <span className="mr-2 rounded bg-danger-soft px-1.5 py-0.5 text-[11px] font-semibold text-danger">New</span>
                        {t}
                      </li>
                    ))}
                    {r.health.resolvedRisks.map((t) => (
                      <li key={`r${t}`}>
                        <span className="mr-2 rounded bg-success-soft px-1.5 py-0.5 text-[11px] font-semibold text-success">Gone</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>

            <details className="rounded-2xl border border-line bg-panel px-5 py-4 text-[14px]">
              <summary className="cursor-pointer font-semibold">How this was worked out</summary>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
                {r.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          </>
        ) : running ? (
          <p className="text-[15px] text-muted">Working it out…</p>
        ) : r && !r.valid ? (
          <ErrorNote>{r.errors.join(" ")}</ErrorNote>
        ) : null}
      </div>

      {r && (
        <ConfirmDialog
          open={confirmApply}
          onClose={() => setConfirmApply(false)}
          title="Apply this scenario to the real project?"
          body={
            <div className="space-y-2">
              <p>These changes will be made to {projectName}, and recorded in its activity:</p>
              <ul className="max-h-[40vh] list-disc space-y-1 overflow-y-auto pl-5 text-fg">
                {r.updates.map((u) => (
                  <li key={u.taskId}>
                    “{u.title}”:{" "}
                    {[
                      u.dueDate !== undefined ? `due ${formatDate(u.dueDate, data.today)}` : null,
                      u.startDate !== undefined ? `starts ${formatDate(u.startDate, data.today)}` : null,
                      u.assigneeId !== undefined ? `assigned to ${name(u.assigneeId)}` : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </li>
                ))}
                {r.projectDeadlineUpdate && <li>Project deadline: {r.projectDeadlineUpdate.to ? formatDate(r.projectDeadlineUpdate.to, data.today) : "removed"}</li>}
              </ul>
            </div>
          }
          confirmLabel="Apply changes"
          onConfirm={async () => {
            const res = await applyScenario(projectId, changes, r.fingerprint, scenarioId);
            if (!res.ok) return res.error;
            toast.success(`Scenario applied. ${res.data.updated} ${res.data.updated === 1 ? "task" : "tasks"} updated.`);
            setChanges([]);
            setScenarioId(null);
            return null;
          }}
        />
      )}
    </div>
  );
}

function vsLabel(days: number | null, deadline: string | null) {
  if (!deadline) return "No deadline";
  if (days === null) return "—";
  if (days > 0) return `${days} ${days === 1 ? "day" : "days"} late`;
  if (days === 0) return "On the day";
  return `${-days} ${days === -1 ? "day" : "days"} spare`;
}

function Compare({ label, before, after, worse }: { label: string; before: string; after: string; worse: boolean }) {
  return (
    <div className="rounded-xl bg-raised p-3">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 text-[15px]">
        <span className="text-muted line-through decoration-faint">{before !== after ? before : ""}</span>
        {before !== after && <ArrowRight className="mx-1 inline size-3.5 text-faint" />}
        <span className={cn("font-bold", worse ? "text-danger" : "text-fg")}>{after}</span>
      </dd>
    </div>
  );
}
