import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { loadProjectBundle } from "@/lib/data/queries";
import { isOpen } from "@/lib/domain/types";
import { TaskTable, type TableTask } from "./table";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  const b = await loadProjectBundle(ctx, projectId);
  const byId = new Map(b.tasks.map((t) => [t.id, t]));
  const rows: TableTask[] = b.tasks.map((t) => ({
    id: t.id,
    projectId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    dueDate: t.dueDate,
    estimateHours: t.estimateHours,
    completedAt: t.completedAt,
    waitsOn: b.dependencies.filter((d) => d.successorId === t.id).map((d) => byId.get(d.predecessorId)!).filter((x) => x && isOpen(x)).map((x) => x.title),
    blocks: b.dependencies.filter((d) => d.predecessorId === t.id).length,
  }));
  return <TaskTable projectId={projectId} rows={rows} />;
}
