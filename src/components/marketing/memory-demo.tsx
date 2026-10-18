"use client";

import { BookOpen } from "lucide-react";
import { useInView } from "./in-view";

// Example history: estimated vs. actual hours per kind of work, averaged per task.
const ROWS = [
  { kind: "Testing", estimate: 6, actual: 11.5, tasks: 6 },
  { kind: "Writing", estimate: 4, actual: 4, tasks: 3 },
  { kind: "Design reviews", estimate: 3, actual: 3.5, tasks: 3 },
];
const MAX = 12;

/** Estimate vs. reality bars that grow when scrolled into view. */
export function MemoryDemo() {
  const [ref, shown] = useInView<HTMLDivElement>(0.4);
  return (
    <div ref={ref} className="mk-surface rounded-3xl p-5 sm:p-7">
      <p className="flex items-center gap-2 text-[14px] font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-[#ffcf5a]/15 text-[#ffcf5a]">
          <BookOpen className="size-4" />
        </span>
        Estimated vs. actual hours, from finished projects
      </p>
      <ul className="mt-6 space-y-5">
        {ROWS.map((r, i) => {
          const ratio = r.actual / r.estimate;
          return (
            <li key={r.kind}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="font-medium">{r.kind}</span>
                <span className={ratio > 1.3 ? "font-semibold text-[#ffcf5a]" : "text-muted"}>{ratio > 1.05 ? `${ratio.toFixed(1)}× the estimate` : "On estimate"}</span>
              </div>
              <div className="mt-2 space-y-1.5" aria-hidden>
                <div className="h-2.5 rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-[#a9aedd]/50" style={{ width: shown ? `${(r.estimate / MAX) * 100}%` : 0, transition: `width 900ms cubic-bezier(0.2,0.8,0.2,1) ${i * 150}ms` }} />
                </div>
                <div className="h-2.5 rounded-full bg-white/[0.05]">
                  <div className="h-full rounded-full bg-[#ffcf5a]" style={{ width: shown ? `${(r.actual / MAX) * 100}%` : 0, transition: `width 1100ms cubic-bezier(0.2,0.8,0.2,1) ${i * 150 + 200}ms` }} />
                </div>
              </div>
              <p className="sr-only">
                Estimated {r.estimate} hours, actually took {r.actual} hours on average over {r.tasks} tasks.
              </p>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex gap-4 text-[12px] text-faint" aria-hidden>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-[#a9aedd]/50" /> Estimated
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2 rounded-full bg-[#ffcf5a]" /> Actual
        </span>
      </div>
      <p className="mt-5 rounded-2xl bg-white/[0.04] px-4 py-3 text-[15px]">
        <span className="font-semibold">Next time:</span> when you estimate testing, multiply your first guess by about 1.9.
      </p>
      <p className="mt-3 text-[12px] text-faint">Example data. Memory only shows a lesson once it has at least 5 tasks from 2 finished projects.</p>
    </div>
  );
}
