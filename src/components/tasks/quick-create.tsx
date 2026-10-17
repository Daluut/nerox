"use client";

import { useEffect, useState } from "react";
import { createTask } from "@/lib/actions/tasks";
import { PRIORITIES, PRIORITY_LABEL, STATUS_LABEL, TASK_STATUSES, type Priority, type TaskStatus } from "@/lib/domain/types";
import { useAppData } from "@/components/shell/app-context";
import { Dialog } from "@/components/ui/dialog";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";

/** Quick create: only a title is required; context (project, status, assignee) is prefilled. */
export function QuickCreateTask({
  open,
  onClose,
  defaultProjectId,
  defaultStatus = "todo",
  defaultAssigneeId,
  defaultDueDate,
}: {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  defaultAssigneeId?: string | null;
  defaultDueDate?: string | null;
}) {
  const data = useAppData();
  const toast = useToast();
  const projects = data.projects.filter((p) => !p.archived);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [priority, setPriority] = useState<Priority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setError(null);
    setPriority("medium");
    setStatus(defaultStatus);
    setProjectId(defaultProjectId ?? projects[0]?.id ?? "");
    setAssigneeId(defaultAssigneeId === undefined ? data.userId : (defaultAssigneeId ?? ""));
    setDueDate(defaultDueDate ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await createTask({ projectId, title, status, priority, assigneeId: assigneeId || null, dueDate: dueDate || null }).catch(() => ({
      ok: false as const,
      error: "Couldn't reach Nerox. Check your connection and try again.",
    }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast.success("Task created.");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New task" width={520} labelledBy="qc-title">
      <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
        <input
          aria-label="Task title"
          className="field py-2 text-[15px]"
          placeholder="What needs to be done?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Project" htmlFor="qc-project">
            <select id="qc-project" className="field" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assignee" htmlFor="qc-assignee">
            <select id="qc-assignee" className="field" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {data.members
                .filter((m) => m.active)
                .map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                    {m.userId === data.userId ? " (you)" : ""}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Status" htmlFor="qc-status">
            <select id="qc-status" className="field" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority" htmlFor="qc-priority">
            <select id="qc-priority" className="field" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date" htmlFor="qc-due" className="col-span-2 sm:col-span-1">
            <input id="qc-due" type="date" className="field" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!title.trim() || !projectId}>
            Create task
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
