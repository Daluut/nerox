"use client";

import { useRef, type ReactNode } from "react";
import { prefersReducedMotion } from "./in-view";

/** Leans gently towards the pointer. Off for touch screens and reduced motion. */
export function Tilt({ children, className, max = 4 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  function move(e: React.PointerEvent) {
    if (e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(1400px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
    });
  }
  function leave() {
    cancelAnimationFrame(frame.current);
    if (ref.current) ref.current.style.transform = "";
  }
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={className} style={{ transition: "transform 400ms cubic-bezier(0.2, 0.8, 0.2, 1)", willChange: "transform" }}>
      {children}
    </div>
  );
}
