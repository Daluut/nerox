import type { Metadata } from "next";
import Link from "next/link";
import { Split } from "lucide-react";

export const metadata: Metadata = { title: "What If?" };

/**
 * What If? is Phase 3 and isn't built yet. This page says so plainly rather than
 * showing a simulator that doesn't simulate anything.
 */
export default function WhatIfPage() {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 md:px-8 md:py-14">
      <Split className="size-5 text-violet-strong" />
      <h1 className="mt-4 text-[22px] font-semibold">What If? isn&apos;t available yet</h1>
      <p className="mt-3 text-[15px] text-muted">
        What If? will let you try a change — a task slipping three days, someone becoming unavailable, work moving between people — and see the effect on dates, milestones and health before anything in the real project changes.
      </p>
      <h2 className="mt-10 text-[13px] font-medium">What exists today</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] text-muted marker:text-faint">
        <li>Each task shows what it waits on and what it blocks, so you can trace the knock-on effect of a delay by hand.</li>
        <li>Pulse flags overdue tasks that are holding up other work and lists the affected tasks.</li>
        <li>The timeline draws dependency links and marks tasks due before the work they depend on.</li>
      </ul>
      <p className="mt-10 text-[13px] text-faint">
        The scheduling model it will use is being built on the same dependency graph and Pulse engine. Until then,{" "}
        <Link href="/pulse" className="text-violet-strong hover:underline">
          Pulse
        </Link>{" "}
        is the place to see what&apos;s at risk.
      </p>
    </div>
  );
}
