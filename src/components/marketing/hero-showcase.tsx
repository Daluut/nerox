"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import board from "../../../public/product/board.webp";
import { prefersReducedMotion } from "./in-view";
import { Tilt } from "./tilt";

const SCORE = 70;

/** Counts up to the health score once, in step with the pulse line. */
function useCountUp(target: number, delay = 900, duration = 1400) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, duration]);
  return n;
}

/**
 * The hero: a real screenshot of a Nerox project board, with the pulse line
 * running into a live health reading and the top risk Pulse found.
 * The cards repeat what's on the screen, so nothing here is invented.
 */
export function HeroShowcase() {
  const n = useCountUp(SCORE);
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative">
      {/* The pulse line runs behind the product and ends at the health card. */}
      <svg aria-hidden className="pointer-events-none absolute -top-[104px] left-[-4%] hidden h-[120px] w-[108%] md:block" viewBox="0 0 1200 120" preserveAspectRatio="none" fill="none">
        <defs>
          <linearGradient id="mk-pl" x1="0" x2="1">
            <stop offset="0" stopColor="#4dd8ff" stopOpacity="0" />
            <stop offset="0.35" stopColor="#4dd8ff" stopOpacity="0.7" />
            <stop offset="1" stopColor="#7c5cff" />
          </linearGradient>
        </defs>
        <path
          className="mk-pulse-path"
          pathLength={1}
          d="M0 70 H380 L404 70 L420 28 L440 104 L458 50 L472 70 H690 L708 70 L722 42 L738 92 L752 70 H1010 L1040 70"
          stroke="url(#mk-pl)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <Tilt className="relative" max={3}>
        <figure className="mk-frame mk-enter" style={{ ["--i" as string]: 5 }}>
          <div className="mk-frame-bar" aria-hidden>
            <i />
            <i />
            <i />
            <span className="ml-3 rounded-md bg-white/[0.04] px-3 py-0.5 text-[11px] text-faint">Website relaunch</span>
          </div>
          <Image
            src={board}
            alt="A Nerox project board for a website relaunch, with tasks in Backlog, To do, In progress, In review and Done, and a health score of 70."
            priority
            sizes="(min-width: 1200px) 1100px, 100vw"
            placeholder="blur"
            className="block h-auto w-full"
          />
        </figure>
      </Tilt>

      {/* Health reading */}
      <div
        className="mk-enter absolute -top-6 right-3 w-[236px] rounded-2xl border border-white/10 bg-[#0d0f33]/90 p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)] backdrop-blur-md sm:right-[-12px] md:-top-12 md:w-[290px] md:p-5"
        style={{ ["--i" as string]: 8 }}
        role="img"
        aria-label={`Health score ${SCORE} out of 100: needs attention`}
      >
        <div className="flex items-center gap-4">
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden className="shrink-0">
            <circle cx="40" cy="40" r={r} stroke="rgb(160 165 255 / 0.15)" strokeWidth="7" fill="none" />
            <circle
              cx="40"
              cy="40"
              r={r}
              stroke="#ffc04d"
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - n / 100)}
              transform="rotate(-90 40 40)"
            />
            <text x="40" y="47" textAnchor="middle" fontSize="22" fontWeight="700" fill="#eef0ff" className="num">
              {n}
            </text>
          </svg>
          <div>
            <p className="text-[12px] text-faint">Pulse health</p>
            <p className="whitespace-nowrap text-[16px] font-semibold text-[#ffc04d]">Needs attention</p>
            <p className="mt-0.5 text-[12px] leading-snug text-muted">4 risks found, each with a reason</p>
          </div>
        </div>
      </div>

      {/* Top risk */}
      <div
        className="mk-enter mk-float absolute -bottom-10 left-3 hidden w-[330px] rounded-2xl border border-white/10 bg-[#0d0f33]/90 p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)] backdrop-blur-md sm:block md:left-[-28px]"
        style={{ ["--i" as string]: 10 }}
      >
        <p className="flex items-center gap-2 text-[12px] font-medium text-[#ff6b7a]">
          <span className="size-2 rounded-full bg-[#ff6b7a]" /> Critical risk
        </p>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug">&ldquo;Write homepage copy&rdquo; is 2 days overdue and 5 tasks are waiting on it.</p>
        <p className="mt-1.5 text-[13px] text-muted">Next step: unblock this first, or move the work that depends on it.</p>
      </div>
    </div>
  );
}
