"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { updateTask } from "@/lib/actions/tasks";
import { daysBetween, formatDate, lateLabel } from "@/lib/domain/dates";
import { PRIORITY_RANK, STATUS_LABEL, TASK_STATUSES, type TaskStatus } from "@/lib/domain/types";
import { canWrite, nameOf, useAppData } from "@/components/shell/app-context";
import { PriorityIcon, StatusIcon } from "@/components/ui/badges";
import { Avatar } from "@/components/ui/primitives";
import { QuickCreateTask } from "@/components/tasks/quick-create";
import type { TaskRowData } from "@/components/tasks/task-row";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/cn";

type Card = TaskRowData & { estimateHours: number | null; risk: string | null };

/**
 * Kanban board. Drag a card to change its status, or use the status menu on the card
 * (keyboard and screen-reader friendly). Changes are saved immediately and rolled
 * back if the server rejects them.
 */
export function Board({ projectId, cards: initial }: { projectId: string; cards: Card[] }) {
  const data = useAppData();
  const toast = useToast();
  const editable = canWrite(data.role);
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<Card | null>(null);
  const [createIn, setCreateIn] = useState<TaskStatus | null>(null);
  useEffect(() => {
    setCards(initial);
  }, [initial]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const columns = useMemo(
    () =>
      TASK_STATUSES.map((s) => ({
        status: s,
        cards: cards
          .filter((c) => c.status === s)
          .sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
      })),
    [cards],
  );

  async function move(id: string, status: TaskStatus) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    const prev = card.status;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    const r = await updateTask(id, { status }).catch(() => ({ ok: false as const, error: "Couldn't reach Nerox. The card was moved back." }));
    if (!r.ok) {
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status: prev } : c)));
      toast.error(r.error);
    } else if (status === "done") toast.success(`Completed “${card.title}”.`);
  }

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    if (e.over) move(String(e.active.id), e.over.id as TaskStatus);
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDragging(cards.find((c) => c.id === e.active.id) ?? null)}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => `Picked up ${cards.find((c) => c.id === active.id)?.title}.`,
            onDragOver: ({ over }) => (over ? `Over ${STATUS_LABEL[over.id as TaskStatus]}.` : "Not over a column."),
            onDragEnd: ({ over }) => (over ? `Moved to ${STATUS_LABEL[over.id as TaskStatus]}.` : "Dropped outside a column; nothing changed."),
            onDragCancel: () => "Move cancelled.",
          },
        }}
      >
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          {columns.map((col) => (
            <Column key={col.status} status={col.status} count={col.cards.length} onAdd={editable ? () => setCreateIn(col.status) : undefined}>
              {col.cards.map((c) => (
                <DraggableCard key={c.id} card={c} editable={editable} onMove={move} />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>{dragging && <CardBody card={dragging} lifted />}</DragOverlay>
      </DndContext>
      <QuickCreateTask open={!!createIn} onClose={() => setCreateIn(null)} defaultProjectId={projectId} defaultStatus={createIn ?? "todo"} />
      {!cards.length && <p className="mt-2 text-[13px] text-muted">No tasks yet. Add one to any column.</p>}
      <p className="mt-2 text-[11px] text-faint">Drag cards between columns, or use the status control on each card.</p>
    </>
  );
}

function Column({ status, count, children, onAdd }: { status: TaskStatus; count: number; children: React.ReactNode; onAdd?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      aria-label={`${STATUS_LABEL[status]}, ${count} tasks`}
      className={cn("flex min-w-[232px] flex-1 flex-col rounded-lg border bg-panel/60 transition-colors", isOver ? "border-violet bg-violet-soft" : "border-line")}
    >
      <header className="flex items-center gap-2 px-3 py-2.5">
        <StatusIcon status={status} />
        <h2 className="text-[13px] font-medium">{STATUS_LABEL[status]}</h2>
        <span className="num text-[12px] text-faint">{count}</span>
        {onAdd && (
          <button onClick={onAdd} aria-label={`Add task to ${STATUS_LABEL[status]}`} className="ml-auto rounded p-0.5 text-faint hover:bg-hover hover:text-fg">
            <Plus className="size-3.5" />
          </button>
        )}
      </header>
      <ul className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">{children}</ul>
    </section>
  );
}

function DraggableCard({ card, editable, onMove }: { card: Card; editable: boolean; onMove: (id: string, s: TaskStatus) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id, disabled: !editable });
  return (
    <li ref={setNodeRef} className={cn(isDragging && "opacity-30")} {...(editable ? listeners : {})} {...(editable ? attributes : {})} aria-roledescription="Draggable task">
      <CardBody card={card} editable={editable} onMove={onMove} />
    </li>
  );
}

function CardBody({ card, lifted, editable, onMove }: { card: Card; lifted?: boolean; editable?: boolean; onMove?: (id: string, s: TaskStatus) => void }) {
  const data = useAppData();
  const done = card.status === "done";
  const late = !done && card.dueDate && card.dueDate < data.today ? daysBetween(card.dueDate, data.today) : 0;
  return (
    <div className={cn("rounded-md border border-line-strong bg-raised p-3 text-[13px]", lifted ? "rotate-1 shadow-[0_12px_32px_rgb(0_0_0/0.5)]" : "hover:border-[#454857]")}>
      <div className="flex items-start gap-2">
        {card.risk && (
          <span
            title={`Flagged by Pulse (${card.risk})`}
            className="mt-1.5 size-1.5 shrink-0 rounded-full"
            style={{ background: card.risk === "critical" ? "var(--danger)" : card.risk === "high" ? "#ec8a3c" : "var(--warning)" }}
          />
        )}
        <Link
          href={`/projects/${card.projectId}?task=${card.id}`}
          scroll={false}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn("flex-1 leading-snug hover:underline", done && "text-muted line-through")}
        >
          {card.title}
        </Link>
      </div>
      {card.note && <p className="mt-1.5 text-[12px] text-faint">{card.note}</p>}
      <div className="mt-2.5 flex items-center gap-2.5">
        <PriorityIcon priority={card.priority} />
        {card.dueDate && <span className={cn("text-[12px]", late ? "text-danger" : "text-faint")}>{late ? lateLabel(late) : formatDate(card.dueDate, data.today)}</span>}
        {card.estimateHours != null && <span className="num text-[11px] text-faint">{card.estimateHours}h</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {editable && onMove && (
            <label className="relative flex size-5 cursor-pointer items-center justify-center rounded hover:bg-hover" title="Move to another column">
              <StatusIcon status={card.status} />
              <select
                aria-label={`Move “${card.title}” to`}
                value={card.status}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => onMove(card.id, e.target.value as TaskStatus)}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {card.assigneeId ? <Avatar name={nameOf(data, card.assigneeId)} size={20} /> : <span className="block size-5 rounded-full border border-dashed border-line-strong" title="Unassigned" />}
        </span>
      </div>
    </div>
  );
}
