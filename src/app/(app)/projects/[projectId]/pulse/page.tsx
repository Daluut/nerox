import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { loadAcknowledgements, loadProjectBundle, loadSnapshots } from "@/lib/data/queries";
import { PulseReport } from "@/components/pulse/pulse-report";

export const metadata: Metadata = { title: "Pulse" };

export default async function ProjectPulsePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  const b = await loadProjectBundle(ctx, projectId);
  const [snapshots, acks] = await Promise.all([loadSnapshots(ctx, projectId), loadAcknowledgements(ctx, [projectId])]);
  return <PulseReport projectId={projectId} assessment={b.assessment} snapshots={snapshots} acks={acks} today={ctx.today} />;
}
