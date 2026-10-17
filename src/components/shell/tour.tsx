"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { completeTour } from "@/lib/actions/workspace";
import { useAppData } from "./app-context";
import { LogoMark } from "./logo";
import { Button } from "@/components/ui/primitives";

interface Step {
  target?: string; // data-tour value; no target = centred card
  title: string;
  body: string;
  color?: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to Nerox",
    body: "Nerox keeps your team's work in one place and tells you, in plain words, whether each project is on track. This quick tour shows you around. It takes about a minute.",
  },
  { target: "nav-home", title: "Home", body: "Your day at a glance: what needs you, how your projects are doing, and what's coming up.", color: "var(--c-home)" },
  { target: "nav-tasks", title: "My Tasks", body: "Everything assigned to you across every project, with the most urgent at the top.", color: "var(--c-tasks)" },
  {
    target: "nav-projects",
    title: "Projects",
    body: "Each project has a board you can drag cards around on, a simple list and a timeline. Start here to plan your work.",
    color: "var(--c-projects)",
  },
  { target: "new-task", title: "Add a task from anywhere", body: "Only a title is needed. You can add a due date, owner and priority whenever you like.", color: "var(--violet)" },
  {
    target: "nav-pulse",
    title: "Pulse checks your projects",
    body: "Pulse gives each project a health score and explains it: what's late, what's blocking other work, and who has too much on.",
    color: "var(--c-pulse)",
  },
  { target: "nav-team", title: "Bring your team", body: "Invite people with a link and choose what they can do.", color: "var(--c-team)" },
  { target: "theme", title: "Make it yours", body: "Switch between Light, Dark and our own Nerox colours at any time.", color: "var(--violet)" },
  { title: "You're all set", body: "You can replay this tour from the question-mark button at the top of the page." },
];

const PAD = 8;

/** First-time guided tour. Highlights one part of the screen at a time. */
export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useAppData();
  const router = useRouter();
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const finish = useCallback(() => {
    try {
      localStorage.setItem("nerox:tour", "done");
    } catch {}
    completeTour().catch(() => {});
    onClose();
    setI(0);
  }, [onClose]);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // Find the highlighted element; skip it when it isn't on screen (e.g. the sidebar on a phone).
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = step.target ? document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) : null;
      const r = el?.getBoundingClientRect();
      setRect(r && r.width > 0 && r.height > 0 ? r : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish]);

  if (!open) return null;

  const cardW = 360;
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: `min(${cardW}px, calc(100vw - 32px))` };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const roomRight = vw - rect.right > cardW + 32;
    if (roomRight) {
      cardStyle = { left: rect.right + 20, top: Math.min(Math.max(16, rect.top - 20), vh - 260), width: cardW };
    } else {
      cardStyle = { left: Math.min(Math.max(16, rect.left + rect.width - cardW), vw - cardW - 16), top: Math.min(rect.bottom + 16, vh - 260), width: `min(${cardW}px, calc(100vw - 32px))` };
    }
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal aria-labelledby="tour-title">
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgb(8 10 30 / 0.6)",
            outline: `3px solid ${step.color ?? "var(--violet)"}`,
          }}
        />
      ) : (
        <div className="anim-fade absolute inset-0 bg-[rgb(8_10_30/0.6)]" />
      )}
      <div className="anim-pop absolute rounded-2xl border border-line bg-panel p-6 shadow-[0_24px_60px_rgb(0_0_0/0.35)]" style={cardStyle}>
        <button onClick={finish} aria-label="Close the tutorial" className="absolute right-3 top-3 rounded-lg p-1.5 text-faint hover:bg-hover hover:text-fg">
          <X className="size-4" />
        </button>
        {!step.target && (
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-violet-soft">
            <LogoMark size={26} />
          </div>
        )}
        <p className="text-[13px] font-medium" style={{ color: step.color ?? "var(--violet)" }}>
          Step {i + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-[20px] font-bold">
          {step.title}
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{step.body}</p>
        <div className="mt-5 flex gap-1" aria-hidden>
          {STEPS.map((_, n) => (
            <span key={n} className="h-1.5 flex-1 rounded-full" style={{ background: n <= i ? (step.color ?? "var(--violet)") : "var(--hover)" }} />
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2">
          {i > 0 ? (
            <Button variant="ghost" onClick={() => setI(i - 1)}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={finish}>
              Skip tour
            </Button>
          )}
          <span className="flex-1" />
          {last ? (
            <Button
              variant="primary"
              onClick={() => {
                finish();
                if (!data.projects.length) router.push("/projects/new");
              }}
            >
              {data.projects.length ? "Start using Nerox" : "Create my first project"}
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setI(i + 1)}>
              {i === 0 ? "Show me around" : "Next"} <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
