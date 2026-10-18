"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Split } from "lucide-react";
import { useInView, prefersReducedMotion } from "./in-view";

// An example chain of linked tasks. Day 0 is 12 Oct; the deadline is 13 Nov (day 32).
const START = Date.UTC(2026, 9, 12);
const SPAN = 38;
const DEADLINE = 32;
const DELAY = 4;
const TASKS = [
  { name: "Build page templates", from: 0, to: 10 },
  { name: "Product pages", from: 10, to: 16 },
  { name: "SEO and redirects", from: 16, to: 22 },
  { name: "QA testing", from: 22, to: 28 },
  { name: "Launch announcement", from: 29, to: 31 },
];

const fmt = (day: number) => new Date(START + day * 86_400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (d: number) => `${(d / SPAN) * 100}%`;

/**
 * A small, interactive version of What If?: delay the first task and watch the
 * linked work move, in order, past the deadline. Plays once when scrolled into view.
 */
export function WhatIfDemo() {
  const [ref, inView] = useInView<HTMLDivElement>(0.45);
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setDelayed(true);
      return;
    }
    const t = setTimeout(() => setDelayed(true), 700);
    return () => clearTimeout(t);
  }, [inView]);

  const last = TASKS[TASKS.length - 1].to + (delayed ? DELAY : 0);
  const late = last - DEADLINE;

  return (
    <div ref={ref} className="mk-surface rounded-3xl p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#b69bff]/15 text-[#b69bff]">
            <Split className="size-4" />
          </span>
          What if &ldquo;Build page templates&rdquo; runs {DELAY} days late?
        </p>
        <button
          type="button"
          onClick={() => setDelayed((d) => !d)}
          aria-pressed={delayed}
          className="mk-btn mk-btn-ghost mk-btn-sm"
        >
          {delayed ? (
            <>
              <RotateCcw className="size-4" /> Undo the delay
            </>
          ) : (
            <>Delay it {DELAY} days</>
          )}
        </button>
      </div>

      {/* Axis */}
      <div className="relative mt-6 grid grid-cols-[minmax(0,150px)_1fr] gap-x-4 text-[12px] text-faint max-sm:grid-cols-[minmax(0,110px)_1fr]">
        <span />
        <div className="relative h-5">
          {[0, 7, 14, 21, 28, 35].map((d) => (
            <span key={d} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(d) }}>
              {fmt(d)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-2 grid grid-cols-[minmax(0,150px)_1fr] gap-x-4 gap-y-2.5 max-sm:grid-cols-[minmax(0,110px)_1fr]">
        {TASKS.map((t, i) => {
          const shift = delayed ? DELAY : 0;
          const from = i === 0 ? t.from : t.from + shift;
          const to = t.to + shift;
          const pastDeadline = to > DEADLINE;
          return (
            <div key={t.name} className="contents">
              <span className="truncate py-1.5 text-[13px] text-muted">{t.name}</span>
              <div className="relative h-8 rounded-lg bg-white/[0.025]">
                <span
                  className="absolute inset-y-1 rounded-md"
                  style={{
                    left: pct(from),
                    width: pct(to - from),
                    background: pastDeadline ? "#ff6b7a" : i === 0 && delayed ? "#ffc04d" : "#7c5cff",
                    transition: `left 600ms cubic-bezier(0.2,0.8,0.2,1) ${i * 140}ms, width 600ms cubic-bezier(0.2,0.8,0.2,1) ${i * 140}ms, background-color 300ms ${i * 140 + 300}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
        {/* Deadline line, drawn across the bar column only */}
        <div aria-hidden className="pointer-events-none absolute inset-0 col-start-2" style={{ gridRow: `1 / ${TASKS.length + 1}` }}>
          <div className="relative h-full">
            <span className="absolute inset-y-[-6px] w-px bg-[#ff6b7a]/70" style={{ left: pct(DEADLINE) }} />
            <span className="absolute -bottom-7 -translate-x-1/2 whitespace-nowrap rounded bg-[#ff6b7a]/15 px-1.5 text-[11px] font-medium text-[#ff9aa5]" style={{ left: pct(DEADLINE) }}>
              Deadline, {fmt(DEADLINE)}
            </span>
          </div>
        </div>
      </div>

      <p aria-live="polite" className="mt-11 rounded-2xl bg-white/[0.04] px-4 py-3 text-[15px]">
        {delayed ? (
          <>
            <span className="font-semibold text-[#ff9aa5]">4 linked tasks move.</span> The project would finish on {fmt(last)}, {late} days after the deadline. Nothing changes in your real plan until you press Apply.
          </>
        ) : (
          <>
            On plan: finishes {fmt(last)}, {-late} day before the deadline. Press <span className="font-semibold">Delay it {DELAY} days</span> to see the knock-on effect.
          </>
        )}
      </p>
      <p className="mt-3 text-[12px] text-faint">Example project. In Nerox, What If? uses your real tasks, links, spare time between tasks and people.</p>
    </div>
  );
}
