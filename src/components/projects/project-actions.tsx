"use client";

import { useState } from "react";
import { Archive, CheckCircle2, Download, MoreHorizontal, Pause, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { deleteProject, setProjectArchived, setProjectMember, setProjectStatus, updateProject } from "@/lib/actions/projects";
import type { ProjectStatus } from "@/lib/domain/types";
import { useAppData } from "@/components/shell/app-context";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Button, ErrorNote, Field } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";

interface P {
  id: string;
  name: string;
  description: string;
  startDate: string | null;
  deadline: string | null;
  ownerId: string | null;
  status: ProjectStatus;
  archived: boolean;
}

export function ProjectActions({ project, memberIds, canEdit, canDelete }: { project: P; memberIds: string[]; canEdit: boolean; canDelete: boolean }) {
  const toast = useToast();
  const data = useAppData();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "archive" | "complete">(null);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    const r = await fn();
    if (!r.ok) toast.error(r.error ?? "Something went wrong.");
    else toast.success(success);
  };

  const items: MenuItem[] = [];
  if (canEdit) {
    items.push({ label: "Edit project", icon: <Pencil className="size-3.5" />, onSelect: () => setEditing(true) });
    if (project.status !== "completed") items.push({ label: "Mark as completed", icon: <CheckCircle2 className="size-3.5" />, onSelect: () => setConfirm("complete") });
    else items.push({ label: "Reopen project", icon: <RotateCcw className="size-3.5" />, onSelect: () => run(() => setProjectStatus(project.id, "active"), "Project reopened.") });
    if (project.status === "active") items.push({ label: "Put on hold", icon: <Pause className="size-3.5" />, onSelect: () => run(() => setProjectStatus(project.id, "on_hold"), "Project put on hold.") });
    if (project.status === "on_hold") items.push({ label: "Resume project", icon: <Play className="size-3.5" />, onSelect: () => run(() => setProjectStatus(project.id, "active"), "Project resumed.") });
    items.push(
      project.archived
        ? { label: "Restore from archive", icon: <RotateCcw className="size-3.5" />, onSelect: () => run(() => setProjectArchived(project.id, false), "Project restored.") }
        : { label: "Archive project", icon: <Archive className="size-3.5" />, onSelect: () => setConfirm("archive") },
    );
  }
  items.push({
    label: data.canExport ? "Export tasks (CSV)" : "Export tasks (CSV, Pro)",
    icon: <Download className="size-3.5" />,
    onSelect: () => {
      if (data.canExport) window.location.href = `/projects/${project.id}/export`;
      else toast.error("Spreadsheet export is part of Pro. An owner or admin can upgrade on the Billing page in Settings.");
    },
  });
  if (canDelete) items.push({ label: "Delete project", danger: true, icon: <Trash2 className="size-3.5" />, onSelect: () => setConfirm("delete") });

  return (
    <>
      <Menu label="Project actions" trigger={<MoreHorizontal className="m-1.5 size-4" />} items={items} />
      <EditProjectDialog open={editing} onClose={() => setEditing(false)} project={project} memberIds={memberIds} />
      <ConfirmDialog
        open={confirm === "complete"}
        onClose={() => setConfirm(null)}
        title="Mark project as completed?"
        body="It moves to Completed and stops being assessed by Pulse. Open tasks stay as they are. You can reopen it at any time."
        confirmLabel="Mark completed"
        onConfirm={async () => {
          const r = await setProjectStatus(project.id, "completed");
          if (!r.ok) return r.error;
          toast.success("Project completed.");
          return null;
        }}
      />
      <ConfirmDialog
        open={confirm === "archive"}
        onClose={() => setConfirm(null)}
        title="Archive this project?"
        body="Archived projects are hidden from Overview, My Tasks and Pulse. Nothing is deleted, and you can restore it later."
        confirmLabel="Archive"
        onConfirm={async () => {
          const r = await setProjectArchived(project.id, true);
          if (!r.ok) return r.error;
          toast.success("Project archived.");
          return null;
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Delete this project permanently?"
        body="All of its tasks, milestones, comments and Pulse history will be deleted. This can't be undone. Archive it instead if you might need it again."
        confirmLabel="Delete project"
        danger
        requireText={project.name}
        onConfirm={async (typed) => {
          const r = await deleteProject(project.id, typed);
          return r && !r.ok ? r.error : null;
        }}
      />
    </>
  );
}

function EditProjectDialog({ open, onClose, project, memberIds }: { open: boolean; onClose: () => void; project: P; memberIds: string[] }) {
  const data = useAppData();
  const toast = useToast();
  const [form, setForm] = useState({ name: project.name, description: project.description, startDate: project.startDate ?? "", deadline: project.deadline ?? "", ownerId: project.ownerId ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const active = data.members.filter((m) => m.active);

  return (
    <Dialog open={open} onClose={onClose} title="Edit project" width={540}>
      <form
        className="flex flex-col gap-4 px-5 py-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const r = await updateProject(project.id, { ...form, startDate: form.startDate || null, deadline: form.deadline || null, ownerId: form.ownerId || null });
          setBusy(false);
          if (!r.ok) {
            setError(r.error);
            setFieldErrors(r.fieldErrors ?? {});
            return;
          }
          toast.success(form.deadline !== (project.deadline ?? "") ? "Project updated. Deadline changed." : "Project updated.");
          onClose();
        }}
      >
        <Field label="Name" htmlFor="ep-name" error={fieldErrors.name}>
          <input id="ep-name" className="field" value={form.name} maxLength={120} required onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description" htmlFor="ep-desc">
          <textarea id="ep-desc" className="field min-h-[70px]" value={form.description} maxLength={2000} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" htmlFor="ep-start">
            <input id="ep-start" type="date" className="field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
          <Field label="Deadline" htmlFor="ep-deadline" error={fieldErrors.deadline}>
            <input id="ep-deadline" type="date" className="field" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </Field>
        </div>
        <Field label="Owner" htmlFor="ep-owner">
          <select id="ep-owner" className="field" value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })}>
            <option value="">No owner</option>
            {active.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-muted">Team</legend>
          <p className="mb-2 text-[12px] text-faint">Team members are counted in Pulse&apos;s workload balance. Changes save immediately.</p>
          <div className="flex flex-wrap gap-1.5">
            {active.map((m) => (
              <MemberToggle key={m.userId} projectId={project.id} userId={m.userId} name={m.name} initial={memberIds.includes(m.userId)} />
            ))}
          </div>
        </fieldset>
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function MemberToggle({ projectId, userId, name, initial }: { projectId: string; userId: string; name: string; initial: boolean }) {
  const toast = useToast();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await setProjectMember(projectId, userId, !on);
        setBusy(false);
        if (!r.ok) toast.error(r.error);
        else setOn(!on);
      }}
      className={cn("rounded-md border px-2 py-1 text-[13px] disabled:opacity-50", on ? "border-violet bg-violet-soft text-fg" : "border-line-strong text-muted hover:text-fg")}
    >
      {name}
    </button>
  );
}
