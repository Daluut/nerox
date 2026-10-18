"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** True once the element has scrolled into view (and stays true). */
export function useInView<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, threshold]);
  return [ref, inView] as const;
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Fades a block in when it scrolls into view. Used for product demos only. */
export function Reveal({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "figure" | "section" }) {
  const [ref, shown] = useInView<HTMLDivElement>(0.2);
  return (
    <Tag ref={ref} data-reveal="" data-shown={shown ? "" : undefined} className={className}>
      {children}
    </Tag>
  );
}
