"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createMilestone, deleteMilestone, updateMilestone } from "@/lib/actions/projects";
import { daysBetween, formatDate } from "@/lib/domain/dates";
import { canWrite, useAppData } from "@/components/shell/app-context";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";

export interface MilestoneItem {
  id: string;
  name: string;
  targetDate: string | null;
  completedAt: string | null;
  linked: number;
  linkedDone: number;
}

export function MilestonesPanel({ projectId, milestones }: { projectId: string; milestones: MilestoneItem[] }) {
  const data = useAppData();
  const toast = useToast();
  const editable = canWrite(data.role);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      {milestones.length ? (
        <ul className="flex flex-col">
          {milestones.map((m) => {
            const overdue = !m.completedAt && m.targetDate && m.targetDate < data.today;
            return (
              <li key={m.id} className="group flex items-center gap-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`${m.completedAt ? "Reopen" : "Complete"} milestone ${m.name}`}
                  disabled={!editable}
                  checked={!!m.completedAt}
                  onChange={async (e) => {
                    const r = await updateMilestone(m.id, { completed: e.target.checked });
                    if (!r.ok) toast.error(r.error);
                    else toast.success(e.target.checked ? "Milestone completed." : "Milestone reopened.");
                  }}
                  className="size-3.5 accent-[var(--violet)]"
                />
                <span aria-hidden className={cn("size-2 rotate-45", m.completedAt ? "bg-success" : overdue ? "bg-danger" : "bg-cyan")} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[13px]", m.completedAt && "text-muted line-through")}>{m.name}</span>
                  {m.linked > 0 && (
                    <span className="text-[12px] text-faint">
                      {m.linkedDone} of {m.linked} linked tasks done
                    </span>
                  )}
                </span>
                {editable ? (
                  <input
                    type="date"
                    aria-label={`Target date for ${m.name}`}
                    className={cn("field w-[132px] shrink-0 px-2 py-0.5 text-[12px]", overdue && "border-danger/60 text-danger")}
                    value={m.targetDate ?? ""}
                    onChange={async (e) => {
                      const r = await updateMilestone(m.id, { targetDate: e.target.value || null });
                      if (!r.ok) toast.error(r.error);
                      else toast.success("Milestone date updated.");
                    }}
                  />
                ) : (
                  <span className={cn("text-[12px]", overdue ? "text-danger" : "text-muted")}>{formatDate(m.targetDate, data.today)}</span>
                )}
                {overdue && <span className="hidden text-[11px] text-danger sm:inline">{daysBetween(m.targetDate!, data.today)}d late</span>}
                {editable && (
                  <button
                    aria-label={`Delete milestone ${m.name}`}
                    onClick={async () => {
                      if (!window.confirm(`Delete milestone “${m.name}”? Linked tasks are kept.`)) return;
                      const r = await deleteMilestone(m.id);
                      if (!r.ok) toast.error(r.error);
                      else toast.success("Milestone deleted.");
                    }}
                    className="text-faint opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-muted">No milestones. Milestones mark key checkpoints; Pulse warns when one is close and most of its linked work is still open.</p>
      )}
      {editable &&
        (adding ? (
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await createMilestone({ projectId, name, targetDate: date || null });
              setBusy(false);
              if (!r.ok) return toast.error(r.error);
              toast.success("Milestone added.");
              setName("");
              setDate("");
              setAdding(false);
            }}
          >
            <input aria-label="Milestone name" className="field min-w-0 flex-1 py-1" placeholder="Milestone name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus />
            <input aria-label="Target date" type="date" className="field w-auto py-1" value={date} onChange={(e) => setDate(e.target.value)} />
            <Button type="submit" size="sm" variant="primary" loading={busy}>
              Add
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <button onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-fg">
            <Plus className="size-3.5" /> Add milestone
          </button>
        ))}
    </div>
  );
}
