"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus, X } from "lucide-react";
import { createProject } from "@/lib/actions/projects";
import { getPlanningSuggestions } from "@/lib/actions/memory";
import { addDays, daysBetween, formatDate } from "@/lib/domain/dates";
import { TEMPLATES, materialiseTemplate, type MaterialisedTask } from "@/lib/domain/templates";
import { PRIORITIES, PRIORITY_LABEL, type Priority } from "@/lib/domain/types";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";

interface MemberOption {
  userId: string;
  name: string;
}

type DraftTask = MaterialisedTask;

/**
 * Two-part project setup used by onboarding and "New project": details, then
 * starting tasks (from a template or by hand). Everything is created in one
 * database transaction when the user confirms.
 */
export function ProjectCreator({
  today,
  members,
  currentUserId,
  onCancel,
  intro,
}: {
  today: string;
  members: MemberOption[];
  currentUserId: string;
  onCancel?: () => void;
  intro?: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<"details" | "tasks">("details");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [deadline, setDeadline] = useState(addDays(today, 28));
  const [ownerId, setOwnerId] = useState(currentUserId);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState<string | null>("software");
  const [milestones, setMilestones] = useState<{ name: string; targetDate: string | null }[]>([]);
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [newTask, setNewTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [suggestions, setSuggestions] = useState<{ category: string; label: string; multiplier: number; reason: string; affected: string[] }[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const template = TEMPLATES.find((t) => t.id === templateId) ?? null;

  // Memory: lessons from past projects that apply to these tasks.
  const titleKey = tasks.map((t) => t.title).join("|");
  useEffect(() => {
    if (step !== "tasks" || !titleKey) return;
    let live = true;
    getPlanningSuggestions(titleKey.split("|"))
      .then((r) => live && r.ok && setSuggestions(r.data))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [step, titleKey]);
  const span = deadline && startDate ? daysBetween(startDate, deadline) : null;
  const titles = useMemo(() => new Map(tasks.map((t) => [t.key, t.title])), [tasks]);

  function goToTasks() {
    const fe: Record<string, string> = {};
    if (!name.trim()) fe.name = "Give the project a name.";
    if (startDate && deadline && deadline < startDate) fe.deadline = "The deadline must be on or after the start date.";
    setFieldErrors(fe);
    if (Object.keys(fe).length) return;
    if (template) {
      const m = materialiseTemplate(template, startDate || today, deadline || null);
      setTasks(m.tasks);
      setMilestones(m.milestones);
    } else {
      setTasks([]);
    }
    setStep("tasks");
  }

  function addTask() {
    const title = newTask.trim();
    if (!title) return;
    setTasks((t) => [...t, { key: `t${Date.now()}`, title, priority: "medium", startDate: null, dueDate: null, estimateHours: null, dependsOn: [] }]);
    setNewTask("");
  }

  const updateTask = (key: string, patch: Partial<DraftTask>) => setTasks((ts) => ts.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const removeTask = (key: string) =>
    setTasks((ts) => ts.filter((t) => t.key !== key).map((t) => ({ ...t, dependsOn: t.dependsOn.filter((k) => k !== key) })));

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await createProject({
      name,
      description,
      startDate: startDate || null,
      deadline: deadline || null,
      ownerId,
      memberIds,
      templateId,
      milestones: milestones.filter((m) => m.name.trim()),
      tasks,
    }).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Check your connection and try again." }));
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    toast.success("Project created.");
    router.push(`/projects/${r.data.id}`);
  }

  if (step === "details") {
    return (
      <div className="flex flex-col gap-5">
        {intro}
        <Field label="Project name" htmlFor="p-name" error={fieldErrors.name}>
          <input id="p-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoFocus placeholder="e.g. Mobile app coursework" aria-invalid={!!fieldErrors.name} />
        </Field>
        <Field label="Short description" htmlFor="p-desc" hint="Optional. What does done look like?">
          <textarea id="p-desc" className="field min-h-[70px] resize-y" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Start date" htmlFor="p-start">
            <input id="p-start" type="date" className="field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="Target deadline" htmlFor="p-deadline" error={fieldErrors.deadline} hint={span !== null && span >= 0 ? `${span} days` : undefined}>
            <input id="p-deadline" type="date" className="field" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-invalid={!!fieldErrors.deadline} />
          </Field>
        </div>
        {members.length > 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project owner" htmlFor="p-owner">
              <select id="p-owner" className="field" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[13px] font-medium text-muted">Team members</legend>
              <div className="flex flex-wrap gap-1.5">
                {members
                  .filter((m) => m.userId !== ownerId)
                  .map((m) => {
                    const on = memberIds.includes(m.userId);
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setMemberIds((ids) => (on ? ids.filter((i) => i !== m.userId) : [...ids, m.userId]))}
                        className={cn("rounded-md border px-2 py-1 text-[13px]", on ? "border-violet bg-violet-soft text-fg" : "border-line-strong text-muted hover:text-fg")}
                      >
                        {m.name}
                      </button>
                    );
                  })}
              </div>
            </fieldset>
          </div>
        )}
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-muted">Start from</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...TEMPLATES, null].map((t) => {
              const id = t?.id ?? null;
              const selected = templateId === id;
              return (
                <label
                  key={id ?? "blank"}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-md border px-3 py-2.5 transition-colors",
                    selected ? "border-violet bg-violet-soft" : "border-line-strong hover:border-[#454857]",
                  )}
                >
                  <input type="radio" name="template" className="sr-only" checked={selected} onChange={() => setTemplateId(id)} />
                  <span className="text-[13px] font-medium">{t?.name ?? "Blank project"}</span>
                  <span className="text-[12px] text-muted">{t ? `${t.description} ${t.tasks.length} tasks.` : "Add your own tasks."}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button variant="primary" onClick={goToTasks}>
            Continue to tasks
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[17px] font-semibold">First tasks for {name}</h2>
        <p className="mt-1 text-[13px] text-muted">
          Edit, remove or add tasks. Due dates, estimates and dependencies are what let Pulse judge whether the project is on track — you can fill them in later.
        </p>
      </div>
      {suggestions.filter((x) => !applied.includes(x.category)).map((x) => (
        <div key={x.category} className="flex flex-wrap items-start gap-3 rounded-xl border border-c-memory/40 bg-[color-mix(in_srgb,var(--c-memory)_10%,transparent)] p-4">
          <BookOpen className="mt-0.5 size-5 shrink-0 text-c-memory" />
          <div className="min-w-0 flex-1 text-[14px]">
            <p className="font-semibold">Memory: {x.label.toLowerCase()} has taken {x.multiplier.toFixed(2)}× its estimate before</p>
            <p className="text-muted">
              {x.reason} Applies to: {x.affected.join(", ")}.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setTasks((ts) => ts.map((t) => (x.affected.includes(t.title) && t.estimateHours ? { ...t, estimateHours: Math.round(t.estimateHours * x.multiplier * 2) / 2 } : t)));
              setApplied((a) => [...a, x.category]);
            }}
          >
            Adjust estimates
          </Button>
          <button onClick={() => setApplied((a) => [...a, x.category])} className="self-center text-[13px] text-muted hover:text-fg">
            Ignore
          </button>
        </div>
      ))}
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead className="bg-raised text-left text-[12px] text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Task</th>
              <th className="px-2 py-2 font-medium">Priority</th>
              <th className="px-2 py-2 font-medium">Due</th>
              <th className="px-2 py-2 font-medium">Estimate (h)</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.key} className="border-t border-line align-top">
                <td className="px-3 py-1.5">
                  <input aria-label="Task title" className="field py-1" value={t.title} maxLength={200} onChange={(e) => updateTask(t.key, { title: e.target.value })} />
                  {t.dependsOn.length > 0 && (
                    <p className="mt-1 text-[12px] text-faint">After {t.dependsOn.map((k) => titles.get(k)).filter(Boolean).join(", ")}</p>
                  )}
                </td>
                <td className="px-2 py-1.5">
                  <select aria-label="Priority" className="field py-1" value={t.priority} onChange={(e) => updateTask(t.key, { priority: e.target.value as Priority })}>
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label="Due date"
                    type="date"
                    className="field py-1"
                    value={t.dueDate ?? ""}
                    onChange={(e) => updateTask(t.key, { dueDate: e.target.value || null, startDate: t.startDate && e.target.value && t.startDate > e.target.value ? e.target.value : t.startDate })}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    aria-label="Estimate in hours"
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="field w-20 py-1"
                    value={t.estimateHours ?? ""}
                    onChange={(e) => updateTask(t.key, { estimateHours: e.target.value ? Number(e.target.value) : null })}
                  />
                </td>
                <td className="py-1.5 pr-2">
                  <button aria-label={`Remove ${t.title}`} onClick={() => removeTask(t.key)} className="mt-1 rounded p-1 text-faint hover:bg-hover hover:text-fg">
                    <X className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-line">
              <td colSpan={5} className="px-3 py-2">
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTask();
                  }}
                >
                  <input aria-label="New task title" className="field py-1" placeholder="Add a task" value={newTask} onChange={(e) => setNewTask(e.target.value)} maxLength={200} />
                  <Button type="submit" size="sm" disabled={!newTask.trim()}>
                    <Plus className="size-3.5" /> Add
                  </Button>
                </form>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-medium text-muted">Milestones</h3>
        <div className="flex flex-col gap-2">
          {milestones.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input aria-label="Milestone name" className="field py-1" value={m.name} onChange={(e) => setMilestones((ms) => ms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <input
                aria-label="Milestone date"
                type="date"
                className="field w-44 py-1"
                value={m.targetDate ?? ""}
                onChange={(e) => setMilestones((ms) => ms.map((x, j) => (j === i ? { ...x, targetDate: e.target.value || null } : x)))}
              />
              <button aria-label="Remove milestone" onClick={() => setMilestones((ms) => ms.filter((_, j) => j !== i))} className="rounded p-1 text-faint hover:bg-hover hover:text-fg">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setMilestones((ms) => [...ms, { name: "", targetDate: deadline || null }])}
            className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted hover:text-fg"
          >
            <Plus className="size-3.5" /> Add milestone
          </button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="ghost" onClick={() => setStep("details")}>
          Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-faint">
            {tasks.length} tasks{deadline ? `, due ${formatDate(deadline, today)}` : ""}
          </span>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create project
          </Button>
        </div>
      </div>
    </div>
  );
}
