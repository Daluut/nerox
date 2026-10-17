import Link from "next/link";
import type { ActivityEvent } from "@/lib/data/types";
import { Avatar } from "@/components/ui/primitives";
import { timeAgo } from "@/components/ui/time";
import { describeEvent } from "./activity-text";

/** Chronological feed of recorded events. Every line comes from a real database event. */
export function ActivityFeed({
  events,
  names,
  projectNames,
  empty = "Nothing has happened here yet.",
}: {
  events: ActivityEvent[];
  names: Record<string, string>;
  projectNames?: Record<string, string>;
  empty?: string;
}) {
  if (!events.length) return <p className="text-[13px] text-muted">{empty}</p>;
  const name = (id: string | null) => (id ? (names[id] ?? "Former member") : "Unassigned");
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => {
        const actor = e.actorId ? name(e.actorId) : "Nerox";
        const href =
          e.projectId && (e.entityType === "task" || e.entityType === "comment" || e.entityType === "dependency") && e.eventType !== "task_deleted" && e.entityId
            ? `/projects/${e.projectId}?task=${e.entityId}`
            : e.projectId
              ? `/projects/${e.projectId}`
              : null;
        const text = (
          <>
            <span className="font-medium text-fg">{actor}</span> <span className="text-muted">{describeEvent(e, name)}</span>
          </>
        );
        return (
          <li key={e.id} className="flex gap-2.5">
            <Avatar name={actor} size={22} className="mt-0.5" />
            <div className="min-w-0 flex-1 text-[13px] leading-snug">
              {href ? (
                <Link href={href} scroll={false} className="hover:underline">
                  {text}
                </Link>
              ) : (
                text
              )}
              <div className="mt-0.5 text-[11px] text-faint">
                {timeAgo(e.createdAt)}
                {projectNames && e.projectId && projectNames[e.projectId] ? ` in ${projectNames[e.projectId]}` : ""}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
