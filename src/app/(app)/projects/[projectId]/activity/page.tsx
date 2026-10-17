import type { Metadata } from "next";
import { getAppContext } from "@/lib/data/context";
import { loadActivity, loadProjectBundle } from "@/lib/data/queries";
import { ActivityFeed } from "@/components/projects/activity-feed";

export const metadata: Metadata = { title: "Activity" };

export default async function ProjectActivityPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const ctx = await getAppContext();
  await loadProjectBundle(ctx, projectId); // 404s for projects outside this workspace
  const events = await loadActivity(ctx, { projectId, limit: 200 });
  const names = Object.fromEntries(ctx.members.map((m) => [m.userId, m.name]));
  return (
    <div className="max-w-2xl">
      <ActivityFeed events={events} names={names} empty="No activity recorded yet." />
      {events.length === 200 && <p className="mt-6 text-[12px] text-faint">Showing the latest 200 events.</p>}
    </div>
  );
}
