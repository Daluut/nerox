import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { loadProjectBundle } from "@/lib/data/queries";
import { toRow } from "@/lib/data/views";
import { Board } from "./board";

export const metadata: Metadata = { title: "Board" };

export default async function BoardPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  const b = await loadProjectBundle(ctx, projectId);
  const flagged = new Map<string, string>();
  for (const r of b.assessment.risks) if (r.taskIds[0] && !flagged.has(r.taskIds[0])) flagged.set(r.taskIds[0], r.severity);
  const cards = b.tasks.map((t) => ({ ...toRow(b, t), estimateHours: t.estimateHours, risk: flagged.get(t.id) ?? null }));
  return <Board projectId={projectId} cards={cards} />;
}
