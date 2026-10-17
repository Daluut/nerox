"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { TaskStatus } from "@/lib/domain/types";
import { canWrite, useAppData } from "@/components/shell/app-context";
import { Button } from "@/components/ui/primitives";
import { QuickCreateTask } from "./quick-create";

/** "Add task" with the project (and optionally status) prefilled. Hidden for viewers. */
export function AddTaskButton({ projectId, status, label = "Add task", compact }: { projectId: string; status?: TaskStatus; label?: string; compact?: boolean }) {
  const data = useAppData();
  const [open, setOpen] = useState(false);
  if (!canWrite(data.role)) return null;
  return (
    <>
      {compact ? (
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-fg">
          <Plus className="size-3.5" /> {label}
        </button>
      ) : (
        <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" /> {label}
        </Button>
      )}
      <QuickCreateTask open={open} onClose={() => setOpen(false)} defaultProjectId={projectId} defaultStatus={status} />
    </>
  );
}
