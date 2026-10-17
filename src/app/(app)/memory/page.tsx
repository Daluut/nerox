import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { getAppContext } from "@/lib/data/context";
import { loadWorkspaceBundles } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Nerox Memory" };

/**
 * Memory is Phase 4. What it will learn from is already being recorded, so this page
 * reports how much real history exists instead of inventing lessons.
 */
export default async function MemoryPage() {
  const ctx = await getAppContext();
  const bundles = await loadWorkspaceBundles(ctx);
  const completedProjects = bundles.filter((b) => b.project.status === "completed").length;
  const done = bundles.flatMap((b) => b.tasks.filter((t) => t.status === "done"));
  const withBoth = done.filter((t) => t.estimateHours && t.actualHours != null).length;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8 md:py-14">
      <BookOpen className="size-5 text-violet-strong" />
      <h1 className="mt-4 text-[22px] font-semibold">Nerox Memory isn&apos;t available yet</h1>
      <p className="mt-3 text-[15px] text-muted">
        Memory will look back at finished projects — which kinds of work ran over their estimates, which dependencies caused delays — and suggest adjustments when you plan the next one. Every lesson will link to the projects it came from and show how many observations support it.
      </p>
      <h2 className="mt-10 text-[13px] font-medium">History recorded in this workspace so far</h2>
      <dl className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-line bg-panel text-center">
        {[
          ["Completed projects", completedProjects],
          ["Completed tasks", done.length],
          ["Tasks with estimate and actual effort", withBoth],
        ].map(([l, v], i) => (
          <div key={l as string} className={i ? "border-l border-line px-3 py-4" : "px-3 py-4"}>
            <dd className="num text-[22px] font-semibold">{v}</dd>
            <dt className="mt-1 text-[12px] text-muted">{l}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[13px] text-muted">
        Recording actual effort when you complete a task (in the task panel) is what will let Memory compare estimates with reality. Lessons won&apos;t be drawn from a single project or a handful of tasks.
      </p>
    </div>
  );
}
