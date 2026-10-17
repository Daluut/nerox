import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { loadWorkspaceBundles } from "@/lib/data/queries";
import { attentionScore, toRow } from "@/lib/data/views";
import { MyTasksView, type MyTaskItem } from "./view";

export const metadata: Metadata = { title: "My Tasks" };

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ view?: string; scope?: string }> }) {
  const ctx = await getAppContext();
  const bundles = (await loadWorkspaceBundles(ctx)).filter((b) => !b.project.archivedAt);
  const sp = await searchParams;
  const items: MyTaskItem[] = bundles.flatMap((b) =>
    b.tasks.map((t) => ({
      ...toRow(b, t),
      creatorId: t.creatorId,
      completedAt: t.completedAt,
      attention: attentionScore(b, t, ctx.today),
    })),
  );
  return <MyTasksView items={items} projects={bundles.map((b) => ({ id: b.project.id, name: b.project.name }))} initialView={sp.view} initialScope={sp.scope} />;
}
