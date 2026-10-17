"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, MoreHorizontal, RotateCcw, Trash2, X } from "lucide-react";
import { addComment, addDependency, deleteComment, deleteTask, getTaskDetail, removeDependency, updateTask, type TaskDetail } from "@/lib/actions/tasks";
import { daysBetween, formatDate, lateLabel, relativeDay } from "@/lib/domain/dates";
import { checkNewDependency } from "@/lib/domain/graph";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES } from "@/lib/domain/types";
import { canWrite, nameOf, useAppData } from "@/components/shell/app-context";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { Avatar, Button, ErrorNote, Skeleton } from "@/components/ui/primitives";
import { StatusIcon } from "@/components/ui/badges";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/components/ui/time";
import { describeEvent } from "@/components/projects/activity-text";
import { cn } from "@/components/ui/cn";

/** Task detail panel, opened anywhere by adding ?task=<id> to the URL. */
export function TaskDrawer() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const taskId = params.get("task");

  const close = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("task");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  return (
    <Dialog open={!!taskId} onClose={close} variant="drawer" width={560}>
      {taskId && <TaskPanel key={taskId} taskId={taskId} onClose={close} />}
    </Dialog>
  );
}

function TaskPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const data = useAppData();
  const toast = useToast();
  const editable = canWrite(data.role);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    const r = await getTaskDetail(taskId).catch(() => null);
    if (!r) setLoadError("Couldn't load this task. Check your connection and try again.");
    else if (!r.ok) setLoadError(r.error);
    else {
      setDetail(r.data);
      setLoadError(null);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(field: string, patch: Record<string, unknown>, message?: string) {
    if (!detail) return;
    setSaving(field);
    const r = await updateTask(taskId, patch).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Your change wasn't saved." }));
    setSaving(null);
    if (!r.ok) {
      toast.error(r.error);
      return false;
    }
    setDetail({ ...detail, task: r.data });
    if (message) toast.success(message);
    load(); // refresh history
    return true;
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex justify-end">
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-faint hover:bg-hover hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <ErrorNote>{loadError}</ErrorNote>
        <Button onClick={load} className="w-fit">
          Try again
        </Button>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="flex flex-col gap-4 p-6" aria-busy>
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-3/4" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
        <Skeleton className="h-24" />
      </div>
    );
  }

  const t = detail.task;
  const done = t.status === "done";
  const overdue = !done && t.dueDate && t.dueDate < data.today;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-panel px-5 py-3">
        <Link href={`/projects/${t.projectId}`} className="min-w-0 flex-1 truncate text-[12px] text-muted hover:text-fg" onClick={onClose}>
          {detail.projectName}
        </Link>
        {saving && <span className="text-[12px] text-faint">Saving…</span>}
        {editable && (
          <Menu
            label="Task actions"
            trigger={<MoreHorizontal className="m-1 size-4" />}
            items={[{ label: "Delete task", danger: true, icon: <Trash2 className="size-3.5" />, onSelect: () => setConfirmDelete(true) }]}
          />
        )}
        <button onClick={onClose} aria-label="Close task" className="rounded p-1 text-faint hover:bg-hover hover:text-fg">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        <div className="flex items-start gap-3">
          <StatusIcon status={t.status} className="mt-2.5" />
          <EditableTitle value={t.title} disabled={!editable} onSave={(title) => save("title", { title })} />
        </div>

        {editable && (
          <div className="-mt-3 flex gap-2">
            {done ? (
              <Button size="sm" onClick={() => save("status", { status: "todo" }, "Task reopened.")}>
                <RotateCcw className="size-3.5" /> Reopen
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => save("status", { status: "done" }, "Task completed.")}>
                <CheckCircle2 className="size-3.5" /> Mark complete
              </Button>
            )}
          </div>
        )}

        <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
          <Prop label="Status">
            <select className="field py-1" disabled={!editable} value={t.status} onChange={(e) => save("status", { status: e.target.value }, `Moved to ${STATUS_LABEL[e.target.value as keyof typeof STATUS_LABEL]}.`)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Prop>
          <Prop label="Priority">
            <select className="field py-1" disabled={!editable} value={t.priority} onChange={(e) => save("priority", { priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Prop>
          <Prop label="Assignee">
            <select
              className="field py-1"
              disabled={!editable}
              value={t.assigneeId ?? ""}
              onChange={(e) => save("assignee", { assigneeId: e.target.value || null }, e.target.value ? `Assigned to ${nameOf(data, e.target.value)}.` : "Task unassigned.")}
            >
              <option value="">Unassigned</option>
              {t.assigneeId && !data.members.find((m) => m.userId === t.assigneeId)?.active && <option value={t.assigneeId}>{nameOf(data, t.assigneeId)}</option>}
              {data.members
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Prop>
          <Prop label="Start date">
            <input type="date" className="field py-1" disabled={!editable} value={t.startDate ?? ""} onChange={(e) => save("start", { startDate: e.target.value || null })} />
          </Prop>
          <Prop label="Due date">
            <div className="flex items-center gap-2">
              <input
                type="date"
                className={cn("field py-1", overdue && "border-danger/60")}
                disabled={!editable}
                value={t.dueDate ?? ""}
                onChange={(e) => save("due", { dueDate: e.target.value || null }, "Due date updated.")}
              />
              {t.dueDate && !done && <span className={cn("whitespace-nowrap text-[12px]", overdue ? "text-danger" : "text-faint")}>{overdue ? lateLabel(daysBetween(t.dueDate, data.today)) : relativeDay(t.dueDate, data.today)}</span>}
            </div>
          </Prop>
          <Prop label="Estimate">
            <NumberField value={t.estimateHours} disabled={!editable} suffix="hours" min={0.5} onSave={(v) => save("estimate", { estimateHours: v })} />
          </Prop>
          <Prop label="Actual effort">
            <NumberField value={t.actualHours} disabled={!editable} suffix="hours" min={0} onSave={(v) => save("actual", { actualHours: v })} />
          </Prop>
          {detail.milestones.length > 0 && (
            <Prop label="Milestone">
              <select className="field py-1" disabled={!editable} value={t.milestoneId ?? ""} onChange={(e) => save("milestone", { milestoneId: e.target.value || null })}>
                <option value="">None</option>
                {detail.milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Prop>
          )}
          <Prop label="Labels">
            <LabelsField labels={t.labels} disabled={!editable} onSave={(labels) => save("labels", { labels })} />
          </Prop>
        </dl>

        <section>
          <h3 className="mb-1.5 text-[13px] font-medium text-muted">Description</h3>
          <DescriptionField value={t.description} disabled={!editable} onSave={(description) => save("description", { description })} />
        </section>

        <Dependencies detail={detail} editable={editable} onChanged={load} />
        <Comments detail={detail} onChanged={load} />

        <section>
          <h3 className="mb-2 text-[13px] font-medium text-muted">History</h3>
          {detail.history.length ? (
            <ol className="flex flex-col gap-1.5 border-l border-line pl-3">
              {detail.history.map((h) => (
                <li key={h.id} className="text-[12px] text-muted">
                  <span className="text-fg">{h.actorName === "Unassigned" ? "System" : h.actorName}</span> {describeEvent(h, (id) => nameOf(data, id), false)}{" "}
                  <span className="text-faint">{timeAgo(h.createdAt)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[12px] text-faint">No history yet.</p>
          )}
          <p className="mt-3 text-[11px] text-faint">
            Created {formatDate(t.createdAt.slice(0, 10), data.today)} by {nameOf(data, t.creatorId)}
            {t.completedAt ? `. Completed ${timeAgo(t.completedAt)}` : ""}.
          </p>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this task?"
        body={
          <>
            “{t.title}” and its comments and dependencies will be removed permanently. The deletion is recorded in the project&apos;s activity.
          </>
        }
        confirmLabel="Delete task"
        danger
        onConfirm={async () => {
          const r = await deleteTask(t.id);
          if (!r.ok) return r.error;
          toast.success("Task deleted.");
          onClose();
          return null;
        }}
      />
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function EditableTitle({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => Promise<boolean | undefined> }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = async () => {
    const next = v.trim();
    if (!next) return setV(value);
    if (next !== value && !(await onSave(next))) setV(value);
  };
  return (
    <textarea
      aria-label="Task title"
      rows={1}
      disabled={disabled}
      value={v}
      maxLength={200}
      onChange={(e) => setV(e.target.value.replace(/\n/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLTextAreaElement).blur();
        }
      }}
      className="field-sizing-content w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[19px] font-semibold leading-snug outline-none hover:border-line focus:border-violet disabled:hover:border-transparent"
    />
  );
}

function NumberField({ value, disabled, suffix, min, onSave }: { value: number | null; disabled: boolean; suffix: string; min: number; onSave: (v: number | null) => void }) {
  const [v, setV] = useState(value?.toString() ?? "");
  useEffect(() => setV(value?.toString() ?? ""), [value]);
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        step={0.5}
        className="field w-24 py-1"
        disabled={disabled}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v === "" ? null : Number(v);
          if (next !== value) onSave(next);
        }}
      />
      <span className="text-[12px] text-faint">{suffix}</span>
    </div>
  );
}

function DescriptionField({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea
      className="field min-h-[96px] resize-y leading-relaxed"
      placeholder={disabled ? "No description." : "Add context, acceptance criteria or links."}
      disabled={disabled}
      value={v}
      maxLength={10000}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v)}
    />
  );
}

function LabelsField({ labels, disabled, onSave }: { labels: string[]; disabled: boolean; onSave: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((l) => (
        <span key={l} className="inline-flex items-center gap-1 rounded bg-hover px-1.5 py-0.5 text-[12px] text-muted">
          {l}
          {!disabled && (
            <button aria-label={`Remove label ${l}`} onClick={() => onSave(labels.filter((x) => x !== l))} className="text-faint hover:text-fg">
              <X className="size-3" />
            </button>
          )}
        </span>
      ))}
      {!disabled && labels.length < 10 && (
        <input
          aria-label="Add label"
          className="w-28 bg-transparent px-1 py-0.5 text-[12px] outline-none placeholder:text-faint"
          placeholder="Add label"
          value={draft}
          maxLength={30}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              if (!labels.includes(draft.trim())) onSave([...labels, draft.trim()]);
              setDraft("");
            }
          }}
        />
      )}
      {disabled && !labels.length && <span className="text-faint">None</span>}
    </div>
  );
}

function Dependencies({ detail, editable, onChanged }: { detail: TaskDetail; editable: boolean; onChanged: () => void }) {
  const toast = useToast();
  const t = detail.task;
  const byId = useMemo(() => new Map(detail.projectTasks.map((x) => [x.id, x])), [detail.projectTasks]);
  const deps = detail.dependencies.map((d) => ({ predecessorId: d.predecessorId, successorId: d.successorId }));
  const waitingOn = detail.dependencies.filter((d) => d.successorId === t.id);
  const blocks = detail.dependencies.filter((d) => d.predecessorId === t.id);
  const [adding, setAdding] = useState<"waits" | "blocks" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const candidates = (mode: "waits" | "blocks") =>
    detail.projectTasks.filter((o) => o.id !== t.id && (mode === "waits" ? checkNewDependency(o.id, t.id, deps).ok : checkNewDependency(t.id, o.id, deps).ok));

  async function add(otherId: string) {
    if (!adding || !otherId) return;
    setError(null);
    const r = adding === "waits" ? await addDependency(otherId, t.id) : await addDependency(t.id, otherId);
    if (!r.ok) return setError(r.error);
    toast.success("Dependency added.");
    setAdding(null);
    onChanged();
  }

  const row = (depId: string, otherId: string) => {
    const o = byId.get(otherId);
    return (
      <li key={depId} className="group flex items-center gap-2 rounded px-1.5 py-1 hover:bg-hover">
        <StatusIcon status={(o?.status as never) ?? "todo"} />
        <Link href={`?task=${otherId}`} scroll={false} className={cn("flex-1 truncate text-[13px] hover:underline", o?.status === "done" && "text-muted line-through")}>
          {o?.title ?? "Unknown task"}
        </Link>
        {o?.dueDate && <span className="text-[12px] text-faint">{formatDate(o.dueDate)}</span>}
        {editable && (
          <button
            aria-label="Remove dependency"
            onClick={async () => {
              const r = await removeDependency(depId);
              if (!r.ok) toast.error(r.error);
              else onChanged();
            }}
            className="text-faint opacity-0 hover:text-fg group-hover:opacity-100 focus:opacity-100"
          >
            <X className="size-3.5" />
          </button>
        )}
      </li>
    );
  };

  const openWaits = waitingOn.filter((d) => byId.get(d.predecessorId)?.status !== "done").length;

  return (
    <section>
      <h3 className="mb-1.5 text-[13px] font-medium text-muted">Dependencies</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[12px] text-faint">
            Waiting on{openWaits > 0 && t.status !== "done" ? <span className="text-warning"> ({openWaits} unfinished)</span> : null}
          </p>
          <ul>{waitingOn.length ? waitingOn.map((d) => row(d.id, d.predecessorId)) : <li className="px-1.5 text-[12px] text-faint">Nothing</li>}</ul>
        </div>
        <div>
          <p className="mb-1 text-[12px] text-faint">Blocks</p>
          <ul>{blocks.length ? blocks.map((d) => row(d.id, d.successorId)) : <li className="px-1.5 text-[12px] text-faint">Nothing</li>}</ul>
        </div>
      </div>
      {editable &&
        (adding ? (
          <div className="mt-2 flex items-center gap-2">
            <select aria-label="Choose task" className="field py-1" defaultValue="" onChange={(e) => add(e.target.value)} autoFocus>
              <option value="" disabled>
                {adding === "waits" ? "This task waits on…" : "This task blocks…"}
              </option>
              {candidates(adding).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="mt-2 flex gap-3 text-[12px]">
            <button onClick={() => setAdding("waits")} className="text-muted hover:text-fg">
              + Waits on
            </button>
            <button onClick={() => setAdding("blocks")} className="text-muted hover:text-fg">
              + Blocks
            </button>
          </div>
        ))}
      {editable && adding && <p className="mt-1 text-[11px] text-faint">Tasks that would create a loop aren&apos;t listed.</p>}
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </section>
  );
}

function Comments({ detail, onChanged }: { detail: TaskDetail; onChanged: () => void }) {
  const data = useAppData();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-medium text-muted">Comments</h3>
      <ul className="flex flex-col gap-3">
        {detail.comments.map((c) => (
          <li key={c.id} className="group flex gap-2.5">
            <Avatar name={c.authorName} size={24} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px]">
                <span className="font-medium">{c.authorName}</span> <span className="text-faint">{timeAgo(c.createdAt)}</span>
                {c.authorId === data.userId && (
                  <button
                    onClick={async () => {
                      const r = await deleteComment(c.id);
                      if (!r.ok) toast.error(r.error);
                      else onChanged();
                    }}
                    className="ml-2 text-faint opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"
                  >
                    Delete
                  </button>
                )}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px]">{c.content}</p>
            </div>
          </li>
        ))}
      </ul>
      {canWrite(data.role) ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!text.trim() || busy) return;
            setBusy(true);
            const r = await addComment({ taskId: detail.task.id, content: text }).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. Your comment wasn't posted." }));
            setBusy(false);
            if (!r.ok) return toast.error(r.error);
            setText("");
            onChanged();
          }}
        >
          <textarea
            aria-label="Write a comment"
            className="field min-h-[64px] resize-y"
            placeholder="Ask a question or post an update"
            value={text}
            maxLength={5000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }}
          />
          <Button type="submit" size="sm" className="self-end" loading={busy} disabled={!text.trim()}>
            Comment
          </Button>
        </form>
      ) : (
        !detail.comments.length && <p className="text-[12px] text-faint">No comments.</p>
      )}
    </section>
  );
}
