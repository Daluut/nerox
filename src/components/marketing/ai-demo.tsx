"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useInView, prefersReducedMotion } from "./in-view";

const QUESTION = "What does Pulse weighting change?";
// Taken from the Nerox help guide, which answers even without full AI switched on.
const ANSWER =
  "The health score is made from seven checks, like overdue work, stalled tasks and workload balance. Weighting decides how much each one counts. Raise a slider if it matters to your team, lower it if it doesn't. It only changes how the score is added up, never the risks Pulse reports.";

/** The Nerox AI panel, replaying one question and answer when scrolled into view. */
export function AiDemo() {
  const [ref, inView] = useInView<HTMLDivElement>(0.5);
  const [stage, setStage] = useState(0); // 0 nothing, 1 question, 2 thinking, 3 answer

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setStage(3);
      return;
    }
    const timers = [setTimeout(() => setStage(1), 200), setTimeout(() => setStage(2), 800), setTimeout(() => setStage(3), 1700)];
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  return (
    <div ref={ref} className="mk-surface overflow-hidden rounded-3xl">
      <div className="flex items-center gap-3 bg-gradient-to-r from-[#7c5cff] to-[#6a48ff] px-5 py-4 text-white">
        <span className="flex size-9 items-center justify-center rounded-xl bg-white/20">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-[15px] font-semibold">Nerox AI</p>
          <p className="text-[12px] text-white/80">On every page, whenever you&apos;re stuck</p>
        </div>
      </div>
      <div className="flex min-h-[260px] flex-col gap-3 p-5" aria-live="polite">
        {stage >= 1 && <p className="anim-pop ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[#7c5cff] px-4 py-2.5 text-[14px] text-white">{QUESTION}</p>}
        {stage === 2 && (
          <p className="anim-fade flex w-fit gap-1 rounded-2xl bg-white/[0.06] px-4 py-3" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </p>
        )}
        {stage === 3 && (
          <div className="anim-pop max-w-[92%]">
            <p className="rounded-2xl rounded-bl-md bg-white/[0.06] px-4 py-3 text-[14px] leading-relaxed">{ANSWER}</p>
            <span className="mt-2 inline-block rounded-lg bg-[#7c5cff]/20 px-2.5 py-1 text-[13px] font-semibold text-[#b8a6ff]">Open Settings</span>
          </div>
        )}
      </div>
    </div>
  );
}
